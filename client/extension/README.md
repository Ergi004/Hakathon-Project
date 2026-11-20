# Mburoja browser extension (Chrome + Firefox)

Scans an email or SMS with the Mburoja platform (`/api/phishing-intelligence`), which looks up its indicators in VirusTotal. The extension holds no provider keys; it only stores an install token from `/api/v1/extension/register`.

The extension sends nothing on its own. Every scan starts with a click.

## Build

From `client/`:

```bash
npm run ext:build                              # platform at http://localhost:3000
npm run ext:build -- --api=https://your.host   # another platform address
npm run ext:typecheck
```

The build writes:

| File | Use |
|---|---|
| `extension/dist/chrome/`, `extension/dist/firefox/` | Folders for *Load unpacked* (Chrome/Edge) and *Load Temporary Add-on* (Firefox) |
| `extension/dist/mburoja-chrome-<version>.zip` | Upload to the Chrome Web Store or Edge Add-ons, or unzip and *Load unpacked* |
| `extension/dist/mburoja-firefox-<version>.xpi` (and `.zip`) | Upload to addons.mozilla.org, or open directly in *Load Temporary Add-on* |
| `public/downloads/mburoja-extension.zip`, `mburoja-extension-firefox.xpi` | Served by the public `/extension` page as download buttons |

Every package has `manifest.json` at its root, as the stores require.

Chrome no longer installs `.crx` files from outside the Web Store, so outside the store use *Load unpacked*. Regular Firefox installs an `.xpi` permanently only after addons.mozilla.org signs it; a listed or unlisted ("self-distributed") submission both get signed. Build store packages with the production address: `npm run ext:build -- --api=https://…`.

## Load for testing

**Chrome / Edge**

1. Open `chrome://extensions` (or `edge://extensions`) and turn on **Developer mode**.
2. Click **Load unpacked** and choose `extension/dist/chrome`.

**Firefox (128 or newer)**

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** and choose `extension/dist/firefox/manifest.json`.
3. On the first scan, Firefox asks for permission to reach the platform address. Allow it.

## Use

| Tab | What it does |
|---|---|
| **Open email** | Open a message in Gmail, Outlook (live/office/office365) or any webmail, open the popup and click **Scan**. Only the open message is read: subject, sender, visible text, links (Gmail/Outlook redirect links are unwrapped) and attachment names. |
| **SMS** | Paste the SMS text and, optionally, the sender. |
| **EML file** | Upload an `.eml` file. In Gmail use ⋮ → *Download message*. This is the only way to get SPF/DKIM/DMARC, the full headers and **attachment hashes** checked against VirusTotal. |
| Right-click | Select text on any page, then choose *Mburoja: scan selected text as email / SMS*. |

The result appears in the popup: flag, score, VirusTotal engines, top reasons and what to do. The toolbar badge changes colour, and a notification arrives when the scan finishes. Every scan also appears live in the SOC at `/soc/intel`.

## Reports to the SOC (SPEC 12.2)

A scan only produces a verdict for you. A *signal report* is what puts the message into the SOC triage inbox (`/soc/inbox`).

| | Behaviour |
|---|---|
| **Auto-submit** | Off until you give a one-time consent in the popup (⚙ → *Auto-submit to the SOC*). |
| After consent, **orange / red / dark red** | A masked signal report is sent: the subject and the first 600 characters (masked), defanged links, the sender domain, SPF/DKIM/DMARC results, attachment names, score, flag and reason codes. |
| After consent, **yellow** | Indicators only: links, sender domain, flag and reason codes. No subject, text or attachment names. |
| **Green / grey** | Nothing is sent. |
| **Report to SOC** button | Sends one report manually, even with auto-submit off. Your click is the consent for that report. |
| **Undo / delete report** | Shown for 10 minutes after any report is sent. It calls `DELETE /api/v1/extension/reports/{id}`. |

What is sent is built from the platform's own scan report, which is already masked, and is masked again in the extension with the same rules the platform uses (`src/server/detection/masks.ts`). The server masks it a third time before storing it. Reports never contain the full email, its recipients or your identity.

Name masking only catches names that follow a greeting ("I nderuar …", "Zonja …", "Dear …"), because that rule is shared with the whole platform.

## Permissions

- `activeTab` and `scripting`: the extension reads the open tab only after a click. It has no permanent access to any mailbox.
- `storage`: keeps the install token, settings and the last 20 results.
- `notifications`: tells you when a scan finishes.
- `contextMenus`: adds the right-click entries.
- Host permission: only the platform address.

## Limitations

- Webmail pages do not expose message headers. For SPF/DKIM/DMARC and attachment hashes, use the EML tab.
- Gmail and Outlook change their page structure without notice. The adapters try several selectors and report warnings when they cannot find something.
- `.msg` files are not supported yet. A browser cannot read a phone's native SMS inbox, so SMS text has to be pasted.
