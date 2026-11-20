/**
 * Paste this file into the other extension. It has no Chrome APIs.
 *
 *   import { createMburoja, registerInstall } from "./mburoja-scan.js";
 *
 *   const { installToken } = await registerInstall(BASE, { installHash, version: "0.1.0" });
 *   const mb = createMburoja({ baseUrl: BASE, token: installToken });
 *   const verdict = await mb.scanMessage({ text, channel: "sms", locale: "sq" });
 *   const fromPicture = await mb.scanImage({ image: dataUrl, locale: "sq" });
 *
 * verdict.score is 0–100. verdict.flag is green, yellow, orange, red, darkred, or grey.
 * verdict.reasons[].text_sq and text_en are the lines to show. verdict.checkId is the stored check.
 * A screenshot is read on the server and is not stored. Send a data URL or raw base64, png/jpeg/webp/gif, under ~1.2 MB.
 * The extension origin must be allowed to call BASE (chrome-extension:// is already accepted).
 */

export async function registerInstall(baseUrl, { installHash, version }) {
  return request(baseUrl, "/api/v1/extension/register", {
    method: "POST",
    body: { installHash, version },
  });
}

export function createMburoja({ baseUrl, token }) {
  const auth = { Authorization: `Bearer ${token}` };
  return {
    scanMessage(input) {
      return request(baseUrl, "/api/v1/scan", { method: "POST", headers: auth, body: input });
    },
    scanImage({ image, mime, locale = "sq", channel = "sms" }) {
      return request(baseUrl, "/api/v1/scan/image", {
        method: "POST",
        headers: auth,
        body: { image, mime, locale, channel },
      });
    },
  };
}

async function request(baseUrl, path, { method, headers, body }) {
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error?.message || `Mburoja ${res.status}`);
    error.code = data.error?.code || "request_failed";
    error.status = res.status;
    throw error;
  }
  return data;
}
