import { describe, expect, it } from "vitest";
import { ctx } from "./fixtures";
import { ageFromRegistration, fillMissingDomainAges, rdapUrl, registrationDate, submittedHosts } from "../domain-age";

describe("domain registration lookup", () => {
  it("reads the registration event and ignores other dates", () => {
    expect(
      registrationDate({
        events: [
          { eventAction: "last changed", eventDate: "2020-01-01T00:00:00Z" },
          { eventAction: "registration", eventDate: "2026-11-01T00:00:00Z" },
        ],
      }),
    ).toBe("2026-11-01T00:00:00Z");
    expect(registrationDate({ events: [] })).toBeNull();
    expect(registrationDate(null)).toBeNull();
  });

  it("turns a registration date into a whole-day age", () => {
    expect(ageFromRegistration("2026-11-01T00:00:00Z", new Date("2026-11-20T12:00:00Z"))).toBe(19);
    expect(ageFromRegistration("not-a-date")).toBeNull();
  });

  it("stores a looked-up age and does not ask for a host that is already known", async () => {
    const asked: string[] = [];
    const c = ctx();
    const fetcher = (async (url: string | URL | Request) => {
      asked.push(String(url));
      return new Response(
        JSON.stringify({ events: [{ eventAction: "registration", eventDate: "2026-11-18T00:00:00Z" }] }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;
    await fillMissingDomainAges(c, ["postashqipta.com", "1ezhe-gov.al.example"], new Date("2026-11-20T00:00:00Z"), fetcher, new Map());
    expect(asked).toEqual(["https://rdap.org/domain/postashqipta.com"]);
    expect(c.domainIntel.get("postashqipta.com")?.ageDays).toBe(2);
    expect(c.domainIntel.get("1ezhe-gov.al.example")?.ageDays).toBe(4);
  });

  it("asks for every domain in the submission", async () => {
    const asked: string[] = [];
    const fetcher = (async (url: string | URL | Request) => {
      asked.push(String(url));
      return new Response(JSON.stringify({ events: [{ eventAction: "registration", eventDate: "2026-11-01T00:00:00Z" }] }), { status: 200 });
    }) as typeof fetch;
    const services = new Map([["com", "https://rdap.verisign.com/com/v1/"]]);
    await fillMissingDomainAges(
      ctx(),
      ["pay.one.example", "two.com", "www.three.com", "four.co.uk"],
      new Date("2026-11-20T00:00:00Z"),
      fetcher,
      services,
    );
    expect(asked.sort()).toEqual(
      [
        "https://rdap.org/domain/four.co.uk",
        "https://rdap.verisign.com/com/v1/domain/three.com",
        "https://rdap.verisign.com/com/v1/domain/two.com",
      ].sort(),
    );
  });

  it("collects every link host and an email sender domain", () => {
    expect(
      submittedHosts({
        kind: "text",
        text: "Pay at https://one.example/a and hxxps://two[.]example/b",
        sender: "Desk <fee@mail.test>",
      }).sort(),
    ).toEqual(["mail.test", "one.example", "two.example"]);
  });

  it("points a known TLD at its registry server", () => {
    expect(rdapUrl("postashqipta.com", new Map([["com", "https://rdap.verisign.com/com/v1/"]]))).toBe(
      "https://rdap.verisign.com/com/v1/domain/postashqipta.com",
    );
  });
});
