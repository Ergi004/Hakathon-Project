/** Placeholders allowed in takedown templates (SPEC 11.3). */
export const PLACEHOLDERS = [
  "protocol",
  "campaign_code",
  "domain",
  "imitated_institution",
  "first_seen",
  "report_count",
  "iocs",
  "evidence_summary",
  "analyst_name",
  "org_name",
] as const;
export type TemplateVars = Record<(typeof PLACEHOLDERS)[number], string>;

export class MissingPlaceholderError extends Error {
  constructor(public missing: string[]) {
    super(`Missing template values: ${missing.join(", ")}`);
    this.name = "MissingPlaceholderError";
  }
}

/**
 * Fill {{placeholders}}. Throws if any placeholder has no value or is unknown,
 * so a notice can never go out with {{...}} left in it (SPEC 11.3).
 */
export function render(template: string, vars: Partial<Record<string, string>>): string {
  const missing = new Set<string>();
  const out = template.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_m, key: string) => {
    const v = vars[key];
    if (v === undefined || v === null || v === "") {
      missing.add(key);
      return "";
    }
    return v;
  });
  if (missing.size) throw new MissingPlaceholderError([...missing]);
  if (/\{\{|\}\}/.test(out)) throw new MissingPlaceholderError(["malformed"]);
  return out;
}

/** Split the front matter subject from a template file. */
export function parseTemplateFile(src: string): { subject: string; body: string } {
  const m = src.match(/^---\s*\nsubject:\s*"?(.*?)"?\s*\n---\s*\n([\s\S]*)$/);
  return m ? { subject: m[1], body: m[2].trim() } : { subject: "{{protocol}}", body: src.trim() };
}
