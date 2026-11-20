import { getLocale } from "next-intl/server";
import { GUIDES } from "@/content/learn";
import { getExampleMessages } from "@/server/queries/public";
import { CheckBox, type CheckExample } from "./check-box";

const short = (s: string) => (s.length > 34 ? `${s.slice(0, 32).trimEnd()}…` : s);

/** Example chips from real (masked) dataset messages, with guide examples as a fallback. */
export async function CheckBoxWithExamples({ hero = false }: { hero?: boolean }) {
  const locale = (await getLocale()) as "sq" | "en";
  const rows = await getExampleMessages(4);
  const examples: CheckExample[] = rows.length
    ? rows.map((m) => ({ label: short(m.text), tab: "message", value: m.text, sender: m.sender ?? undefined }))
    : GUIDES.slice(0, 4).map((g) => ({ label: g.title[locale], tab: "message", value: g.example.text[locale], sender: g.example.sender }));
  return <CheckBox hero={hero} examples={examples} />;
}
