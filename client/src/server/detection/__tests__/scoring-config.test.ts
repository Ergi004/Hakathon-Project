import { describe, expect, it } from "vitest";
import { SCORING, type ScoringSignal } from "../scoring/config";

function signal(code: string): ScoringSignal {
  const found = SCORING.signals.find((item) => item.code === code);
  if (!found) throw new Error(`missing signal ${code}`);
  return found;
}

describe("scoring config", () => {
  it("is versioned and keeps the starting weights", () => {
    expect(SCORING.scoringVersion).toBe("risk-1");
    expect(signal("typosquat").weight).toBe(20);
    expect(signal("homoglyph").weight).toBe(25);
    expect(signal("combo_word").weight).toBe(18);
    expect(signal("subdomain_trick").weight).toBe(20);
    expect(signal("punycode").weight).toBe(8);
    expect(signal("registered_under_30d").weight).toBe(10);
    expect(signal("registered_under_30d").alternates?.find((item) => item.id === "under_7d")?.weight).toBe(15);
    expect(signal("unusual_tld").weight).toBe(5);
    expect(signal("cert_right_after_registration").weight).toBe(3);
    expect(signal("cert_contains_brand").weight).toBe(4);
    expect(signal("hosting_pattern_seen_in_campaigns").weight).toBe(3);
    expect(signal("hidden_owner").weight).toBe(0);
    expect(signal("shortened_link").weight).toBe(6);
    expect(signal("link_text_mismatch").weight).toBe(12);
    expect(signal("unknown_qr_destination").weight).toBe(10);
    expect(signal("institution_named_link_not_theirs").weight).toBe(18);
    expect(signal("sms_claims_institution_not_official_sender").weight).toBe(25);
    expect(signal("display_name_spoof").weight).toBe(10);
    expect(signal("reply_to_mismatch").weight).toBe(6);
    expect(signal("freemail_claiming_institution").weight).toBe(10);
    expect(signal("email_auth_failure").weight).toBe(10);
    expect(signal("email_auth_failure").cap).toBe(20);
    expect(signal("unknown_sms_sender").weight).toBe(12);
    expect(signal("urgency").weight).toBe(5);
    expect(signal("payment_demand").weight).toBe(6);
    expect(signal("threat").weight).toBe(5);
    expect(signal("asks_for_secrets").weight).toBe(15);
    expect(signal("text_classifier").weight).toBe(15);
    expect(signal("llm_review").weight).toBe(15);
    expect(signal("link_is_pay_or_signin_or_send_details").weight).toBe(20);
    expect(signal("credential_form_non_official").weight).toBe(22);
    expect(signal("credential_form_non_official").alternates?.[0].weight).toBe(12);
    expect(signal("exfil_chat_bot_or_webhook").weight).toBe(25);
    expect(signal("exfil_php_or_third_party").weight).toBe(10);
    expect(signal("brand_logo_or_layout_match_non_brand_domain").weight).toBe(22);
    expect(signal("brand_logo_or_layout_match_non_brand_domain").alternates?.[0].weight).toBe(12);
    expect(signal("known_phishing_kit").weight).toBe(25);
    expect(signal("cloaking").weight).toBe(10);
    expect(signal("cloaking").alternates?.[0].weight).toBe(15);
    expect(signal("executable_or_macro").weight).toBe(15);
    expect(signal("password_protected_archive").weight).toBe(6);
    expect(signal("double_extension").weight).toBe(8);
    expect(signal("many_reports").weight).toBe(6);
  });

  it("counts punycode only beside a brand lookalike, and keeps the floors", () => {
    expect(signal("punycode").condition).toEqual({
      kind: "requires_any",
      codes: ["typosquat", "homoglyph", "combo_word", "subdomain_trick"],
    });
    expect(signal("asks_for_secrets").condition).toEqual({ kind: "rejects_delivered_code" });
    expect(signal("llm_review").condition).toEqual({ kind: "add_only" });
    expect(SCORING.floors.map((item) => [item.id, item.floor])).toEqual([
      ["known_bad", 90],
      ["confirmed_campaign", 85],
      ["credential_form_exfil", 90],
      ["phishing_kit", 80],
      ["brand_credential_form", 80],
    ]);
    expect(SCORING.allowlistCap).toEqual({ signal: "official_allowlist_domain", cap: 10, yieldsToFloors: true });
    expect(SCORING.negatives.map((item) => [item.code, item.reduction])).toEqual([
      ["official_allowlist_domain", 0.5],
      ["domain_age_over_2_years", 0.15],
      ["verified_official_sender", 0.4],
      ["aligned_dmarc_pass", 0.25],
    ]);
    expect(SCORING.negativeReductionCap).toBe(0.6);
    expect(SCORING.families.sender_auth).toEqual({ cap: 100, combine: "stack", stackRemainder: 0.25 });
    expect(SCORING.families.lookalike_domain).toEqual({ cap: 100, combine: "max" });
    expect(SCORING.verdicts.high).toEqual({ min: 60, max: 100 });
    expect(SCORING.confidence.floor).toBe(0.2);
    expect(SCORING.confidence.penalties.page_not_loadable).toBe(0.3);
  });
});
