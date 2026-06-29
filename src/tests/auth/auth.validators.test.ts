import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import {
  normalizePhone,
  validateSendOtpRequest,
  validateVerifyOtpRequest,
} from "@/modules/auth/auth.validators";

describe("normalizePhone", () => {
  it("accepts 11-digit numbers starting with 09", () => {
    expect(normalizePhone("09123456789")).toBe("09123456789");
  });

  it("strips separators from local format", () => {
    expect(normalizePhone("0912-345-6789")).toBe("09123456789");
    expect(normalizePhone("0912 345 6789")).toBe("09123456789");
  });

  it("normalizes 10-digit numbers starting with 9", () => {
    expect(normalizePhone("9123456789")).toBe("09123456789");
  });

  it("normalizes +98 international format", () => {
    expect(normalizePhone("+98 912 345 6789")).toBe("09123456789");
  });

  it("normalizes 0098 international format", () => {
    expect(normalizePhone("00989123456789")).toBe("09123456789");
  });

  it("returns null for invalid lengths or prefixes", () => {
    expect(normalizePhone("08123456789")).toBeNull();
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });
});

describe("validateSendOtpRequest", () => {
  it("returns normalized phone for valid input", () => {
    expect(validateSendOtpRequest({ phone: "+98 912 345 6789" })).toEqual({
      phone: "09123456789",
    });
  });

  it("rejects missing phone", () => {
    expect(() => validateSendOtpRequest({})).toThrow(AppError);
  });

  it("rejects invalid phone format", () => {
    expect(() => validateSendOtpRequest({ phone: "12345" })).toThrow(AppError);
  });
});

describe("validateVerifyOtpRequest", () => {
  it("returns normalized phone and 6-digit code", () => {
    expect(
      validateVerifyOtpRequest({ phone: "9123456789", code: "123456" }),
    ).toEqual({
      phone: "09123456789",
      code: "123456",
    });
  });

  it("rejects non-6-digit codes", () => {
    expect(() =>
      validateVerifyOtpRequest({ phone: "09123456789", code: "12345" }),
    ).toThrow(AppError);
  });
});
