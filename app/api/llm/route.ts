import { NextResponse } from "next/server";
import type { LlmRequest, LlmResponse, LlmAction } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-v4-flash";

interface DeepSeekMessage {
  role: "system" | "user";
  content: string;
}

const MAX_CONTEXT_SENTENCE = 400;

function capSentence(s: string): string {
  const t = s.trim();
  return t.length > MAX_CONTEXT_SENTENCE
    ? t.slice(0, MAX_CONTEXT_SENTENCE) + "…"
    : t;
}

function buildContextBlock(req: LlmRequest): string {
  const prev = req.prevSentence ? capSentence(req.prevSentence) : "";
  const curr = req.sentence ? capSentence(req.sentence) : "";
  const next = req.nextSentence ? capSentence(req.nextSentence) : "";
  const lines: string[] = [];
  if (prev) lines.push(`Previous sentence: ${prev}`);
  if (curr) lines.push(`Current sentence: ${curr}`);
  if (next) lines.push(`Next sentence: ${next}`);
  if (lines.length === 0) return "";
  return `\n\nContext:\n${lines.join("\n")}`;
}

function buildPrompt(req: LlmRequest): { system: string; user: string } {
  const term = req.text.trim();
  const context = buildContextBlock(req);
  const isWord = req.isWord ?? !/\s/.test(term);
  const typeLabel = isWord ? "single word" : "phrase";

  switch (req.action) {
    case "simplify":
      return {
        system:
          "You are a reading assistant. Rewrite only the selected text into plain, simple English that is easy to understand while preserving the original meaning. Use the surrounding context only to resolve references and pick the correct meaning; do not add information that is not in the text, and do not simplify or rewrite anything outside the selected text. If the selected text is a single word or short fragment, give a brief plain-English explanation of what it means in this context instead of rewriting it.",
        user: `Text to simplify: ${term}${context}\n\nReturn JSON {"result": "<simplified or explained text>", "example": ""}`,
      };
    case "define":
      return {
        system:
          "You are a precise English dictionary. Given a single word in context, return its most common part(s) of speech and concise definitions that fit how it is used in the provided context, plus one short example sentence using the word naturally.",
        user: `Word: ${term}${context}\n\nReturn JSON {"result": "<word> — (part of speech) definition; definition", "example": "<example sentence using the word>"}`,
      };
    case "translate":
      if (req.targetLanguage === "en-zh") {
        return {
          system:
            "You are an English-Chinese translator and language tutor. Translate the selected word or phrase into Chinese, choosing the meaning that best fits the provided context. If the selected text is a single word, also state its part of speech as used in context. Then give one short example sentence in English together with its Chinese translation.",
          user: `Selected text (${typeLabel}): ${term}${context}\n\nReturn JSON {"result": "<Chinese translation, with part of speech in parentheses if a single word>", "example": "<English sentence> — <中文翻译>"}`,
        };
      }
      return {
        system:
          "You are an English-English language tutor. Give a concise definition of the selected word or phrase that fits how it is used in the provided context, then one short example sentence using it naturally.",
        user: `Selected text (${typeLabel}): ${term}${context}\n\nReturn JSON {"result": "<concise definition>", "example": "<example sentence using the term>"}`,
      };
    default: {
      const _exhaustive: never = req.action;
      void _exhaustive;
      return {
        system: "You are a helpful reading assistant.",
        user: term,
      };
    }
  }
}

function extractJson(content: string): { result: string; example?: string } {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : content;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    const obj = JSON.parse(raw.slice(start, end + 1));
    return {
      result: String(obj.result ?? obj.text ?? obj.translation ?? "").trim(),
      example: obj.example ? String(obj.example).trim() : undefined,
    };
  }
  return { result: content.trim() };
}

export async function POST(request: Request) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "DeepSeek API key is not configured." },
      { status: 500 }
    );
  }

  let body: LlmRequest;
  try {
    body = (await request.json()) as LlmRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body?.text || !body?.action) {
    return NextResponse.json(
      { error: "Missing 'text' or 'action'." },
      { status: 400 }
    );
  }

  const actions: LlmAction[] = ["simplify", "translate", "define"];
  if (!actions.includes(body.action)) {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  const { system, user } = buildPrompt(body);
  const messages: DeepSeekMessage[] = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];

  try {
    const res = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.3,
        max_tokens: 600,
        response_format: { type: "json_object" },
        stream: false,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      return NextResponse.json(
        { error: `DeepSeek error: ${res.status}`, detail },
        { status: 502 }
      );
    }

    const data = await res.json();
    const content: string =
      data?.choices?.[0]?.message?.content ?? "";

    let parsed: LlmResponse;
    try {
      parsed = extractJson(content);
    } catch {
      parsed = { result: content.trim() };
    }

    if (!parsed.result) {
      return NextResponse.json(
        { error: "Empty response from model." },
        { status: 502 }
      );
    }

    return NextResponse.json(parsed);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to reach DeepSeek.", detail: String(err) },
      { status: 502 }
    );
  }
}
