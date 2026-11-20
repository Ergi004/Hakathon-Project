"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const SAMPLE = JSON.stringify({ kind: "url", urls: ["hxxps://1ezhe-gov[.]al[.]example/pagesa"], channel: "sms", locale: "sq" }, null, 2);

export function TryScan() {
  const t = useTranslations("apiDocs");
  const [key, setKey] = useState("");
  const [body, setBody] = useState(SAMPLE);
  const [out, setOut] = useState<{ status: number; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/v1/scan", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key.trim()}` }, body });
      const text = await res.text();
      let pretty = text;
      try {
        pretty = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        /* not JSON */
      }
      setOut({ status: res.status, text: pretty });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={send} className="glass-card space-y-4 rounded-xl p-5">
      <h2 className="font-display text-lg font-medium">{t("tryIt")}</h2>
      <div className="space-y-1.5">
        <Label htmlFor="try-key">{t("apiKey")}</Label>
        <Input id="try-key" type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="mbk_…" className="font-mono" autoComplete="off" />
        <p className="text-xs text-muted-foreground">{t("keyNote")}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="try-body">{t("body")}</Label>
        <Textarea id="try-body" value={body} onChange={(e) => setBody(e.target.value)} rows={7} className="font-mono text-xs" spellCheck={false} />
      </div>
      <Button type="submit" disabled={busy || !key.trim()}>{busy ? t("sending") : t("send")}</Button>
      {out && (
        <div className="space-y-1" aria-live="polite">
          <p className="text-sm">{t("status")}: <span className="font-mono">{out.status}</span></p>
          <pre className="max-h-96 overflow-auto rounded-lg bg-muted p-3 text-xs">{out.text}</pre>
        </div>
      )}
    </form>
  );
}
