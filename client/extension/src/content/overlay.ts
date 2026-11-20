import { API_URL } from "../lib/api";
import { FLAG_COLOR, FLAG_ICON, t, uiLocale } from "../lib/i18n";
import type { ExtractedEmail, IntelDomain, ScanView, StepKey, ToBackground, ToContent } from "../lib/types";
import { h, svg } from "./dom";
import { CSS } from "./styles";

const GROUP_CAPS: Record<string, number> = { links: 30, content: 25, sender: 25, attachments: 10, reputation: 10 };
const STEPS: StepKey[] = ["read", "local", "engine", "intel", "report"];
const R = 28;
const C = 2 * Math.PI * R;

type Kid = Node | string | null | undefined | false;
const add = (el: Element, ...kids: Kid[]) => el.append(...(kids.filter((k) => k !== null && k !== undefined && k !== false) as (Node | string)[]));

export interface OverlayHooks { isOpen: () => boolean; extract: () => ExtractedEmail | null }

function verdictKey(status: string, verdict: string) {
  if (status === "pending") return "pending";
  if (["unavailable", "error", "skipped"].includes(status)) return "unavailable";
  return verdict === "unknown" ? "checked" : verdict;
}

export function mountOverlay(hooks: OverlayHooks) {
  const locale = uiLocale();
  const host = h("div", { id: "mburoja-root" });
  const shadow = host.attachShadow({ mode: "closed" });
  shadow.append(h("style", {}, CSS));

  // ---- persistent elements (updated in place so transitions run smoothly) ----
  const fab = h("button", { class: "fab", type: "button", "data-fid": "fab" });
  const elapsed = h("span", { class: "elapsed", "aria-hidden": "true" });
  const barFill = h("span");
  const bar = h("div", { class: "bar", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100", "aria-label": t("progress") }, barFill);
  const phaseText = h("span");
  const phasePct = h("span", { class: "elapsed" });
  const ringVal = svg("circle", { class: "val", cx: "34", cy: "34", r: String(R), fill: "none", "stroke-width": "8", "stroke-linecap": "round", transform: "rotate(-90 34 34)", "stroke-dasharray": `0 ${C}` });
  const ringNum = svg("text", { x: "34", y: "40", "text-anchor": "middle", "font-size": "19", "font-weight": "700", fill: "currentColor" });
  const ring = svg("svg", { class: "ring", width: "68", height: "68", viewBox: "0 0 68 68", role: "img" },
    svg("circle", { cx: "34", cy: "34", r: String(R), fill: "none", stroke: "var(--track)", "stroke-width": "8" }), ringVal, ringNum);
  const pill = h("span", { class: "pill" });
  const heroSub = h("div", { class: "sub" });
  const subject = h("div", { class: "subject" });
  const body = h("div");
  const reportBox = h("div", { class: "report", hidden: true });
  const live = h("div", { "aria-live": "polite", style: "position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)" });

  const card = h("div", { class: "card", role: "dialog", "aria-label": t("extName"), hidden: true },
    h("div", { class: "head" },
      h("span", { class: "title" }, "🛡 ", t("extName")),
      h("span", {}, elapsed, h("button", { class: "icon-btn", type: "button", "aria-label": t("minimize"), title: t("minimize"), "data-fid": "min", onclick: () => hide() }, "–"),
        h("button", { class: "icon-btn", type: "button", "aria-label": t("close"), title: t("close"), "data-fid": "close", onclick: () => hide() }, "×")),
    ),
    bar,
    h("div", { class: "phase" }, phaseText, phasePct),
    h("div", { class: "scroll" },
      h("div", { class: "hero" }, ring, h("div", { style: "min-width:0" }, pill, heroSub, subject)),
      body,
    ),
    reportBox,
    h("div", { class: "foot" },
      h("button", { class: "btn ghost", type: "button", "data-fid": "rescan", onclick: () => scan() }, "↻ ", t("rescan")),
      h("a", { href: `${API_URL}/${locale}/check`, target: "_blank", rel: "noopener noreferrer", class: "muted" }, t("openPlatform"), " ↗"),
    ),
    live,
  );
  shadow.append(fab, card);
  document.documentElement.append(host);

  // ---- state ----
  let port: chrome.runtime.Port | null = null;
  let view: ScanView | null = null;
  let tab: "reasons" | "links" | "breakdown" = "reasons";
  let always = false;
  const openDomains = new Set<string>();
  const seen = new Set<string>();
  let shownScore = 0;
  let tween = 0;
  let ticker: ReturnType<typeof setInterval> | null = null;
  let lastAnnounce = "";

  const enter = (key: string) => (seen.has(key) ? "" : (seen.add(key), " enter"));
  const busy = () => !!view && view.phase !== "done" && view.phase !== "error";

  function send(msg: ToBackground) {
    try {
      if (!port) {
        port = chrome.runtime.connect({ name: "mburoja" });
        port.onMessage.addListener((m: ToContent) => {
          if (m.type !== "view") return;
          if (view?.id !== m.view.id) { seen.clear(); openDomains.clear(); }
          view = m.view;
          render();
        });
        port.onDisconnect.addListener(() => { port = null; });
      }
      port.postMessage(msg);
    } catch {
      showError(t("errReload"));
    }
  }

  function showError(message: string) {
    view = null;
    card.hidden = false;
    body.replaceChildren(h("p", { class: "enter" }, `⚠ ${message}`));
    reportBox.hidden = true;
    phaseText.textContent = t("ph_error");
    phasePct.textContent = "";
    barFill.style.width = "0";
    bar.classList.remove("busy");
    syncFab();
  }

  function hide() { card.hidden = true; fab.focus(); }
  function show() { card.hidden = false; }

  function scan(): boolean {
    const email = hooks.extract();
    if (!email) { showError(t("noEmailOpen")); return false; }
    view = null;
    seen.clear();
    shownScore = 0;
    tab = "reasons";
    show();
    renderLoading();
    send({ type: "scan", email });
    return true;
  }

  // ---- score ring: animate the number and the arc ----
  function setScore(score: number, flag: string, isBusy: boolean) {
    ringVal.setAttribute("stroke", FLAG_COLOR[flag] ?? "#6b7280");
    ringVal.setAttribute("stroke-dasharray", `${(C * score) / 100} ${C}`);
    ring.classList.toggle("busy", isBusy);
    ring.setAttribute("aria-label", `${t("score")} ${score}/100`);
    cancelAnimationFrame(tween);
    const from = shownScore;
    const start = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / 700);
      shownScore = Math.round(from + (score - from) * (1 - Math.pow(1 - k, 3)));
      ringNum.textContent = String(shownScore);
      if (k < 1) tween = requestAnimationFrame(step);
    };
    tween = requestAnimationFrame(step);
  }

  function syncFab() {
    const open = hooks.isOpen();
    fab.hidden = !open && card.hidden;
    fab.replaceChildren();
    if (view && busy()) {
      fab.dataset.state = "busy";
      fab.style.setProperty("--p", `${view.progress}%`);
      fab.append(h("span", { class: "dot", "aria-hidden": "true" }), t("scanningFab", [String(view.progress)]));
      fab.setAttribute("aria-label", t("scanningFab", [String(view.progress)]));
    } else if (view && view.phase === "done") {
      fab.dataset.state = "done";
      fab.style.setProperty("--flag", FLAG_COLOR[view.flag]);
      fab.append(`${FLAG_ICON[view.flag]} ${view.score} · ${t(`flag_${view.flag}`)}`);
      fab.setAttribute("aria-label", `${t("showResult")}: ${view.score} ${t(`flag_${view.flag}`)}`);
    } else {
      fab.dataset.state = "idle";
      fab.style.setProperty("--p", "0%");
      fab.append("🛡 ", t("scanEmail"));
      fab.setAttribute("aria-label", t("scanEmailAria"));
    }
  }

  function renderLoading() {
    pill.style.setProperty("--flag", "#64748b");
    pill.textContent = t("reading");
    heroSub.textContent = "";
    subject.textContent = "";
    setScore(0, "grey", true);
    barFill.style.width = "4%";
    bar.classList.add("busy");
    phaseText.textContent = t("reading");
    phasePct.textContent = "";
    reportBox.hidden = true;
    body.replaceChildren(h("div", { class: "sk", style: "width:70%" }), h("div", { class: "sk" }), h("div", { class: "sk", style: "width:55%" }));
    syncFab();
  }

  // ---- step timeline ----
  function stepDetail(v: ScanView, k: StepKey): string {
    const rows = v.intel.domains.flatMap((d) => d.rows);
    switch (k) {
      case "read": return t("foundSummary", [String(v.found.links), String(v.found.domains.length), String(v.found.attachments)]) + (v.found.senderDomain ? ` · ${t("fromDomain", [v.found.senderDomain])}` : "");
      case "local": return v.steps.local === "done" ? t("localDetail") : "";
      case "engine": return v.steps.engine === "done" ? t("engineDetail", [String(v.reasons.length), String(v.baseScore ?? v.score)]) : v.steps.engine === "active" ? t("engineRunning") : "";
      case "intel":
        if (v.steps.intel === "skipped") return t("intelSkipped");
        if (!rows.length) return v.steps.intel === "pending" ? "" : t("intelStarting");
        return t("intelDetail", [String(rows.filter((r) => r.status !== "pending").length), String(rows.length), String(v.intel.domains.length)]) + (v.intel.deep ? ` · ${t("deepOn")}` : "");
      case "report": {
        const r = v.report.state;
        if (r === "sent") return t("sentShort", [v.report.protocol ?? ""]);
        if (r === "below") return t("belowShort", [String(v.threshold)]);
        if (r === "needs_consent") return t("needsConsentShort");
        if (r === "countdown") return t("countdownShort");
        if (r === "cancelled") return t("cancelled");
        if (r === "failed") return v.report.error ?? t("errServer");
        return t("thresholdIs", [String(v.threshold)]);
      }
    }
  }

  function steps(v: ScanView) {
    return h("ol", { class: "steps", "aria-label": t("progress") }, ...STEPS.map((k) => {
      const st = v.steps[k];
      const icon = st === "done" ? "✓" : st === "error" ? "!" : st === "skipped" ? "–" : "";
      return h("li", {},
        h("span", { class: `si ${st}`, "aria-hidden": "true" }, icon),
        h("div", {}, h("div", { class: `sl ${st}` }, t(`step_${k}`)), stepDetail(v, k) ? h("div", { class: "sd" }, stepDetail(v, k)) : null),
      );
    }));
  }

  // ---- tabs ----
  function tabs(v: ScanView) {
    const linkChecks = v.intel.domains.length;
    const mk = (id: typeof tab, label: string, count?: number) =>
      h("button", { class: "tab", role: "tab", type: "button", "aria-selected": String(tab === id), "data-fid": `tab-${id}`, onclick: () => { tab = id; render(); } }, label, count !== undefined ? h("span", { class: "count" }, String(count)) : null);
    return h("div", { class: "tabs", role: "tablist" }, mk("reasons", t("tab_reasons"), v.reasons.length), mk("links", t("tab_links"), linkChecks), mk("breakdown", t("tab_breakdown")));
  }

  function reasonsPanel(v: ScanView) {
    const items: (Node | null)[] = [];
    if (v.explanation && !v.preliminary) items.push(h("div", { class: `explain${enter("explain")}` }, v.explanation));
    if (!v.reasons.length) items.push(h("p", { class: "muted" }, v.preliminary ? t("engineRunning") : t("noReasons")));
    else items.push(h("ul", { class: "reasons" }, ...v.reasons.map((r) => h("li", { class: enter(`r:${r.code}:${v.preliminary}`).trim() },
      h("span", { class: "w" }, `+${r.weight}`),
      h("span", {}, r.text, r.evidence ? h("span", { class: "ev" }, r.evidence) : null),
    ))));
    if (v.preliminary) items.push(h("p", { class: "muted" }, t("preliminaryNote")));
    return h("div", { role: "tabpanel" }, ...items);
  }

  function domainCard(d: IntelDomain, i: number) {
    const id = d.host || String(i);
    const running = d.status === "running";
    const worst = d.rows.some((r) => r.verdict === "malicious") ? "malicious" : d.rows.some((r) => r.verdict === "suspicious") ? "suspicious" : running ? "pending" : "clean";
    const details = h("details", { class: "dom" }) as HTMLDetailsElement;
    details.open = openDomains.has(id) || i === 0;
    details.addEventListener("toggle", () => { if (details.open) openDomains.add(id); else openDomains.delete(id); });
    const done = d.rows.filter((r) => r.status !== "pending").length;
    details.append(
      h("summary", { "data-fid": `dom-${id}` },
        h("span", { class: "host" }, d.host || "…"),
        h("span", { class: `chip ${worst}` }, running ? h("span", { class: "spin", "aria-hidden": "true" }) : null, running ? `${done}/${d.rows.length}` : t(`v_${worst}`)),
      ),
      h("div", { class: "meta" },
        d.domainAgeDays !== null ? h("span", { class: `tag${d.domainAgeDays < 30 ? " bad" : ""}` }, t("ageDays", [String(d.domainAgeDays)])) : !running ? h("span", { class: "tag" }, t("ageUnknown")) : null,
        d.subdomains ? h("span", { class: "tag" }, t("subdomainsN", [String(d.subdomains)])) : null,
        d.status === "timeout" ? h("span", { class: "tag" }, t("timeoutIntel")) : null,
        d.error ? h("span", { class: "tag bad" }, d.error) : null,
      ),
      ...d.rows.map((r) => {
        const vk = verdictKey(r.status, r.verdict);
        return h("div", { class: `prow${enter(`${id}:${r.key}:${vk}`)}` },
          h("span", { class: "pname" }, t(`prov_${r.provider}`), r.tier === "B" ? h("span", { class: "muted" }, ` · ${t("deepTier")}`) : null),
          h("span", { class: `chip ${vk}` }, vk === "pending" ? h("span", { class: "spin", "aria-hidden": "true" }) : null, t(`v_${vk}`)),
          r.detail ? h("span", { class: "pdet" }, r.detail) : null,
        );
      }),
    );
    return details;
  }

  function linksPanel(v: ScanView) {
    if (!v.intel.domains.length) {
      if (v.steps.intel === "skipped") return h("p", { class: "muted", role: "tabpanel" }, v.found.links ? t("intelNotEligible") : t("noLinks"));
      return h("div", { role: "tabpanel" }, h("div", { class: "sk" }), h("div", { class: "sk", style: "width:60%" }));
    }
    return h("div", { role: "tabpanel" },
      v.intel.mock ? h("p", { class: "muted" }, `⚗ ${t("demoData")}`) : null,
      ...v.intel.domains.map(domainCard),
    );
  }

  function breakdownPanel(v: ScanView) {
    if (!v.groups) return h("div", { role: "tabpanel" }, h("div", { class: "sk" }), h("div", { class: "sk" }));
    return h("div", { role: "tabpanel" },
      ...Object.entries(GROUP_CAPS).map(([g, cap]) => {
        const val = Math.round(v.groups?.[g] ?? 0);
        return h("div", { class: "group" },
          h("span", {}, t(`group_${g}`)),
          h("span", { class: "gbar", role: "img", "aria-label": `${t(`group_${g}`)} ${val}/${cap}` }, h("span", { style: `width:${(100 * val) / cap}%` })),
          h("span", { class: "gval" }, `${val}/${cap}`),
        );
      }),
      v.baseScore !== undefined && v.score > v.baseScore ? h("p", { class: "muted" }, t("scoreFrom", [String(v.baseScore), String(v.score)])) : null,
    );
  }

  // ---- report decision ----
  function renderReport(v: ScanView) {
    const r = v.report;
    reportBox.replaceChildren();
    reportBox.hidden = r.state === "none";
    if (r.state === "below") add(reportBox, h("div", {}, `✓ ${t("belowThreshold", [String(v.threshold)])}`));
    else if (r.state === "needs_consent") {
      const cb = h("input", { type: "checkbox", id: "mb-always", "data-fid": "always" }) as HTMLInputElement;
      cb.checked = always;
      cb.addEventListener("change", () => { always = cb.checked; });
      add(reportBox, 
        h("strong", {}, t("reachedThreshold", [String(v.score), String(v.threshold)])),
        h("p", { class: "muted" }, t("whatIsSent")),
        h("label", { for: "mb-always" }, cb, t("alwaysSend")),
        h("div", { class: "actions" }, h("button", { class: "btn danger", type: "button", "data-fid": "send", onclick: () => send({ type: "report", always }) }, "➤ ", t("sendToAuthorities"))),
      );
    } else if (r.state === "countdown") {
      const left = Math.max(0, Date.parse(r.submitAt ?? "") - Date.now());
      add(reportBox, 
        h("strong", {}, t("countdown", [String(Math.ceil(left / 1000))])),
        h("p", { class: "muted" }, t("whatIsSent")),
        h("div", { class: "cd" }, h("span", { style: `width:${(left / 5000) * 100}%` })),
        h("div", { class: "actions" }, h("button", { class: "btn ghost", type: "button", "data-fid": "cancel", onclick: () => send({ type: "cancel" }) }, t("cancel"))),
      );
    } else if (r.state === "cancelled") add(reportBox, h("div", {}, t("cancelled")), h("div", { class: "actions" }, h("button", { class: "btn danger", type: "button", "data-fid": "send", onclick: () => send({ type: "report", always: false }) }, t("sendToAuthorities"))));
    else if (r.state === "sending") add(reportBox, h("div", {}, h("span", { class: "spin", "aria-hidden": "true" }), " ", t("sending")));
    else if (r.state === "sent") {
      const left = r.deleteUntil ? Math.max(0, Date.parse(r.deleteUntil) - Date.now()) : 0;
      const mins = `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, "0")}`;
      add(reportBox, 
        h("strong", { class: "enter" }, `✓ ${t("sent")}`),
        h("div", {}, t("protocol"), " ", h("code", {}, r.protocol ?? "")),
        r.error ? h("div", { class: "muted" }, r.error) : null,
        left > 0 ? h("div", { class: "actions" }, h("button", { class: "btn ghost", type: "button", "data-fid": "undo", onclick: () => send({ type: "undo" }) }, `↶ ${t("undo")} (${mins})`)) : null,
      );
    } else if (r.state === "undone") add(reportBox, h("div", {}, t("undone")));
    else if (r.state === "failed") add(reportBox, h("div", {}, `⚠ ${r.error ?? t("errServer")}`), h("div", { class: "actions" }, h("button", { class: "btn ghost", type: "button", "data-fid": "retry", onclick: () => send({ type: "report", always: false }) }, t("retry"))));
  }

  function phaseLabel(v: ScanView): string {
    if (v.phase === "intel") {
      const rows = v.intel.domains.flatMap((d) => d.rows);
      const pending = rows.find((r) => r.status === "pending");
      return pending ? t("ph_intel_p", [t(`prov_${pending.provider}`)]) : t("ph_intel");
    }
    return t(`ph_${v.phase}`);
  }

  // ---- main render (keeps keyboard focus across updates) ----
  function render() {
    if (!view) return;
    const v = view;
    const focused = (shadow.activeElement as HTMLElement | null)?.dataset?.fid;
    const scrollEl = card.querySelector(".scroll");
    const scrollTop = scrollEl?.scrollTop ?? 0;

    elapsed.textContent = t("elapsed", [String(Math.round(((v.finishedAt ? Date.parse(v.finishedAt) : Date.now()) - Date.parse(v.startedAt)) / 1000))]);
    barFill.style.width = `${v.progress}%`;
    bar.setAttribute("aria-valuenow", String(v.progress));
    bar.classList.toggle("busy", busy());
    phaseText.textContent = v.phase === "error" ? `⚠ ${v.error ?? t("errServer")}` : phaseLabel(v);
    phasePct.textContent = busy() ? `${v.progress}%` : "";

    if (v.phase === "error") {
      pill.style.setProperty("--flag", "#64748b");
      pill.textContent = t("ph_error");
      setScore(0, "grey", false);
      heroSub.textContent = v.error ?? "";
    } else {
      pill.style.setProperty("--flag", FLAG_COLOR[v.flag]);
      pill.textContent = `${FLAG_ICON[v.flag]} ${t(`flag_${v.flag}`)}`;
      setScore(v.score, v.flag, busy());
      heroSub.textContent = v.preliminary ? t("preliminary") : busy() ? t("updating") : v.baseScore !== undefined && v.score > v.baseScore ? t("scoreFrom", [String(v.baseScore), String(v.score)]) : t("final");
    }
    subject.textContent = v.subject ?? "";

    const panel = tab === "reasons" ? reasonsPanel(v) : tab === "links" ? linksPanel(v) : breakdownPanel(v);
    body.replaceChildren();
    add(body,
      steps(v),
      v.phase === "done" ? h("p", { class: `explain${enter("todo")}` }, h("strong", {}, t("whatToDo")), " ", t(`todo_${v.flag}`)) : null,
      tabs(v),
      panel,
    );
    renderReport(v);
    syncFab();

    if (focused) (shadow.querySelector(`[data-fid="${focused}"]`) as HTMLElement | null)?.focus();
    if (scrollEl) scrollEl.scrollTop = scrollTop;

    // Screen readers: announce phase changes and the final verdict once.
    const announce = v.phase === "done" ? `${t(`flag_${v.flag}`)} ${v.score}` : phaseLabel(v);
    if (announce !== lastAnnounce) { live.textContent = announce; lastAnnounce = announce; }

    // 1 s ticker for elapsed time, the auto-send countdown and the undo window.
    const needsTick = busy() || v.report.state === "countdown" || (v.report.state === "sent" && Date.parse(v.report.deleteUntil ?? "") > Date.now());
    if (needsTick && !ticker) ticker = setInterval(() => { if (!card.hidden) render(); }, 1000);
    if (!needsTick && ticker) { clearInterval(ticker); ticker = null; }
  }

  fab.addEventListener("click", () => {
    if (view && !card.hidden) { hide(); return; }
    if (view && (busy() || view.phase === "done")) { show(); render(); return; }
    scan();
  });
  shadow.addEventListener("keydown", (e) => { if ((e as KeyboardEvent).key === "Escape") hide(); });

  // Show the button only while an email is open; reset when the user opens another email.
  let lastKey = location.hash;
  let pending = false;
  new MutationObserver(() => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; syncFab(); });
  }).observe(document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", () => {
    if (location.hash === lastKey) return;
    lastKey = location.hash;
    if (!busy()) { view = null; card.hidden = true; }
    syncFab();
  });
  syncFab();

  // Popup "Scan the open email" button.
  chrome.runtime.onMessage.addListener((msg: { type: string }, _s, reply) => {
    if (msg.type === "trigger") reply({ ok: scan() });
    return false;
  });
}
