/** Typed result for Server Actions: never leak raw database errors to the client. */
export type ActionResult<T = undefined, E extends string = string> =
  | (T extends undefined ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: E };
