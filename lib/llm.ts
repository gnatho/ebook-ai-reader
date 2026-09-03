import type { LlmRequest, LlmResponse } from "./types";

export class LlmError extends Error {
  code?: string | number;
  status?: number;

  constructor(message: string, code?: string | number, status?: number) {
    super(message);
    this.name = "LlmError";
    this.code = code;
    this.status = status;
  }
}

export async function callLlm(req: LlmRequest): Promise<LlmResponse> {
  const res = await fetch("/api/llm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      code?: string | number;
      detail?: unknown;
    };

    const code = data?.code ?? res.status;
    const detailSummary =
      data?.detail && typeof data.detail === "object"
        ? Object.entries(data.detail as Record<string, unknown>)
            .filter(([, value]) => value !== null && value !== undefined)
            .map(([key, value]) => `${key}=${String(value)}`)
            .join(", ")
        : undefined;

    const message =
      [data?.error, `(code: ${code})`, detailSummary]
        .filter(Boolean)
        .join(" ") || `Request failed (${res.status})`;

    throw new LlmError(message, code, res.status);
  }

  return (await res.json()) as LlmResponse;
}
