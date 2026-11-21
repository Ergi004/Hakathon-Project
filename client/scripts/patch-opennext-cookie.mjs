import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const candidates = [
  "node_modules/@opennextjs/cloudflare/node_modules/@opennextjs/aws/dist/overrides/converters/edge.js",
  "node_modules/@opennextjs/cloudflare/node_modules/@opennextjs/aws/dist/overrides/converters/node.js",
  "node_modules/@opennextjs/aws/dist/overrides/converters/edge.js",
  "node_modules/@opennextjs/aws/dist/overrides/converters/node.js",
];

const root = process.cwd();
let patched = 0;

for (const relative of candidates) {
  const file = join(root, relative);
  if (!existsSync(file)) continue;
  const original = readFileSync(file, "utf8");
  const next = original
    .replace('import cookieParser from "cookie";', 'import { parse as parseCookie } from "cookie";')
    .replaceAll("cookieParser.parse(", "parseCookie(");
  if (next === original) continue;
  writeFileSync(file, next);
  patched += 1;
  console.log(`patched ${relative}`);
}

if (patched === 0) {
  console.log("OpenNext cookie import already uses a named parse export.");
}
