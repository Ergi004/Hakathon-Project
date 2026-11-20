import "server-only";

import { GoogleGenAI } from "@google/genai";
import { AI_JSON_SCHEMA, SYSTEM_INSTRUCTION } from "./schema";

export interface ProviderCall {
  provider: "ollama" | "gemini";
  model: string;
  status: "ok" | "unavailable" | "refused";
  json: unknown;
  latencyMs: number;
  tokens: number | null;
}

const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 15_000;

export function ollamaConfig() {
  return { url: process.env.OLLAMA_URL?.replace(/\/$/, "") || null, model: process.env.OLLAMA_MODEL || "llama3.1:8b" };
}

export function geminiConfig() {
  return { key: process.env.GEMINI_API_KEY || null, model: process.env.GEMINI_MODEL || "gemini-3.8-flash" };
}

function parseJson(text: string | undefined | null): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    return null;
  }
}

/**
 * Local Ollama (operator-configured OLLAMA_URL, never a user-supplied address).
 * Uses structured outputs via `format` with the JSON schema.
 */
export async function callOllama(userContent: string): Promise<ProviderCall> {
  const cfg = ollamaConfig();
  const started = Date.now();
  const base = { provider: "ollama" as const, model: cfg.model, tokens: null };
  if (!cfg.url) return { ...base, status: "unavailable", json: null, latencyMs: 0 };
  try {
    const res = await fetch(`${cfg.url}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: cfg.model,
        stream: false,
        format: AI_JSON_SCHEMA,
        options: { temperature: 0 },
        messages: [
          { role: "system", content: SYSTEM_INSTRUCTION },
          { role: "user", content: userContent },
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return { ...base, status: "unavailable", json: null, latencyMs: Date.now() - started };
    const body = (await res.json()) as { message?: { content?: string }; eval_count?: number; prompt_eval_count?: number };
    return {
      ...base,
      status: "ok",
      json: parseJson(body.message?.content),
      latencyMs: Date.now() - started,
      tokens: (body.eval_count ?? 0) + (body.prompt_eval_count ?? 0) || null,
    };
  } catch {
    return { ...base, status: "unavailable", json: null, latencyMs: Date.now() - started };
  }
}

/** Google Gemini with schema-constrained JSON output. Key and model come from server env only. */
export async function callGemini(userContent: string): Promise<ProviderCall> {
  const cfg = geminiConfig();
  const started = Date.now();
  const base = { provider: "gemini" as const, model: cfg.model };
  if (!cfg.key) return { ...base, status: "unavailable", json: null, latencyMs: 0, tokens: null };
  const ai = new GoogleGenAI({ apiKey: cfg.key });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const request = () =>
    ai.models.generateContent({
      model: cfg.model,
      contents: userContent,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseJsonSchema: AI_JSON_SCHEMA,
        temperature: 0,
        maxOutputTokens: 800,
        abortSignal: controller.signal,
      },
    });
  try {
    let res;
    try {
      res = await request();
    } catch (e) {
      // One bounded retry with backoff for transient overload (503 / 429), within the same overall timeout.
      const transient = e instanceof Error && /\b(503|429|UNAVAILABLE|RESOURCE_EXHAUSTED)\b/.test(e.message);
      if (!transient || controller.signal.aborted) throw e;
      await new Promise((r) => setTimeout(r, 1500));
      res = await request();
    }
    const blocked = res.promptFeedback?.blockReason || res.candidates?.[0]?.finishReason === "SAFETY";
    return {
      ...base,
      status: blocked ? "refused" : "ok",
      json: blocked ? null : parseJson(res.text),
      latencyMs: Date.now() - started,
      tokens: res.usageMetadata?.totalTokenCount ?? null,
    };
  } catch {
    return { ...base, status: "unavailable", json: null, latencyMs: Date.now() - started, tokens: null };
  } finally {
    clearTimeout(timer);
  }
}
