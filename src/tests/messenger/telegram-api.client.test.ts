import { describe, expect, it, vi, beforeEach } from "vitest";
import { createTelegramClient } from "@/modules/messenger/bot/telegram-api.client";

describe("telegram-api client multipart uploads", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sendPhoto posts multipart form with photo blob and chat_id", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: { message_id: 42 } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createTelegramClient("test-token");
    const photo = Buffer.from("fake-png");

    const result = await client.sendPhoto({
      chatId: "123",
      photo,
      filename: "chart.png",
      caption: "نمودار",
    });

    expect(result.messageId).toBe("42");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.telegram.org/bottest-token/sendPhoto");
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);

    const formData = init.body as FormData;
    expect(formData.get("chat_id")).toBe("123");
    expect(formData.get("caption")).toBe("نمودار");
    expect(formData.get("photo")).toBeInstanceOf(Blob);
  });

  it("sendDocument posts multipart form with document blob", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: { message_id: 99 } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createTelegramClient("test-token");
    const document = Buffer.from("%PDF-1.4");

    const result = await client.sendDocument({
      chatId: "456",
      document,
      filename: "sales-health-report.pdf",
      caption: "گزارش",
    });

    expect(result.messageId).toBe("99");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const formData = init.body as FormData;
    expect(formData.get("chat_id")).toBe("456");
    expect(formData.get("caption")).toBe("گزارش");
    expect(formData.get("document")).toBeInstanceOf(Blob);
  });
});
