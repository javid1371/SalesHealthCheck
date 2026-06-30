import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { TEST_SECRET } = vi.hoisted(() => ({
  TEST_SECRET: "test-secret-at-least-32-chars-long",
}));

vi.mock("@/lib/env", () => ({
  env: {
    nodeEnv: "test",
    authSessionSecret: TEST_SECRET,
  },
}));

import {
  parseAdminSessionCookie,
  parseSalesExpertSessionCookie,
  parseUserSessionCookie,
} from "@/lib/session";

function signTestPayload(payload: object): string {
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", TEST_SECRET)
    .update(payloadB64)
    .digest("base64url");
  return `${payloadB64}.${signature}`;
}

describe("session cookies", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("parses a valid user session cookie", () => {
    const value = signTestPayload({
      userId: "user-1",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    expect(parseUserSessionCookie(value)).toEqual({ userId: "user-1" });
  });

  it("parses a valid admin session cookie", () => {
    const value = signTestPayload({
      role: "admin",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    expect(parseAdminSessionCookie(value)).toEqual({ role: "admin" });
  });

  it("parses a valid sales expert session cookie", () => {
    const value = signTestPayload({
      role: "sales_expert",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    expect(parseSalesExpertSessionCookie(value)).toEqual({
      role: "sales_expert",
    });
  });

  it("rejects expired sessions", () => {
    const value = signTestPayload({
      userId: "user-1",
      exp: Math.floor(Date.now() / 1000) - 1,
    });

    expect(parseUserSessionCookie(value)).toBeNull();
  });

  it("rejects tampered signatures with timing-safe compare", () => {
    const value = signTestPayload({
      userId: "user-1",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const tampered = `${value.slice(0, -1)}x`;

    expect(parseUserSessionCookie(tampered)).toBeNull();
  });

  it("rejects admin cookie with wrong role", () => {
    const value = signTestPayload({
      role: "superadmin",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    expect(parseAdminSessionCookie(value)).toBeNull();
  });

  it("rejects empty user id", () => {
    const value = signTestPayload({
      userId: "",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    expect(parseUserSessionCookie(value)).toBeNull();
  });
});
