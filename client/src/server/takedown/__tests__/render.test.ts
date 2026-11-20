import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MissingPlaceholderError, parseTemplateFile, PLACEHOLDERS, render } from "../render";

const full = Object.fromEntries(PLACEHOLDERS.map((p) => [p, `<${p}>`]));
const dir = path.join(process.cwd(), "src/server/takedown/templates");

describe("render(template)", () => {
  it("fills every placeholder", () => {
    expect(render("A {{protocol}} B {{ domain }}", { protocol: "SOC-2026/000001", domain: "x[.]example" })).toBe("A SOC-2026/000001 B x[.]example");
  });

  it("throws when a placeholder is missing", () => {
    expect(() => render("Hi {{protocol}} {{domain}}", { protocol: "P" })).toThrow(MissingPlaceholderError);
    try {
      render("{{iocs}} {{protocol}}", {});
    } catch (e) {
      expect((e as MissingPlaceholderError).missing.sort()).toEqual(["iocs", "protocol"]);
    }
  });

  it("throws on empty values", () => {
    expect(() => render("{{domain}}", { domain: "" })).toThrow(MissingPlaceholderError);
  });

  it("all six shipped templates render with no leftovers", () => {
    const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
    expect(files).toHaveLength(6);
    for (const f of files) {
      const t = parseTemplateFile(readFileSync(path.join(dir, f), "utf8"));
      const body = render(t.body, full);
      const subject = render(t.subject, full);
      expect(body).not.toMatch(/\{\{|\}\}/);
      expect(subject).toContain("<protocol>");
    }
  });
});
