import { describe, expect, it } from "vitest";
import { parseMessengerUpdate } from "@/modules/messenger/bot/parse-update";

describe("parseMessengerUpdate", () => {
  it("parses /start command", () => {
    const update = parseMessengerUpdate({
      message: {
        message_id: 1,
        chat: { id: 12345 },
        text: "/start",
        from: { first_name: "Ali" },
      },
    });

    expect(update).toEqual({
      type: "command",
      chatId: "12345",
      command: "start",
      firstName: "Ali",
    });
  });

  it("parses contact share", () => {
    const update = parseMessengerUpdate({
      message: {
        message_id: 2,
        chat: { id: 999 },
        contact: {
          phone_number: "+989121234567",
          first_name: "Sara",
        },
      },
    });

    expect(update).toEqual({
      type: "contact",
      chatId: "999",
      phone: "+989121234567",
      firstName: "Sara",
    });
  });

  it("parses callback query with option id", () => {
    const update = parseMessengerUpdate({
      callback_query: {
        id: "cb-1",
        data: "cloption123",
        message: {
          message_id: 42,
          chat: { id: 777 },
        },
      },
    });

    expect(update).toEqual({
      type: "callback",
      chatId: "777",
      callbackQueryId: "cb-1",
      data: "cloption123",
      messageId: "42",
    });
  });

  it("parses plain text", () => {
    const update = parseMessengerUpdate({
      message: {
        message_id: 3,
        chat: { id: 555 },
        text: "  فروشگاه من  ",
      },
    });

    expect(update).toEqual({
      type: "text",
      chatId: "555",
      text: "فروشگاه من",
    });
  });

  it("returns null for unsupported updates", () => {
    expect(parseMessengerUpdate({})).toBeNull();
    expect(parseMessengerUpdate(null)).toBeNull();
  });
});
