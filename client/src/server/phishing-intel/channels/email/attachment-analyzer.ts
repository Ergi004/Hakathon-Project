import { createHash } from "node:crypto";
import type { AttachmentMeta, Finding } from "../../types";

/** Magic-byte signatures. Files are hashed and sniffed, never opened, unpacked or executed (PDF §12). */
const SIGNATURES: { type: string; test: (b: Uint8Array) => boolean }[] = [
  { type: "pe_executable", test: (b) => b[0] === 0x4d && b[1] === 0x5a },
  { type: "elf_executable", test: (b) => b[0] === 0x7f && b[1] === 0x45 && b[2] === 0x4c && b[3] === 0x46 },
  { type: "zip", test: (b) => b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05) },
  { type: "rar", test: (b) => b[0] === 0x52 && b[1] === 0x61 && b[2] === 0x72 && b[3] === 0x21 },
  { type: "7z", test: (b) => b[0] === 0x37 && b[1] === 0x7a && b[2] === 0xbc && b[3] === 0xaf },
  { type: "gzip", test: (b) => b[0] === 0x1f && b[1] === 0x8b },
  { type: "pdf", test: (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 },
  { type: "ole", test: (b) => b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0 },
  { type: "png", test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { type: "jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: "iso", test: (b) => b.length > 0x8006 && b[0x8001] === 0x43 && b[0x8002] === 0x44 && b[0x8003] === 0x30 },
];

const EXT_EXPECTS: Record<string, string[]> = {
  pdf: ["pdf"],
  png: ["png"],
  jpg: ["jpeg"],
  jpeg: ["jpeg"],
  docx: ["zip"],
  xlsx: ["zip"],
  pptx: ["zip"],
  zip: ["zip"],
  doc: ["ole"],
  xls: ["ole"],
  txt: [],
};

export function sniff(bytes: Uint8Array): string | undefined {
  return SIGNATURES.find((s) => s.test(bytes))?.type;
}

export function fromContent(name: string, mime: string, content: Uint8Array): AttachmentMeta {
  return {
    name,
    mime,
    size: content.byteLength,
    sha256: createHash("sha256").update(content).digest("hex"),
    detectedType: sniff(content),
  };
}

/** Signature checks on top of the name-based rules in detection/attachments.ts. */
export function analyzeAttachments(list: AttachmentMeta[]): Finding[] {
  const findings: Finding[] = [];
  for (const a of list) {
    const ext = a.name.toLowerCase().split(".").pop() ?? "";
    const expected = EXT_EXPECTS[ext];
    if (a.detectedType && expected && !expected.includes(a.detectedType)) {
      const exec = a.detectedType.endsWith("executable");
      findings.push({
        code: exec ? "disguised_executable" : "type_mismatch",
        detail: `${a.name} claims to be .${ext} but its content is ${a.detectedType}`,
        evidence: a.name,
        weight: exec ? 25 : 8,
      });
    }
    if (/html?$/i.test(ext) || /text\/html/i.test(a.mime)) {
      findings.push({ code: "html_attachment", detail: `${a.name} is an HTML file, often used for fake login pages`, evidence: a.name, weight: 10 });
    }
    if (/\.(svg)$/i.test(a.name)) findings.push({ code: "svg_attachment", detail: `${a.name} is an SVG image, which can carry scripts and links`, evidence: a.name, weight: 6 });
    if (/^(iso|img|vhdx?)$/.test(ext) || a.detectedType === "iso") {
      findings.push({ code: "disk_image", detail: `${a.name} is a disk image, a common malware container`, evidence: a.name, weight: 10 });
    }
  }
  return findings;
}
