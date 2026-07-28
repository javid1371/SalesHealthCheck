import { describe, expect, it } from "vitest";
import {
  validateBulkUpdateLeadsRequest,
  validateUpdateConsultationLeadRequest,
} from "@/modules/consultation/consultation-lead.validators";

describe("validateUpdateConsultationLeadRequest lost reason", () => {
  it("requires lostReason when status is closed_lost", () => {
    expect(() =>
      validateUpdateConsultationLeadRequest({ status: "closed_lost" }),
    ).toThrowError(/دلیل باخت/);
  });

  it("accepts closed_lost with lostReason", () => {
    expect(
      validateUpdateConsultationLeadRequest({
        status: "closed_lost",
        lostReason: "timing",
      }),
    ).toEqual({
      status: "closed_lost",
      lostReason: "timing",
    });
  });

  it("accepts lostNote only with reason other", () => {
    expect(
      validateUpdateConsultationLeadRequest({
        status: "closed_lost",
        lostReason: "other",
        lostNote: "توضیح کوتاه",
      }),
    ).toEqual({
      status: "closed_lost",
      lostReason: "other",
      lostNote: "توضیح کوتاه",
    });
  });

  it("rejects lostNote for non-other reason", () => {
    expect(() =>
      validateUpdateConsultationLeadRequest({
        status: "closed_lost",
        lostReason: "price",
        lostNote: "نباید قبول شود",
      }),
    ).toThrowError(/سایر/);
  });

  it("rejects invalid lostReason", () => {
    expect(() =>
      validateUpdateConsultationLeadRequest({
        status: "closed_lost",
        lostReason: "budget",
      }),
    ).toThrowError(/دلیل باخت/);
  });
});

describe("validateBulkUpdateLeadsRequest lost reason", () => {
  it("requires lostReason for bulk closed_lost", () => {
    expect(() =>
      validateBulkUpdateLeadsRequest({
        ids: ["lead-1"],
        status: "closed_lost",
      }),
    ).toThrowError(/دلیل باخت/);
  });

  it("accepts bulk closed_lost with lostReason", () => {
    expect(
      validateBulkUpdateLeadsRequest({
        ids: ["lead-1"],
        status: "closed_lost",
        lostReason: "no_response",
      }),
    ).toEqual({
      ids: ["lead-1"],
      status: "closed_lost",
      lostReason: "no_response",
    });
  });
});
