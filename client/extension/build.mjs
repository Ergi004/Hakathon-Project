// Builds the unpacked extension into dist/ (load it from chrome://extensions)
// and a zip for the platform's /extension page.
//   MBUROJA_API_URL=https://mburoja.example npm run build
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { deflateSync } from "node:zlib";
import * as esbuild from "esbuild";

const root = import.meta.dirname;
const dist = path.join(root, "dist");
const watch = process.argv.includes("--watch");
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));

const apiUrl = new URL(process.env.MBUROJA_API_URL ?? "http://localhost:3000");
const apiOrigin = apiUrl.origin;

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(path.join(root, "public"), dist, { recursive: true });

const manifest = {
  manifest_version: 3,
  name: "__MSG_extName__",
  description: "__MSG_extDescription__",
  version: pkg.version,
  default_locale: "sq",
  icons: { 16: "icons/16.png", 32: "icons/32.png", 48: "icons/48.png", 128: "icons/128.png" },
  action: { default_popup: "popup.html", default_title: "__MSG_extName__", default_icon: { 16: "icons/16.png", 32: "icons/32.png" } },
  background: { service_worker: "background.js" },
  permissions: ["storage", "activeTab", "scripting"],
  host_permissions: ["https://mail.google.com/*", "https://outlook.live.com/*", "https://outlook.office.com/*", `${apiOrigin}/*`],
  content_scripts: [
    { matches: ["https://mail.google.com/*"], js: ["content-gmail.js"], run_at: "document_idle" },
    { matches: ["https://outlook.live.com/*", "https://outlook.office.com/*"], js: ["content-outlook.js"], run_at: "document_idle" },
  ],
};
writeFileSync(path.join(dist, "manifest.json"), JSON.stringify(manifest, null, 2));

// Icons: a shield with a check mark, drawn as PNG without image dependencies.
function png(size) {
  const px = Buffer.alloc(size * (size * 4 + 1));
  const inShield = (x, y) => {
    const u = (x + 0.5) / size, v = (y + 0.5) / size;
    if (v < 0.08 || v > 0.94) return false;
    const half = v < 0.5 ? 0.38 : 0.38 * Math.sqrt(Math.max(0, (0.94 - v) / 0.44));
    return Math.abs(u - 0.5) <= half;
  };
  const distSeg = (px0, py0, ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((px0 - ax) * dx + (py0 - ay) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(px0 - (ax + t * dx), py0 - (ay + t * dy));
  };
  for (let y = 0; y < size; y++) {
    px[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const o = y * (size * 4 + 1) + 1 + x * 4;
      if (!inShield(x, y)) continue;
      const u = (x + 0.5) / size, v = (y + 0.5) / size;
      const check = Math.min(distSeg(u, v, 0.32, 0.5, 0.45, 0.63), distSeg(u, v, 0.45, 0.63, 0.7, 0.36)) < 0.055;
      const [r, g, b] = check ? [255, 255, 255] : [13, 148, 136];
      px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 255;
    }
  }
  const crc = (buf) => { let c = ~0; for (const byte of buf) { c ^= byte; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(px)), chunk("IEND", Buffer.alloc(0))]);
}
mkdirSync(path.join(dist, "icons"), { recursive: true });
for (const s of [16, 32, 48, 128]) writeFileSync(path.join(dist, "icons", `${s}.png`), png(s));

const options = {
  entryPoints: {
    background: "src/background.ts",
    "content-gmail": "src/content/gmail.ts",
    "content-outlook": "src/content/outlook.ts",
    popup: "src/popup/popup.ts",
  },
  absWorkingDir: root,
  outdir: dist,
  bundle: true,
  format: "iife",
  target: "chrome120",
  minify: !watch,
  sourcemap: watch ? "inline" : false,
  define: { __API_URL__: JSON.stringify(apiOrigin), __VERSION__: JSON.stringify(pkg.version) },
  logLevel: "info",
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log(`Watching… API ${apiOrigin}. Reload the extension in chrome://extensions after changes.`);
} else {
  await esbuild.build(options);
  // Zip for the platform's /extension download button.
  const zipDir = path.join(root, "..", "public", "downloads");
  try {
    mkdirSync(zipDir, { recursive: true });
    const zip = path.join(zipDir, "mburoja-extension.zip");
    if (existsSync(zip)) rmSync(zip);
    execFileSync("zip", ["-qr", zip, "."], { cwd: dist });
    console.log(`Zip: ${path.relative(path.join(root, ".."), zip)}`);
  } catch {
    console.log("zip not available: skipped the download archive (dist/ is still complete).");
  }
  console.log(`Built dist/ for API ${apiOrigin}. Load it with chrome://extensions → Load unpacked.`);
}
