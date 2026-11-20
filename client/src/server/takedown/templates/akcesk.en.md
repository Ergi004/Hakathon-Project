---
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
