import { describe, expect, it } from "vitest";
import {
  hashPassword,
  sanitizePassword,
  verifyConfiguredPassword,
} from "@/lib/password-auth";

describe("sanitizePassword", () => {
  it("trims whitespace and strips bidi marks", () => {
    expect(sanitizePassword("  secret  ")).toBe("secret");
    expect(sanitizePassword("\u200Fsecret\u200E")).toBe("secret");
  });
});

describe("hashPassword / verifyConfiguredPassword", () => {
  it("verifies a matching password", () => {
    const hash = hashPassword("correct-horse");
    expect(verifyConfiguredPassword("correct-horse", { hash })).toBe(true);
    expect(verifyConfiguredPassword("wrong-horse", { hash })).toBe(false);
  });

  it("accepts copied passwords with trailing space or RTL marks", () => {
    const hash = hashPassword("correct-horse");
    expect(verifyConfiguredPassword("correct-horse ", { hash })).toBe(true);
    expect(verifyConfiguredPassword("\u202Bcorrect-horse\u202C", { hash })).toBe(
      true,
    );
  });
});
