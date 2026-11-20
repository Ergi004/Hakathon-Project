import { describe, expect, it } from "vitest";
import { parseImagePayload } from "../image-input";

describe("parseImagePayload", () => {
  it("reads a data URL and a raw png payload", () => {
    expect(parseImagePayload("data:image/png;base64,aGVsbG8=")).toEqual({ mime: "image/png", data: "aGVsbG8=" });
    expect(parseImagePayload("aGVsbG8=", "image/jpeg")).toEqual({ mime: "image/jpeg", data: "aGVsbG8=" });
  });

  it("rejects other file types and oversized payloads", () => {
    expect(parseImagePayload("data:text/plain;base64,aGVsbG8=")).toBeNull();
    expect(parseImagePayload("not-base64!", "image/png")).toBeNull();
    expect(parseImagePayload("a".repeat(1_600_001), "image/png")).toBeNull();
  });
});
