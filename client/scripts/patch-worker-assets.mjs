import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const file = join(process.cwd(), ".open-next", "worker.js");
const marker = "Serve prerendered pages from assets";
const original = readFileSync(file, "utf8");
if (original.includes(marker)) {
  console.log("Worker already serves prerendered pages from assets.");
  process.exit(0);
}

const needle = "const url = new URL(request.url);";
const insert = `${needle}
            // ${marker} so the free-plan CPU limit is not spent re-rendering them.
            if (request.method === "GET" && !request.headers.get("next-action")) {
                const path = url.pathname;
                const last = path.split("/").pop() ?? "";
                if (!last.includes(".") && !path.startsWith("/api") && !path.startsWith("/_next")) {
                    const isRsc = url.searchParams.has("_rsc") || request.headers.get("rsc") === "1";
                    const bare = path.endsWith("/") ? path.slice(0, -1) : path;
                    const assetUrl = new URL(request.url);
                    assetUrl.pathname = \`\${bare || "/index"}.\${isRsc ? "rsc" : "html"}\`;
                    assetUrl.search = "";
                    const asset = await env.ASSETS.fetch(new Request(assetUrl, { method: "GET" }));
                    if (asset.ok) {
                        if (!isRsc) return asset;
                        const headers = new Headers(asset.headers);
                        headers.set("content-type", "text/x-component");
                        return new Response(asset.body, { status: 200, headers });
                    }
                }
            }`;

if (!original.includes(needle)) {
  console.error("Could not find the request URL line in .open-next/worker.js");
  process.exit(1);
}

writeFileSync(file, original.replace(needle, insert));
console.log("patched .open-next/worker.js");
