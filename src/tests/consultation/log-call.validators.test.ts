import { describe, expect, it } from "vitest";
import { validateLogCallRequest } from "@/modules/consultation/consultation-lead.validators";

describe("validateLogCallRequest", () => {
  it("accepts a valid call outcome with optional note", () => {
    expect(
      validateLogCallRequest({
        outcome: "connected_interested",
        note: "مشتری جلسه می‌خواهد",
      }),
    ).toEqual({
      outcome: "connected_interested",
      note: "مشتری جلسه می‌خواهد",
    });
  });

  it("accepts outcome without note", () => {
    expect(validateLogCallRequest({ outcome: "no_answer" })).toEqual({
      outcome: "no_answer",
    });
  });

  it("rejects invalid outcome", () => {
    expect(() =>
      validateLogCallRequest({ outcome: "picked_up" }),
    ).toThrowError(/نتیجه تماس/);
  });

  it("rejects missing outcome", () => {
    expect(() => validateLogCallRequest({ note: "فقط یادداشت" })).toThrowError(
      /نتیجه تماس/,
    );
  });

  it("trims blank note to undefined", () => {
    expect(
      validateLogCallRequest({ outcome: "busy", note: "   " }),
    ).toEqual({ outcome: "busy" });
  });
});
