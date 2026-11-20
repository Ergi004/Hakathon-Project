/** OpenAPI 3.1 description of /api/v1 (SPEC 12.3, 13.2). Rendered by /api-docs. */
const err = { $ref: "#/components/schemas/Error" };
const json = (schema: object) => ({ "application/json": { schema } });

export const openapi = {
  openapi: "3.1.0",
  info: { title: "Mburoja API", version: "1.0.0", description: "Anti-fraud checks, reports and the public threat feed. All data in the demo is synthetic." },
  servers: [{ url: "/api/v1" }],
  components: {
    securitySchemes: { bearer: { type: "http", scheme: "bearer", description: "API key (mbk_…) or extension install token (mbi_…)" } },
    schemas: {
      Error: { type: "object", properties: { error: { type: "object", properties: { code: { type: "string" }, message: { type: "string" } } } } },
      AnalysisInput: {
        type: "object",
        required: ["kind", "channel", "locale"],
        properties: {
          kind: { enum: ["url", "text", "phone", "email_signals", "qr"] },
          text: { type: "string", maxLength: 10000 },
          urls: { type: "array", items: { type: "string" }, maxItems: 50 },
          sender: { type: "string" },
          subject: { type: "string" },
          headers: { type: "object", properties: { spf: { enum: ["pass", "fail", "none"] }, dkim: { enum: ["pass", "fail", "none"] }, dmarc: { enum: ["pass", "fail", "none"] }, replyTo: { type: "string" } } },
          attachments: { type: "array", items: { type: "object", properties: { name: { type: "string" }, mime: { type: "string" }, size: { type: "integer" } } } },
          channel: { enum: ["sms", "email", "social", "web", "qr", "call", "other"] },
          locale: { enum: ["sq", "en"] },
        },
      },
      AnalysisResult: {
        type: "object",
        properties: {
          score: { type: "integer", minimum: 0, maximum: 100 },
          flag: { enum: ["green", "yellow", "orange", "red", "darkred", "grey"] },
          groups: { type: "object", additionalProperties: { type: "number" } },
          reasons: { type: "array", items: { type: "object", properties: { code: { type: "string" }, group: { type: "string" }, weight: { type: "number" }, text_sq: { type: "string" }, text_en: { type: "string" }, evidence: { type: "string" } } } },
          campaign: { type: "object", properties: { id: { type: "string" }, code: { type: "string" }, matchType: { enum: ["known", "similar", "new_candidate"] }, confidence: { type: "number" } } },
          matchedInstitution: { type: "object", properties: { id: { type: "string" }, name: { type: "string" } } },
          iocs: { type: "array", items: { type: "object", properties: { type: { type: "string" }, value: { type: "string", description: "defanged" } } } },
          modelVersion: { type: "string" },
          checkId: { type: "string", format: "uuid" },
        },
      },
    },
  },
  paths: {
    "/scan": {
      post: {
        summary: "Analyse a link, message, phone number or email", security: [{ bearer: [] }],
        requestBody: { required: true, content: json({ $ref: "#/components/schemas/AnalysisInput" }) },
        responses: { 200: { description: "Result", content: json({ $ref: "#/components/schemas/AnalysisResult" }) }, 401: { description: "Unauthorized", content: json(err) }, 429: { description: "Rate limited (60 / hour)", content: json(err) } },
      },
    },
    "/reports": {
      post: {
        summary: "Submit an anonymous report",
        requestBody: { required: true, content: json({ type: "object", required: ["category", "channel", "locale"], properties: { category: { type: "string" }, channel: { type: "string" }, text: { type: "string" }, url: { type: "string" }, sender: { type: "string" }, locale: { enum: ["sq", "en"] } } }) },
        responses: { 201: { description: "Created", content: json({ type: "object", properties: { protocol: { type: "string", example: "SOC-2026/000123" }, trackingToken: { type: "string" } } }) }, 429: { description: "Rate limited (10 / hour / IP)", content: json(err) } },
      },
    },
    "/reports/{protocol}": {
      get: {
        summary: "Report status timeline",
        parameters: [{ name: "protocol", in: "path", required: true, schema: { type: "string" } }, { name: "X-Tracking-Token", in: "header", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Timeline" }, 404: { description: "Not found", content: json(err) } },
      },
    },
    "/feed": {
      get: {
        summary: "Public threat feed (cached 60 s)",
        parameters: [{ name: "institution", in: "query", schema: { type: "string" } }, { name: "since", in: "query", schema: { type: "string", format: "date" } }],
        responses: { 200: { description: "Campaigns with defanged domains" } },
      },
    },
    "/institutions/verify": {
      get: {
        summary: "Is a domain or sender official?",
        parameters: [{ name: "domain", in: "query", schema: { type: "string" } }, { name: "sender", in: "query", schema: { type: "string" } }],
        responses: { 200: { description: "{ official, institution? }" } },
      },
    },
    "/stats/public": { get: { summary: "Homepage counters", responses: { 200: { description: "Counters" } } } },
    "/extension/register": {
      post: { summary: "Register an extension install", requestBody: { content: json({ type: "object", properties: { installHash: { type: "string" }, version: { type: "string" } } }) }, responses: { 201: { description: "{ installToken }" } } },
    },
    "/extension/reports": {
      post: { summary: "Send a masked signal report (consent required)", security: [{ bearer: [] }], responses: { 201: { description: "{ reportId, protocol, deleteUntil }" } } },
    },
    "/extension/reports/{id}": {
      delete: { summary: "Undo a signal report within 10 minutes", security: [{ bearer: [] }], responses: { 204: { description: "Deleted" }, 409: { description: "Too late", content: json(err) } } },
    },
    "/export/iocs": {
      get: { summary: "Export IoCs as CSV or STIX-lite JSON (scope iocs)", security: [{ bearer: [] }], parameters: [{ name: "format", in: "query", schema: { enum: ["csv", "json"] } }, { name: "campaign", in: "query", schema: { type: "string" } }], responses: { 200: { description: "IoCs" } } },
    },
  },
} as const;
