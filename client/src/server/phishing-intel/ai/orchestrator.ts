import "server-only";

import type { ScanOptions } from "@/lib/schemas/phishing-intel";
import { containsPii } from "@/server/detection/masks";
import { callGemini, callOllama, geminiConfig, ollamaConfig, type ProviderCall } from "./providers";
import { minimise, PROMPT_VERSION, validateAiOutput, type AiOutput } from "./schema";

export interface AiRun {
  status: "completed" | "skipped" | "unavailable";
  output: AiOutput | null;
  provider: "ollama" | "gemini" | null;
  model: string | null;
  policy: string;
  calls: (Omit<ProviderCall, "json"> & { validation: "ok" | string })[];
  note?: string;
}

const flag = (name: string, fallback: boolean) => {
  const v = process.env[name];
  return v === undefined ? fallback : v === "true" || v === "1";
};

export function aiPolicy() {
  return {
    defaultProvider: (process.env.AI_DEFAULT_PROVIDER || "ollama") as "ollama" | "gemini",
    cloudEscalation: flag("AI_CLOUD_ESCALATION_ENABLED", true),
    localOnly: flag("AI_LOCAL_ONLY", false),
    allowedClasses: (process.env.AI_CLOUD_ALLOWED_DATA_CLASSIFICATION || "low,moderate").split(",").map((s) => s.trim()),
    ollamaConfigured: Boolean(ollamaConfig().url),
    geminiConfigured: Boolean(geminiConfig().key),
  };
}

/**
 * deterministic analysis → Ollama local pass → policy gate → Gemini escalation
 * when justified → schema + evidence validation (PDF §8). Advisory only: the
 * caller never lets this change the risk score or verdict.
 */
export async function runAi(input: {
  text: string;
  subject?: string;
  channel: string;
  signals: string[];
  risk: number;
  options: ScanOptions;
}): Promise<AiRun> {
  const policy = aiPolicy();
  const runBase = { output: null, provider: null, model: null, calls: [] as AiRun["calls"] };
  if (input.options.aiMode === "off") return { ...runBase, status: "skipped", policy: "disabled_by_request" };
  if (!input.text.trim() && !input.subject) return { ...runBase, status: "skipped", policy: "no_text" };

  const raw = [input.subject, input.text].filter(Boolean).join("\n");
  const dataClass = containsPii(raw) ? "moderate" : "low";
  const minimised = minimise(raw);
  const userContent = `<data>\nchannel: ${input.channel}\nsignals: ${input.signals.slice(0, 15).join(", ") || "none"}\nmessage:\n"""\n${minimised}\n"""\n</data>`;

  const calls: AiRun["calls"] = [];
  const attempt = async (fn: (c: string) => Promise<ProviderCall>) => {
    const call = await fn(userContent);
    const { json, ...meta } = call;
    if (call.status !== "ok") {
      calls.push({ ...meta, validation: call.status });
      return null;
    }
    const v = validateAiOutput(json, minimised);
    calls.push({ ...meta, validation: v.ok ? "ok" : v.reason });
    return v.ok ? { output: v.value, call } : null;
  };

  let result: { output: AiOutput; call: ProviderCall } | null = null;
  const tryLocal = policy.ollamaConfigured && (policy.defaultProvider === "ollama" || input.options.aiMode === "local");
  if (tryLocal) result = await attempt(callOllama);

  const cloudAllowed =
    input.options.aiMode === "hybrid" &&
    input.options.allowCloudAnalysis &&
    !policy.localOnly &&
    policy.cloudEscalation &&
    policy.geminiConfigured &&
    policy.allowedClasses.includes(dataClass);
  // Escalate when the local pass is missing/invalid, or the case sits in the grey zone.
  const justified = !result || (input.risk >= 30 && input.risk <= 75 && result.output.confidence < 0.5);
  let policyName = tryLocal ? "local_first" : "cloud_only";
  if (cloudAllowed && justified) {
    const cloud = await attempt(callGemini);
    if (cloud) {
      result = cloud;
      policyName += "+cloud_escalation";
    }
  } else if (!cloudAllowed && !result) {
    policyName += policy.localOnly ? "+local_only" : `+cloud_blocked(${dataClass})`;
  }

  if (!result) {
    return { ...runBase, calls, status: calls.length ? "unavailable" : "skipped", policy: policyName, note: "AI analysis unavailable; rules-based result only" };
  }
  return { status: "completed", output: result.output, provider: result.call.provider, model: result.call.model, policy: policyName, calls };
}

export { PROMPT_VERSION };
