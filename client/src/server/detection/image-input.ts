const MIME = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
export type ImageMime = (typeof MIME)[number];

const MAX_CHARS = 1_600_000;

/** Split a data URL or raw base64 payload. Rejects anything that is not a small screenshot. */
export function parseImagePayload(input: string, mimeHint?: string): { mime: ImageMime; data: string } | null {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > MAX_CHARS) return null;
  const dataUrl = trimmed.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,([a-z0-9+/=\s]+)$/i);
  if (dataUrl) {
    const mime = dataUrl[1].toLowerCase() as ImageMime;
    const data = dataUrl[2].replace(/\s/g, "");
    return data.length > 0 ? { mime, data } : null;
  }
  const mime = mimeHint?.toLowerCase();
  if (!mime || !MIME.includes(mime as ImageMime)) return null;
  const data = trimmed.replace(/\s/g, "");
  if (!/^[a-z0-9+/=]+$/i.test(data)) return null;
  return { mime: mime as ImageMime, data };
}
