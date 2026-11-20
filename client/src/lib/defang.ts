/** Defang / refang for display (pure: usable from server and client components). */
export function defangValue(v: string): string {
  return v.replace(/^http(s?):\/\//i, "hxxp$1://").replace(/(?<!\[)\.(?!\])/g, "[.]");
}

export function refangValue(v: string): string {
  return v.replace(/^hxxp/i, "http").replace(/\[\.\]/g, ".");
}
