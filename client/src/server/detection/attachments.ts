import type { AnalysisInput } from "./types";

const EXEC = /\.(exe|scr|bat|cmd|com|pif|js|jse|vbs|vbe|wsf|msi|jar|ps1|hta|lnk|iso|img|apk|docm|xlsm|pptm|dotm|xlam)$/i;
const EXEC_MIME = /(x-msdownload|x-msdos-program|x-executable|java-archive|macroenabled|vnd\.android\.package-archive)/i;
const ARCHIVE = /\.(zip|rar|7z|tar|gz|tgz|cab|ace)$/i;
const DOUBLE_EXT = /\.(pdf|docx?|xlsx?|pptx?|jpe?g|png|txt|rtf)\.(exe|scr|js|bat|cmd|com|vbs|pif|hta|lnk)$/i;

export interface AttachmentFinding {
  exec?: string;
  archive?: string;
  doubleExt?: string;
}

export function scoreAttachments(attachments: AnalysisInput["attachments"] = []): AttachmentFinding {
  const f: AttachmentFinding = {};
  for (const a of attachments) {
    const name = a.name.trim();
    if (!f.doubleExt && DOUBLE_EXT.test(name)) f.doubleExt = name;
    if (!f.exec && (EXEC.test(name) || EXEC_MIME.test(a.mime))) f.exec = name;
    if (!f.archive && ARCHIVE.test(name)) f.archive = name;
  }
  return f;
}
