import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { dirname, join } from "path";

const root = process.cwd();
const cacheRoot = join(root, ".open-next", "cache");
const assetsRoot = join(root, ".open-next", "assets");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (name.endsWith(".cache") && path.includes(`${join("route-cache", "APP_PAGE")}`)) out.push(path);
  }
  return out;
}

function routeFromCache(file) {
  const marker = `${join("$")}`;
  const at = file.lastIndexOf(marker);
  if (at < 0) return null;
  const route = file.slice(at + marker.length).replace(/\.cache$/, "").replaceAll("\\", "/");
  if (!route || route.split("/").some((part) => part.startsWith("_"))) return null;
  return route;
}

let written = 0;
for (const file of walk(cacheRoot)) {
  const route = routeFromCache(file);
  if (!route) continue;
  const page = JSON.parse(readFileSync(file, "utf8"));
  if (typeof page.html !== "string" || typeof page.rsc !== "string") continue;
  const htmlPath = join(assetsRoot, `${route}.html`);
  const rscPath = join(assetsRoot, `${route}.rsc`);
  mkdirSync(dirname(htmlPath), { recursive: true });
  writeFileSync(htmlPath, page.html);
  writeFileSync(rscPath, page.rsc);
  written += 1;
}

console.log(`exported ${written} prerendered pages into Worker assets`);
