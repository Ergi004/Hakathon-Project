/** Defang for display: hxxp:// and [.] (SPEC hard rule 5). Pure, usable from server and client code. */
export function defangValue(v: string): string {
  return v.replace(/^http(s?):\/\//i, "hxxp$1://").replace(/(?<!\[)\.(?!\])/g, "[.]");
}

/** Inverse of defangValue, for normalising before re-defanging. */
export function refangValue(v: string): string {
  return v.replace(/^hxxp/i, "http").replace(/\[\.\]/g, ".");
}
