/** Server-side pagination helpers (?page=N in the URL, used with the shared <Pager />). */
export function pageParam(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

/** Inclusive [from, to] for Supabase .range(). */
export function pageRange(page: number, size: number): [number, number] {
  return [(page - 1) * size, page * size - 1];
}

export function pageCount(total: number | null | undefined, size: number): number {
  return Math.max(1, Math.ceil((total ?? 0) / size));
}
