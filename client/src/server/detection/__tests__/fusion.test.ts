import { describe, expect, it } from "vitest";
import { DEFAULT_THRESHOLDS, flagForScore } from "@/lib/flags";
import { fuse } from "../fusion";
import { reason } from "../reasons";

const opts = { thresholds: DEFAULT_THRESHOLDS, floor: false, cap: false, analysed: true };

describe("fusion", () => {
  it("caps each group", () => {
    const r = fuse([reason("lookalike_homoglyph", 25), reason("domain_new", 10), reason("punycode", 8)], opts);
    expect(r.groups.links).toBe(30);
    expect(r.score).toBe(30);
    expect(r.flag).toBe("yellow");
  });

  it("applies the floor rule", () => {
    const r = fuse([reason("urgency", 4)], { ...opts, floor: true });
    expect(r.score).toBe(80);
    expect(r.flag).toBe("darkred");
  });

  it("floors an executable at 50 and still lets a blocklist floor win", () => {
    const executable = fuse([reason("attachment_exec", 15)], opts);
    expect(executable.groups.attachments).toBe(10);
    expect(executable.score).toBe(50);
    expect(executable.overridesApplied.map((item) => item.id)).toEqual(["executable_or_macro"]);
    const both = fuse([reason("attachment_exec", 15), reason("known_bad", 10)], { ...opts, floor: true });
    expect(both.score).toBe(80);
    expect(both.overridesApplied.map((item) => item.id)).toEqual(["blocklist", "executable_or_macro"]);
  });

  it("raises a lookalike plus an executable or a payment ask to 70, and a named pay-link to 65", () => {
    const executable = fuse([reason("lookalike_homoglyph", 25), reason("attachment_exec", 15)], opts);
    expect(executable.score).toBe(70);
    expect(executable.overridesApplied.map((item) => item.id)).toContain("lookalike_with_exec_or_ask");

    const payment = fuse([reason("lookalike_combosquat", 18), reason("payment_lure", 6)], opts);
    expect(payment.score).toBe(70);
    expect(payment.flag).toBe("red");

    const named = fuse(
      [reason("impersonated_link", 18), reason("lure_destination", 20), reason("punycode", 8), reason("payment_lure", 6)],
      opts,
    );
    expect(named.score).toBe(65);
    expect(named.overridesApplied.map((item) => item.id)).toEqual(["named_institution_pay_link"]);

    const spoof = fuse(
      [
        { code: "institution_domain_spoof", group: "sender", weight: 0, text_sq: "", text_en: "" },
        reason("payment_lure", 6),
      ],
      opts,
    );
    expect(spoof.score).toBe(85);
    expect(spoof.overridesApplied[0]?.id).toBe("institution_spoof_payment");
  });

  it("applies the cap rule", () => {
    const r = fuse([reason("payment_lure", 4), reason("threat", 4), reason("classifier", 15)], { ...opts, cap: true });
    expect(r.score).toBeLessThanOrEqual(19);
    expect(r.flag).toBe("green");
  });

  it("never shows green for input that was not analysed", () => {
    const r = fuse([], { ...opts, analysed: false });
    expect(r.flag).toBe("grey");
  });

  it("maps default thresholds", () => {
    expect([0, 19, 20, 39, 40, 59, 60, 79, 80, 100].map((s) => flagForScore(s))).toEqual([
      "green", "green", "yellow", "yellow", "orange", "orange", "red", "red", "darkred", "darkred",
    ]);
  });

  it("sorts reasons by weight and keeps at most 8", () => {
    const many = ["urgency", "payment_lure", "threat", "asks_secrets", "punycode", "odd_tld", "shortener", "whois_privacy", "cert_fast"] as const;
    const r = fuse(many.map((c, i) => reason(c, i + 1)), opts);
    expect(r.reasons).toHaveLength(8);
    expect(r.reasons[0].weight).toBe(9);
  });
});
