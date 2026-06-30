import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { assertResultAccess } from "@/modules/assessment/assessment.service";

const assessment = {
  userId: "user-1",
  resultToken: "valid-token",
};

describe("assertResultAccess", () => {
  it("allows a valid result token", () => {
    expect(() =>
      assertResultAccess({
        assessment,
        token: "valid-token",
      }),
    ).not.toThrow();
  });

  it("allows the assessment owner via user session", () => {
    expect(() =>
      assertResultAccess({
        assessment,
        userSession: { userId: "user-1" },
      }),
    ).not.toThrow();
  });

  it("allows any assessment when admin session is present", () => {
    expect(() =>
      assertResultAccess({
        assessment,
        adminSession: { role: "admin" },
      }),
    ).not.toThrow();
  });

  it("allows any assessment when sales expert session is present", () => {
    expect(() =>
      assertResultAccess({
        assessment,
        salesExpertSession: { role: "sales_expert" },
      }),
    ).not.toThrow();
  });

  it("rejects invalid token without session", () => {
    expect(() =>
      assertResultAccess({
        assessment,
        token: "wrong-token",
      }),
    ).toThrow(AppError);

    try {
      assertResultAccess({
        assessment,
        token: "wrong-token",
      });
    } catch (error) {
      expect(error).toMatchObject({
        code: "assessment_access_denied",
        status: 403,
      });
    }
  });

  it("rejects a different user's session", () => {
    expect(() =>
      assertResultAccess({
        assessment,
        userSession: { userId: "user-2" },
      }),
    ).toThrow(AppError);
  });

  it("rejects when no credentials are provided", () => {
    expect(() => assertResultAccess({ assessment })).toThrow(AppError);
  });
});
