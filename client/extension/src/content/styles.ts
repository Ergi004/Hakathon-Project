export const CSS = `
:host { all: initial; }
* { box-sizing: border-box; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
:host { --bg:#fff; --fg:#111827; --muted:#6b7280; --border:#e5e7eb; --soft:#f9fafb; --track:#e5e7eb; --accent:#0d9488; --accent-2:#0f766e; }
@media (prefers-color-scheme: dark) { :host { --bg:#0f172a; --fg:#f1f5f9; --muted:#94a3b8; --border:#334155; --soft:#1e293b; --track:#334155; } }
button { font: inherit; }
button:focus-visible, a:focus-visible, input:focus-visible, [tabindex]:focus-visible { outline: 3px solid #f59e0b; outline-offset: 2px; }

.fab { position: fixed; right: 24px; bottom: 24px; z-index: 2147483646; display: inline-flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: 999px; border: 0; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; box-shadow: 0 8px 24px rgba(0,0,0,.25); transition: transform .15s ease, box-shadow .15s ease; background: linear-gradient(90deg, var(--accent-2) var(--p, 0%), var(--accent) var(--p, 0%)); }
.fab:hover { transform: translateY(-1px); box-shadow: 0 10px 28px rgba(0,0,0,.3); }
.fab:active { transform: scale(.97); }
.fab[data-state="done"] { background: var(--flag); }
.fab .dot { width: 8px; height: 8px; border-radius: 50%; background: #fff; animation: pulse 1.2s ease-in-out infinite; }

.card { position: fixed; right: 24px; bottom: 80px; z-index: 2147483647; width: min(400px, calc(100vw - 32px)); max-height: calc(100vh - 110px); display: flex; flex-direction: column; background: var(--bg); color: var(--fg); border-radius: 18px; border: 1px solid var(--border); box-shadow: 0 20px 50px rgba(0,0,0,.28); font-size: 13px; line-height: 1.45; overflow: hidden; animation: rise .22s cubic-bezier(.2,.8,.2,1); }
.card[hidden] { display: none; }
.scroll { overflow: auto; padding: 0 16px 12px; }
.head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 12px 16px 8px; }
.title { font-size: 15px; font-weight: 700; display: inline-flex; gap: 6px; align-items: center; }
.icon-btn { border: 0; background: transparent; color: inherit; cursor: pointer; padding: 4px 8px; border-radius: 8px; font-size: 16px; line-height: 1; }
.icon-btn:hover { background: var(--soft); }
.elapsed { font-variant-numeric: tabular-nums; color: var(--muted); font-size: 12px; }

.bar { height: 6px; background: var(--track); border-radius: 999px; overflow: hidden; margin: 0 16px; }
.bar > span { display: block; height: 100%; width: 0; background: linear-gradient(90deg, var(--accent), #22d3ee); border-radius: inherit; transition: width .5s ease; }
.bar.busy > span { background-size: 200% 100%; background-image: linear-gradient(90deg, var(--accent), #22d3ee, var(--accent)); animation: flow 1.4s linear infinite; }
.phase { margin: 6px 16px 10px; color: var(--muted); font-size: 12px; display: flex; justify-content: space-between; gap: 8px; }

.hero { display: flex; gap: 14px; align-items: center; padding: 4px 0 8px; }
.ring circle.val { transition: stroke-dasharray .7s cubic-bezier(.2,.8,.2,1), stroke .4s ease; }
.ring.busy { animation: breathe 1.6s ease-in-out infinite; }
.pill { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 999px; font-weight: 700; font-size: 13px; color: #fff; background: var(--flag); transition: background .4s ease; }
.sub { color: var(--muted); font-size: 12px; margin-top: 4px; }
.subject { font-weight: 600; margin-top: 6px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }

.steps { list-style: none; margin: 6px 0 4px; padding: 0; position: relative; }
.steps li { display: grid; grid-template-columns: 22px 1fr; gap: 8px; padding: 5px 0; align-items: start; }
.si { width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; font-size: 11px; font-weight: 700; border: 2px solid var(--track); color: var(--muted); background: var(--bg); }
.si.done { background: var(--accent); border-color: var(--accent); color: #fff; animation: pop .25s ease; }
.si.active { border-color: var(--accent); border-right-color: transparent; animation: spin .8s linear infinite; }
.si.error { background: #dc2626; border-color: #dc2626; color: #fff; }
.si.skipped { border-style: dashed; }
.sl { font-weight: 600; }
.sl.pending, .sl.skipped { color: var(--muted); font-weight: 500; }
.sd { color: var(--muted); font-size: 12px; }

.tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--border); margin: 10px 0 8px; }
.tab { border: 0; background: transparent; color: var(--muted); padding: 7px 10px; cursor: pointer; font-weight: 600; font-size: 12px; border-bottom: 2px solid transparent; margin-bottom: -1px; }
.tab[aria-selected="true"] { color: var(--fg); border-bottom-color: var(--accent); }
.count { display: inline-block; min-width: 18px; padding: 0 5px; margin-left: 4px; border-radius: 999px; background: var(--soft); border: 1px solid var(--border); font-size: 11px; }

.reasons { list-style: none; padding: 0; margin: 0; }
.reasons li { display: flex; gap: 8px; align-items: flex-start; padding: 6px 0; border-bottom: 1px solid var(--border); }
.reasons li:last-child { border-bottom: 0; }
.w { flex-shrink: 0; font-size: 11px; font-weight: 700; padding: 1px 6px; border-radius: 6px; background: var(--soft); border: 1px solid var(--border); font-variant-numeric: tabular-nums; }
.ev { display: block; color: var(--muted); font-size: 11px; word-break: break-all; }
.explain { background: var(--soft); border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px; margin-bottom: 8px; }

.dom { border: 1px solid var(--border); border-radius: 12px; margin-bottom: 8px; overflow: hidden; }
.dom > summary { list-style: none; cursor: pointer; padding: 8px 10px; display: flex; justify-content: space-between; align-items: center; gap: 8px; background: var(--soft); }
.dom > summary::-webkit-details-marker { display: none; }
.host { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; word-break: break-all; }
.meta { display: flex; flex-wrap: wrap; gap: 6px; padding: 6px 10px 0; }
.tag { font-size: 11px; padding: 1px 7px; border-radius: 999px; border: 1px solid var(--border); }
.tag.bad { border-color: #dc2626; color: #dc2626; font-weight: 700; }
.prow { display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; padding: 6px 10px; border-top: 1px solid var(--border); align-items: center; }
.prow:first-of-type { border-top: 0; }
.pname { font-weight: 600; font-size: 12px; }
.pdet { grid-column: 1; color: var(--muted); font-size: 11px; }
.chip { grid-row: 1 / span 2; grid-column: 2; display: inline-flex; gap: 4px; align-items: center; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--border); white-space: nowrap; }
.chip.malicious { background: #7f1d1d; border-color: #7f1d1d; color: #fff; }
.chip.suspicious { background: #ea580c; border-color: #ea580c; color: #fff; }
.chip.clean { background: #16a34a; border-color: #16a34a; color: #fff; }
.chip.unavailable { color: var(--muted); }

.group { display: grid; grid-template-columns: 90px 1fr 44px; gap: 8px; align-items: center; padding: 4px 0; font-size: 12px; }
.gbar { height: 8px; border-radius: 999px; background: var(--track); overflow: hidden; }
.gbar > span { display: block; height: 100%; background: var(--accent); border-radius: inherit; transition: width .6s ease; }
.gval { text-align: right; font-variant-numeric: tabular-nums; color: var(--muted); }

.sk { height: 12px; border-radius: 6px; margin: 8px 0; background: linear-gradient(90deg, var(--track) 25%, var(--soft) 50%, var(--track) 75%); background-size: 200% 100%; animation: flow 1.2s linear infinite; }

.report { border-top: 1px solid var(--border); padding: 12px 16px; background: var(--soft); }
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 8px 12px; border-radius: 10px; border: 1px solid transparent; font-size: 13px; font-weight: 600; cursor: pointer; transition: transform .1s ease, background .15s ease; }
.btn:active { transform: scale(.97); }
.danger { background: #b91c1c; color: #fff; }
.danger:hover { background: #991b1b; }
.ghost { background: transparent; border-color: var(--border); color: inherit; }
.ghost:hover { background: var(--bg); }
.actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; align-items: center; }
.cd { height: 4px; background: var(--track); border-radius: 999px; overflow: hidden; margin-top: 8px; }
.cd > span { display: block; height: 100%; background: #b91c1c; transition: width 1s linear; }
label { display: flex; gap: 8px; align-items: flex-start; margin-top: 8px; font-size: 12px; cursor: pointer; }
.muted { color: var(--muted); font-size: 12px; }
.foot { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 8px 16px 12px; }
a { color: var(--accent); }
code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
.spin { display: inline-block; width: 11px; height: 11px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: spin .8s linear infinite; vertical-align: -1px; }
.enter { animation: enter .28s cubic-bezier(.2,.8,.2,1) both; }

@keyframes spin { to { transform: rotate(360deg); } }
@keyframes flow { to { background-position: -200% 0; } }
@keyframes rise { from { opacity: 0; transform: translateY(12px) scale(.98); } }
@keyframes enter { from { opacity: 0; transform: translateY(4px); } }
@keyframes pop { 50% { transform: scale(1.18); } }
@keyframes pulse { 50% { opacity: .35; } }
@keyframes breathe { 50% { opacity: .75; } }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } .si.active { border-right-color: var(--accent); } }
`;
