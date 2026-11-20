/**
 * Defang for display: hxxp:// and [.] (SPEC hard rule 5). Pure and usable from
 * both Server and Client Components (kept out of the "use client" component file).
 */
export function defangValue(v: string): string {
  return v.replace(/^http(s?):\/\//i, "hxxp$1://").replace(/(?<!\[)\.(?!\])/g, "[.]");
}

export function refangValue(v: string): string {
  return v.replace(/^hxxp/i, "http").replace(/\[\.\]/g, ".");
}
