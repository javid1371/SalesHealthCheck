import { describe, expect, it } from "vitest";
import { validateTransferLeadRequest } from "@/modules/consultation/consultation-lead.validators";

describe("validateTransferLeadRequest", () => {
  it("accepts a valid transfer payload", () => {
    const result = validateTransferLeadRequest({
      toStaffUserId: "expert-2",
      reason: "customer_request",
      note: "مشتری درخواست کرد با سارا صحبت کند",
    });

    expect(result).toEqual({
      toStaffUserId: "expert-2",
      reason: "customer_request",
      note: "مشتری درخواست کرد با سارا صحبت کند",
    });
  });

  it("rejects missing reason", () => {
    expect(() =>
      validateTransferLeadRequest({
        toStaffUserId: "expert-2",
        note: "مشتری درخواست کرد با سارا صحبت کند",
      }),
    ).toThrowError(/دلیل انتقال/);
  });

  it("rejects short note", () => {
    expect(() =>
      validateTransferLeadRequest({
        toStaffUserId: "expert-2",
        reason: "other",
        note: "کوتاه",
      }),
    ).toThrowError(/حداقل/);
  });
});
