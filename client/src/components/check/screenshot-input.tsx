"use client";

import jsQR from "jsqr";
import { ImagePlus, Loader2, QrCode, ShieldCheck, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { DefangedText } from "@/components/shared/defanged-text";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PreparedShot {
  /** JPEG data URL, downscaled and re-encoded on the device (EXIF such as GPS location removed). */
  dataUrl: string;
  name: string;
  /** Links decoded on the device from a QR code in the image. */
  qrUrls: string[];
}

/** Longest side sent for recognition: enough for small print, small enough for the upload limit. */
const MAX_SIDE = 1600;
/** Base64 budget under the server's 1.6 MB payload cap. */
const MAX_DATA_URL = 1_400_000;
const MAX_FILE_BYTES = 15 * 1024 * 1024;

async function prepare(file: File): Promise<PreparedShot | "notImage" | "tooLarge"> {
  if (!file.type.startsWith("image/")) return "notImage";
  if (file.size > MAX_FILE_BYTES) return "tooLarge";
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return "notImage";
  // White backdrop so transparent PNGs stay legible as JPEG.
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const code = jsQR(pixels.data, pixels.width, pixels.height);
  const qrUrls = code?.data && /^(https?:\/\/|www\.)\S+$/i.test(code.data.trim()) ? [code.data.trim()] : [];

  let dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  for (const q of [0.7, 0.55]) if (dataUrl.length > MAX_DATA_URL) dataUrl = canvas.toDataURL("image/jpeg", q);
  if (dataUrl.length > MAX_DATA_URL) return "tooLarge";
  return { dataUrl, name: file.name || "screenshot", qrUrls };
}

/** Choose, drop or paste a screenshot. The image is prepared on the device before it is sent. */
export function ScreenshotInput({ value, onChange, active }: { value: PreparedShot | null; onChange: (shot: PreparedShot | null) => void; active: boolean }) {
  const tc = useTranslations("check");
  const t = (k: "drop" | "hint" | "preparing" | "prepared" | "previewAlt" | "remove" | "qrFound" | "notImage" | "tooLarge") => tc(`image.${k}`);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [problem, setProblem] = useState<"notImage" | "tooLarge" | null>(null);

  async function take(file: File | undefined | null) {
    if (!file) return;
    setProblem(null);
    setBusy(true);
    try {
      const r = await prepare(file);
      if (typeof r === "string") setProblem(r);
      else onChange(r);
    } catch {
      setProblem("notImage");
    } finally {
      setBusy(false);
    }
  }

  // Paste a screenshot straight from the clipboard while this tab is open.
  useEffect(() => {
    if (!active) return;
    const onPaste = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith("image/"));
      if (!item) return;
      e.preventDefault();
      void take(item.getAsFile());
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });

  if (value) {
    return (
      <div className="space-y-2">
        <div className="relative flex items-start gap-4 rounded-xl border border-border bg-background/60 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview, never uploaded as-is */}
          <img src={value.dataUrl} alt={t("previewAlt")} className="max-h-56 w-auto max-w-[45%] rounded-lg border border-border object-contain" />
          <div className="min-w-0 flex-1 space-y-2 pt-1 text-sm">
            <p className="truncate font-medium">{value.name}</p>
            <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="size-3.5 text-flag-green" aria-hidden="true" />{t("prepared")}</p>
            {value.qrUrls.map((u) => (
              <p key={u} className="flex flex-wrap items-center gap-1.5 text-xs"><QrCode className="size-3.5 text-primary" aria-hidden="true" />{t("qrFound")} <DefangedText value={u} revealable={false} /></p>
            ))}
          </div>
          <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 size-8" onClick={() => onChange(null)} aria-label={t("remove")}>
            <X className="size-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label
        htmlFor="chk-shot"
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); void take(e.dataTransfer.files?.[0]); }}
        className={cn(
          "flex min-h-44 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors focus-within:ring-2 focus-within:ring-ring",
          dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-accent",
        )}
      >
        {busy ? <Loader2 className="size-8 animate-spin text-primary" aria-hidden="true" /> : <ImagePlus className="size-8 text-primary" aria-hidden="true" />}
        <span className="font-medium">{busy ? t("preparing") : t("drop")}</span>
        <span className="text-sm text-muted-foreground">{t("hint")}</span>
        <input ref={inputRef} id="chk-shot" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/heic" className="sr-only" onChange={(e) => { void take(e.target.files?.[0]); e.target.value = ""; }} />
      </label>
      {problem && <p className="text-sm text-destructive" role="alert">{t(problem)}</p>}
    </div>
  );
}
