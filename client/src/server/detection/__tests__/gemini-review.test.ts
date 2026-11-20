import { describe, expect, it } from "vitest";
import { parseGeminiReview, reviewWithGemini } from "../gemini-review";

describe("parseGeminiReview", () => {
  it("reads a JSON object, including one wrapped in extra text", () => {
    const review = parseGeminiReview(
      '```json\n{"scam":true,"confidence":1.4,"scamType":"fake_bank","brand":"bank","clues":["secrets","secrets","nope"]}\n```',
    );
    expect(review).toEqual({
      scam: true,
      confidence: 1,
      scamType: "fake_bank",
      brand: "bank",
      clues: ["secrets"],
    });
  });

  it("ignores a reply that is not the expected object", () => {
    expect(parseGeminiReview("this is a scam")).toBeNull();
    expect(parseGeminiReview('{"scam":true,"confidence":0.8,"scamType":"lottery","brand":"bank","clues":[]}')).toBeNull();
    expect(parseGeminiReview(null)).toBeNull();
  });
});

describe("reviewWithGemini", () => {
  it("sends masked text and drops a failed reply", async () => {
    let sent = "";
    const review = await reviewWithGemini("Call me at +355 69 111 2222 about the parcel fee today", async ({ data }) => {
      sent = data;
      return null;
    });
    expect(review).toBeNull();
    expect(sent).toContain("[PHONE]");
    expect(sent).not.toContain("691112222");
  });
});
