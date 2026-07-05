import type { LlmRequest, LlmResponse } from "./types";

export async function callLlm(req: LlmRequest): Promise<LlmResponse> {
  const res = await fetch("/api/llm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error ?? `Request failed (${res.status})`);
  }

  return (await res.json()) as LlmResponse;
}
