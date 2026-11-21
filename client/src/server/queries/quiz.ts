import "server-only";

import type { QuizItem } from "@/components/learn/spot-the-scam";
import { GUIDES } from "@/content/learn";
import type { Locale } from "@/i18n/routing";
import { analyze } from "@/server/detection";
import { loadContext } from "@/server/detection/load-context";
import { getQuizPool } from "./public";

/** Quiz messages with the reasons the engine gives for each scam. */
export async function getQuizItems(locale: Locale): Promise<QuizItem[]> {
  const pool = await getQuizPool();
  if (pool.length < 4) {
    // No dataset yet: guide examples (all scams) keep the game playable.
    return GUIDES.map((g) => ({ id: g.slug, text: g.example.text[locale], scam: true, channel: g.example.channel, why: g.signs.slice(0, 2).map((s) => s[locale]) }));
  }
  const ctx = await loadContext();
  return Promise.all(
    pool.map(async (p) => {
      const r = await analyze({ kind: "text", text: p.text, channel: p.channel, locale }, ctx);
      return { ...p, why: p.scam ? r.reasons.filter((x) => x.weight > 0).slice(0, 2).map((x) => (locale === "en" ? x.text_en : x.text_sq)) : [] };
    }),
  );
}
