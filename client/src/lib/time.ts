/** Current time in ms. Server components may read the clock; wrapping keeps the purity lint rule precise for client code. */
export function nowMs(): number {
  return Date.now();
}
