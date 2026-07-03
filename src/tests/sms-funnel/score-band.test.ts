import { describe, expect, it } from "vitest";
import { resolveScoreBand } from "@/modules/sms-funnel/score-band";

describe("resolveScoreBand", () => {
  it("maps low scores to low band", () => {
    expect(resolveScoreBand(30)).toBe("low");
    expect(resolveScoreBand(50)).toBe("low");
  });

  it("maps medium scores", () => {
    expect(resolveScoreBand(51)).toBe("medium");
    expect(resolveScoreBand(75)).toBe("medium");
  });

  it("maps high scores", () => {
    expect(resolveScoreBand(76)).toBe("high");
    expect(resolveScoreBand(95)).toBe("high");
  });
});
