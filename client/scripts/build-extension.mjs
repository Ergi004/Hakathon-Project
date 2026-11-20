/**
 * Builds the browser extension for Chrome (MV3 service worker) and Firefox (MV3 event page)
 * from the same TypeScript sources: extension/src → extension/dist/{chrome,firefox} + zips.
 *
 *   npm run ext:build                       # API = http://localhost:3000
 *   npm run ext:build -- --api=https://mburoja.example
 */
import { build } from "esbuild";
import JSZip from "jszip";
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "extension");
const src = join(root, "src");
const dist = join(root, "dist");
const apiArg = process.argv.find((a) => a.startsWith("--api="))?.slice(6) ?? "http://localhost:3000";
const api = new URL(apiArg).origin;
const version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;

// ---- icons (generated, no binary files in git) -------------------------------------
const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
const distSeg = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};
/** Blue shield with a white check mark, 4×4 supersampled. */
function iconPng(size) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let shield = 0, check = 0;
      for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) {
        const u = (x + (sx + 0.5) / 4) / size, v = (y + (sy + 0.5) / 4) / size;
        const half = v < 0.08 ? -1 : v <= 0.52 ? 0.36 : 0.36 * (1 - Math.pow((v - 0.52) / 0.42, 1.6));
        if (Math.abs(u - 0.5) <= half) {
          shield++;
          if (Math.min(distSeg(u, v, 0.33, 0.5, 0.46, 0.63), distSeg(u, v, 0.46, 0.63, 0.69, 0.37)) < 0.055) check++;
        }
      }
      const a = shield / 16, c = shield ? check / shield : 0;
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = Math.round(29 + (255 - 29) * c);
      raw[o + 1] = Math.round(78 + (255 - 78) * c);
      raw[o + 2] = Math.round(216 + (255 - 216) * c);
      raw[o + 3] = Math.round(a * 255);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

// ---- manifests -------------------------------------------------------------------------
const icons = { 16: "icons/icon-16.png", 32: "icons/icon-32.png", 48: "icons/icon-48.png", 128: "icons/icon-128.png" };
const base = {
  manifest_version: 3,
  name: "Mburoja – Phishing & Smishing Scanner",
  short_name: "Mburoja",
  version,
  description: "Scan the email you have open (Gmail, Outlook, webmail), an SMS or an .eml file with the Mburoja platform and VirusTotal.",
  icons,
  action: { default_popup: "popup.html", default_title: "Mburoja", default_icon: icons },
  // activeTab + scripting: the open email is read only after a click. No persistent access to any mailbox.
  permissions: ["activeTab", "scripting", "storage", "notifications", "contextMenus"],
  host_permissions: [`${api}/*`],
  optional_host_permissions: ["https://*/*", "http://localhost/*", "http://127.0.0.1/*"],
  content_security_policy: { extension_pages: "script-src 'self'; object-src 'self'" },
};
const manifests = {
  chrome: { ...base, minimum_chrome_version: "116", background: { service_worker: "background.js" } },
  firefox: {
    ...base,
    background: { scripts: ["background.js"] },
    browser_specific_settings: {
      gecko: {
        id: "scanner@mburoja.example",
        strict_min_version: "128.0",
        // Required by addons.mozilla.org: the email/SMS the user chooses to scan is sent to the platform.
        data_collection_permissions: { required: ["personalCommunications"] },
      },
    },
  },
};

// ---- build -----------------------------------------------------------------------------
rmSync(dist, { recursive: true, force: true });
const packages = {};
for (const [target, manifest] of Object.entries(manifests)) {
  const out = join(dist, target);
  mkdirSync(join(out, "icons"), { recursive: true });
  await build({
    entryPoints: { background: join(src, "background.ts"), popup: join(src, "popup", "popup.ts"), extract: join(src, "content", "extract.ts") },
    outdir: out,
    bundle: true,
    format: "iife",
    target: target === "chrome" ? "chrome116" : "firefox128",
    minify: false,
    sourcemap: false,
    legalComments: "none",
    define: { __DEFAULT_SERVER__: JSON.stringify(api) },
    logLevel: "warning",
  });
  cpSync(join(src, "popup", "popup.html"), join(out, "popup.html"));
  cpSync(join(src, "popup", "popup.css"), join(out, "popup.css"));
  for (const s of [16, 32, 48, 128]) writeFileSync(join(out, "icons", `icon-${s}.png`), iconPng(s));
  writeFileSync(join(out, "manifest.json"), JSON.stringify(manifest, null, 2));

  const zip = new JSZip();
  const walk = (dir) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else zip.file(relative(out, p).replace(/\\/g, "/"), readFileSync(p));
    }
  };
  walk(out);
  // manifest.json sits at the archive root, as the Chrome Web Store, Edge Add-ons and AMO require.
  const archive = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 9 } });
  writeFileSync(join(dist, `mburoja-${target}-${version}.zip`), archive);
  // An .xpi is the same zip; Firefox opens it directly (about:debugging, or install once signed by AMO).
  if (target === "firefox") writeFileSync(join(dist, `mburoja-firefox-${version}.xpi`), archive);
  packages[target] = archive;
  console.log(`✓ ${target}: extension/dist/${target}  (API ${api})`);
}

// Downloads served by the public /extension page (public/downloads, not committed).
const downloads = join(root, "..", "public", "downloads");
mkdirSync(downloads, { recursive: true });
writeFileSync(join(downloads, "mburoja-extension.zip"), packages.chrome);
writeFileSync(join(downloads, "mburoja-extension-firefox.xpi"), packages.firefox);
console.log("✓ public/downloads: mburoja-extension.zip, mburoja-extension-firefox.xpi");
for (const f of readdirSync(dist).filter((f) => /\.(zip|xpi)$/.test(f))) {
  console.log(`  extension/dist/${f}  ${(statSync(join(dist, f)).size / 1024).toFixed(1)} KB`);
}
