import type { Enums } from "@/types/database";

type Kind = Enums<"notice_type">;

/**
 * Bundled copies of templates/*.md so Cloudflare Workers can load them
 * without a real filesystem. Keep in sync with the .md files (render tests).
 */
const FALLBACKS: Record<`${Kind}.${"sq" | "en"}`, string> = {
  "akcesk.en": `---
subject: "[{{protocol}}] Incident notice: campaign {{campaign_code}} against {{imitated_institution}}"
---
Hello,

The Mburoja platform SOC is notifying you of an active scam campaign.

**Incident summary**
- Campaign: {{campaign_code}}
- Affected institution: {{imitated_institution}}
- First seen: {{first_seen}}
- Number of reports: {{report_count}}
- Main domain: {{domain}}

**Indicators (defanged)**
{{iocs}}

**Evidence**
{{evidence_summary}}

**Request for coordination**
We request coordination to block the indicators at internet service provider level and to notify the affected institution. The evidence pack is attached.

Protocol: {{protocol}}

Kind regards,
{{analyst_name}}
{{org_name}}
`,
  "akcesk.sq": `---
subject: "[{{protocol}}] Njoftim incidenti: fushata {{campaign_code}} kundër {{imitated_institution}}"
---
Përshëndetje,

SOC i platformës Mburoja ju njofton për një fushatë aktive mashtrimi.

**Përmbledhje e incidentit**
- Fushata: {{campaign_code}}
- Institucioni i prekur: {{imitated_institution}}
- Parë për herë të parë: {{first_seen}}
- Numri i raporteve: {{report_count}}
- Domeni kryesor: {{domain}}

**Treguesit (të çaktivizuar)**
{{iocs}}

**Provat**
{{evidence_summary}}

**Kërkesa për koordinim**
Kërkojmë koordinim për bllokimin e treguesit në nivel të ofruesve të internetit dhe njoftimin e institucionit të prekur. Paketa e provave është bashkëngjitur.

Protokolli: {{protocol}}

Me respekt,
{{analyst_name}}
{{org_name}}
`,
  "hosting.en": `---
subject: "[{{protocol}}] Fraudulent content hosted with you: {{domain}}"
---
Hello,

We are writing from the Mburoja platform SOC. Your infrastructure hosts content that impersonates {{imitated_institution}} to steal data and payments from citizens.

**Campaign**: {{campaign_code}} (first seen {{first_seen}}, {{report_count}} reports)

**Affected addresses (defanged)**
{{iocs}}

**Evidence**
{{evidence_summary}}

**Request**
Please remove the content at the addresses above and preserve the related logs. The evidence pack is attached.

Please reply quoting protocol {{protocol}}.

Kind regards,
{{analyst_name}}
{{org_name}}
`,
  "hosting.sq": `---
subject: "[{{protocol}}] Përmbajtje mashtruese e hostuar te ju: {{domain}}"
---
Përshëndetje,

Ju shkruajmë nga SOC i platformës Mburoja. Në infrastrukturën tuaj hostohet përmbajtje që imiton {{imitated_institution}} për të vjedhur të dhëna dhe pagesa nga qytetarët.

**Fushata**: {{campaign_code}} (parë për herë të parë më {{first_seen}}, {{report_count}} raporte)

**Adresat e përfshira (të çaktivizuara)**
{{iocs}}

**Provat**
{{evidence_summary}}

**Kërkesa**
Ju lutemi të hiqni përmbajtjen në adresat e mësipërme dhe të ruani regjistrat përkatës. Paketa e provave është bashkëngjitur.

Ju lutemi përgjigjuni duke përmendur protokollin {{protocol}}.

Me respekt,
{{analyst_name}}
{{org_name}}
`,
  "registrar.en": `---
subject: "[{{protocol}}] Request to suspend the domain {{domain}}"
---
Hello,

We are writing from the Security Operations Centre (SOC) of the Mburoja platform about the domain {{domain}}, registered with you.

**Summary**
The domain imitates {{imitated_institution}} and is used in scam campaign {{campaign_code}}, first seen on {{first_seen}}. We have received {{report_count}} reports from citizens and other channels.

**Indicators (defanged)**
{{iocs}}

**Evidence**
{{evidence_summary}}

**Request**
Please suspend the domain {{domain}} and preserve its registration data for further investigation. The full evidence pack is attached to this notice.

For any questions, reply to this email quoting protocol number {{protocol}}.

Kind regards,
{{analyst_name}}
{{org_name}}
`,
  "registrar.sq": `---
subject: "[{{protocol}}] Kërkesë për pezullimin e domenit {{domain}}"
---
Përshëndetje,

Ju shkruajmë nga Qendra e Operacioneve të Sigurisë (SOC) e platformës Mburoja, në lidhje me domenin {{domain}}, i regjistruar pranë jush.

**Përmbledhje**
Domeni imiton {{imitated_institution}} dhe përdoret në fushatën e mashtrimit {{campaign_code}}, e vërejtur për herë të parë më {{first_seen}}. Kemi marrë {{report_count}} raporte nga qytetarë dhe kanale të tjera.

**Treguesit (të çaktivizuar)**
{{iocs}}

**Provat**
{{evidence_summary}}

**Kërkesa**
Ju lutemi të pezulloni domenin {{domain}} dhe të ruani të dhënat e regjistrimit për hetim të mëtejshëm. Paketa e plotë e provave është bashkëngjitur këtij njoftimi.

Për çdo pyetje, ju lutemi përgjigjuni këtij emaili duke përmendur numrin e protokollit {{protocol}}.

Me respekt,
{{analyst_name}}
{{org_name}}
`,
};

export function bundledTemplate(kind: Kind, locale: "sq" | "en"): string {
  return FALLBACKS[`${kind}.${locale}`];
}
