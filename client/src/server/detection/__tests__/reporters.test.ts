import { describe, expect, it } from "vitest";
import { countDistinctReporters } from "../reporters";

describe("countDistinctReporters", () => {
  it("counts a person once and ignores reports with no identity", () => {
    const rows = countDistinctReporters([
      { urls: ["https://crowd.example/a"], reporterId: "user-1", ipHash: "ip-a" },
      { urls: ["https://crowd.example/a"], reporterId: "user-1", ipHash: "ip-b" },
      { urls: ["hxxps://crowd[.]example/b"], reporterId: null, ipHash: "ip-c" },
      { urls: ["https://crowd.example/c"], reporterId: null, ipHash: null },
    ]);
    expect(rows.find((row) => row.kind === "domain")?.count).toBe(2);
  });
});