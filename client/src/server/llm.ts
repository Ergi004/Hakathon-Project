import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";

/**
 * Provider-agnostic text generation for explanations only (SPEC 6.6, hard rule 7).
 * Callers pass a fixed instruction plus data; the LLM never decides a verdict.
 * Returns null on any failure or timeout so callers fall back to template text.
 */
const TIMEOUT_MS = 4000;
const cache = new Map<string, { value: string; at: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000;

export async function generateText(opts: {
  instruction: string;
  data: string;
  cacheKey?: string;
}): Promise<string | null> {
  if (opts.cacheKey) {
    const hit = cache.get(opts.cacheKey);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  }

  const provider = process.env.LLM_PROVIDER === "anthropic" ? "anthropic" : "gemini";
  // Data is always quoted inside a fixed wrapper, never concatenated into instructions.
  const userContent = `<data>\n${opts.data}\n</data>`;

  let text: string | null = null;
  try {
    text = provider === "anthropic" ? await viaAnthropic(opts.instruction, userContent) : await viaGemini(opts.instruction, userContent);
  } catch {
    text = null;
  }
  if (text && opts.cacheKey) cache.set(opts.cacheKey, { value: text, at: Date.now() });
  return text;
}

async function viaAnthropic(system: string, user: string): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const client = new Anthropic({ timeout: TIMEOUT_MS, maxRetries: 0 });
  const response = await client.beta.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5",
    max_tokens: 1024,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low" },
    system,
    messages: [{ role: "user", content: user }],
  });
  if (response.stop_reason === "refusal") return null;
  const text = response.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
  return text || null;
}

async function viaGemini(system: string, user: string): Promise<string | null> {
  if (!process.env.GEMINI_API_KEY) return null;
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
      contents: user,
      config: { systemInstruction: system, abortSignal: controller.signal, maxOutputTokens: 300 },
    });
    return response.text?.trim() || null;
  } finally {
    clearTimeout(timer);
  }
}
