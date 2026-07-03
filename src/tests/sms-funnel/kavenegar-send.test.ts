import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalFetch = global.fetch;

describe("Kavenegar sendMessage", () => {
  beforeEach(() => {
    vi.stubEnv("KAVENEGAR_API_KEY", "test-key");
    vi.stubEnv("KAVENEGAR_OTP_TEMPLATE", "verify");
    vi.stubEnv("KAVENEGAR_SENDER_LINE", "10004346");
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("calls sms/send.json with receptor, sender, and message", async () => {
    global.fetch = vi.fn(async (url: string | URL | Request) => {
      const href = typeof url === "string" ? url : url.toString();
      expect(href).toContain("/sms/send.json");
      expect(href).toContain("receptor=09123456789");
      expect(href).toContain("sender=10004346");
      const parsed = new URL(href);
      expect(parsed.searchParams.get("message")).toBe("تست پیام");

      return new Response(
        JSON.stringify({
          return: { status: 200, message: "ok" },
          entries: [{ messageid: 12345 }],
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const { createSmsSender } = await import("@/modules/auth/sms/kavenegar");
    const sender = createSmsSender();
    const result = await sender.sendMessage("09123456789", "تست پیام");
    expect(result.providerMessageId).toBe("12345");
  });

  it("uses explicit config when passed to createSmsSender", async () => {
    global.fetch = vi.fn(async (url: string | URL | Request) => {
      const href = typeof url === "string" ? url : url.toString();
      expect(href).toContain("/sms/send.json");
      expect(href).toContain("sender=99998888");

      return new Response(
        JSON.stringify({
          return: { status: 200, message: "ok" },
          entries: [{ messageid: 99 }],
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const { createSmsSender } = await import("@/modules/auth/sms/kavenegar");
    const sender = createSmsSender({
      apiKey: "override-key",
      template: "override-template",
      senderLine: "99998888",
    });
    const result = await sender.sendMessage("09123456789", "تست");
    expect(result.providerMessageId).toBe("99");
  });

  it("logs free-text SMS in dev mode when Kavenegar is unset", async () => {
    vi.stubEnv("KAVENEGAR_API_KEY", "");
    vi.stubEnv("KAVENEGAR_OTP_TEMPLATE", "");

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { createSmsSender } = await import("@/modules/auth/sms/kavenegar");
    const sender = createSmsSender();
    await sender.sendMessage("09120000000", "hello");
    expect(logSpy.mock.calls.some((call) => String(call[0]).includes("[dev] SMS"))).toBe(
      true,
    );
    logSpy.mockRestore();
  });
});
