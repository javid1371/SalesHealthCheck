import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { beforeEach, describe, expect, it, vi } from "vitest";

const repoMock = vi.hoisted(() => ({
  createConsultationRequest: vi.fn(),
  findLatestAssignedStaffIdByPhone: vi.fn(),
  findOpenConsultationRequestByPhone: vi.fn(),
  updateConsultationRequestMessage: vi.fn(),
}));

const assessmentMock = vi.hoisted(() => ({
  findUserByEmailOrPhone: vi.fn(),
}));

const funnelRepoMock = vi.hoisted(() => ({
  addPhoneOptOut: vi.fn(),
  createSmsInbound: vi.fn(),
  findSmsInboundByProviderMessageId: vi.fn(),
}));

const finalizeMock = vi.hoisted(() => ({
  finalizeNewLead: vi.fn(),
}));

vi.mock("@/modules/consultation/consultation.repository", () => repoMock);
vi.mock("@/modules/assessment/assessment.repository", () => assessmentMock);
vi.mock("@/modules/sms-funnel/funnel.repository", () => funnelRepoMock);
vi.mock("@/modules/consultation/lead-assignment.service", () => finalizeMock);

import {
  classifyInboundSmsBody,
  handleInboundSms,
  inboundSmsFromKavenegarParams,
  SMS_INBOUND_LEAD_NAME,
} from "@/modules/sms-funnel/inbound.service";

const PHONE_LOCAL = "09121111111";
const PHONE_KAVENEGAR = "989121111111";
const MESSAGE_ID = "kv-msg-1";

function uniqueConstraintError() {
  return new PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "6.0.0",
  });
}

describe("classifyInboundSmsBody", () => {
  it.each([
    ["1", "interest"],
    ["۱", "interest"],
    ["بله", "interest"],
    [" 1 ", "interest"],
    ["  بله  ", "interest"],
    ["لغو", "opt_out"],
    [" stop ", "opt_out"],
    ["STOP", "opt_out"],
    ["Stop", "opt_out"],
    ["hello", "ignored"],
    ["2", "ignored"],
    ["maybe", "ignored"],
    ["1 please", "ignored"],
    ["", "ignored"],
  ] as const)("classifies %j as %s", (body, handledAs) => {
    expect(classifyInboundSmsBody(body)).toBe(handledAs);
  });
});

describe("inboundSmsFromKavenegarParams", () => {
  it("reads from, to, message, and messageid", () => {
    expect(
      inboundSmsFromKavenegarParams({
        from: PHONE_KAVENEGAR,
        to: "10004346",
        message: "1",
        messageid: MESSAGE_ID,
      }),
    ).toEqual({
      providerMessageId: MESSAGE_ID,
      from: PHONE_KAVENEGAR,
      to: "10004346",
      body: "1",
    });
  });

  it("accepts sender, receptor, text, and messageId aliases", () => {
    const params = new URLSearchParams({
      sender: PHONE_KAVENEGAR,
      receptor: "10004346",
      text: "بله",
      messageId: "kv-alias",
    });

    expect(inboundSmsFromKavenegarParams(params)).toEqual({
      providerMessageId: "kv-alias",
      from: PHONE_KAVENEGAR,
      to: "10004346",
      body: "بله",
    });
  });
});

describe("handleInboundSms", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    funnelRepoMock.findSmsInboundByProviderMessageId.mockResolvedValue(null);
    funnelRepoMock.createSmsInbound.mockResolvedValue({ id: "inbound-1" });
    funnelRepoMock.addPhoneOptOut.mockResolvedValue(undefined);
    repoMock.findOpenConsultationRequestByPhone.mockResolvedValue(null);
    repoMock.findLatestAssignedStaffIdByPhone.mockResolvedValue(null);
    repoMock.createConsultationRequest.mockResolvedValue({ id: "lead-1" });
    repoMock.updateConsultationRequestMessage.mockResolvedValue({});
    assessmentMock.findUserByEmailOrPhone.mockResolvedValue(null);
    finalizeMock.finalizeNewLead.mockResolvedValue(undefined);
  });

  it.each(["1", "۱", "بله"])(
    "creates a direct lead and finalizes for interest keyword %j",
    async (body) => {
      const result = await handleInboundSms({
        providerMessageId: `${MESSAGE_ID}-${body}`,
        from: PHONE_LOCAL,
        to: "10004346",
        body,
      });

      expect(result).toEqual({
        handledAs: "interest",
        consultationRequestId: "lead-1",
        duplicate: false,
      });
      expect(repoMock.createConsultationRequest).toHaveBeenCalledWith({
        name: SMS_INBOUND_LEAD_NAME,
        phone: PHONE_LOCAL,
        message: body,
        source: "direct",
      });
      expect(finalizeMock.finalizeNewLead).toHaveBeenCalledWith("lead-1", {
        mode: "immediate",
        preferStaffId: null,
      });
      expect(funnelRepoMock.createSmsInbound).toHaveBeenCalledWith(
        expect.objectContaining({
          providerMessageId: `${MESSAGE_ID}-${body}`,
          fromPhone: PHONE_LOCAL,
          toLine: "10004346",
          body,
          handledAs: "interest",
          consultationRequestId: "lead-1",
        }),
      );
      expect(funnelRepoMock.addPhoneOptOut).not.toHaveBeenCalled();
    },
  );

  it("normalizes Kavenegar 98912… sender to 09… before lookup and create", async () => {
    await handleInboundSms({
      providerMessageId: MESSAGE_ID,
      from: PHONE_KAVENEGAR,
      to: "10004346",
      body: "1",
    });

    expect(repoMock.findOpenConsultationRequestByPhone).toHaveBeenCalledWith(
      PHONE_LOCAL,
    );
    expect(repoMock.createConsultationRequest).toHaveBeenCalledWith(
      expect.objectContaining({ phone: PHONE_LOCAL }),
    );
    expect(funnelRepoMock.createSmsInbound).toHaveBeenCalledWith(
      expect.objectContaining({ fromPhone: PHONE_LOCAL }),
    );
  });

  it("uses the existing user's name when the phone already has an account", async () => {
    assessmentMock.findUserByEmailOrPhone.mockResolvedValue({
      id: "user-1",
      name: "سارا محمدی",
    });

    await handleInboundSms({
      providerMessageId: MESSAGE_ID,
      from: PHONE_LOCAL,
      body: "1",
    });

    expect(assessmentMock.findUserByEmailOrPhone).toHaveBeenCalledWith(
      undefined,
      PHONE_LOCAL,
    );
    expect(repoMock.createConsultationRequest).toHaveBeenCalledWith(
      expect.objectContaining({ name: "سارا محمدی" }),
    );
  });

  it("reuses an open unassigned lead: updates message and finalizes once", async () => {
    repoMock.findOpenConsultationRequestByPhone.mockResolvedValue({
      id: "open-lead",
      assignedToId: null,
      status: "new",
      phone: PHONE_LOCAL,
    });

    const result = await handleInboundSms({
      providerMessageId: MESSAGE_ID,
      from: PHONE_LOCAL,
      body: "1",
    });

    expect(result.consultationRequestId).toBe("open-lead");
    expect(repoMock.createConsultationRequest).not.toHaveBeenCalled();
    expect(repoMock.updateConsultationRequestMessage).toHaveBeenCalledWith(
      "open-lead",
      "1",
    );
    expect(finalizeMock.finalizeNewLead).toHaveBeenCalledWith("open-lead", {
      mode: "immediate",
    });
    expect(finalizeMock.finalizeNewLead).toHaveBeenCalledTimes(1);
  });

  it("reuses an already-assigned open lead without re-finalizing", async () => {
    repoMock.findOpenConsultationRequestByPhone.mockResolvedValue({
      id: "open-lead",
      assignedToId: "expert-A",
      status: "new",
      phone: PHONE_LOCAL,
    });

    const result = await handleInboundSms({
      providerMessageId: MESSAGE_ID,
      from: PHONE_LOCAL,
      body: "بله",
    });

    expect(result).toEqual({
      handledAs: "interest",
      consultationRequestId: "open-lead",
      duplicate: false,
    });
    expect(repoMock.createConsultationRequest).not.toHaveBeenCalled();
    expect(repoMock.updateConsultationRequestMessage).toHaveBeenCalledWith(
      "open-lead",
      "بله",
    );
    expect(finalizeMock.finalizeNewLead).not.toHaveBeenCalled();
    expect(repoMock.findLatestAssignedStaffIdByPhone).not.toHaveBeenCalled();
  });

  it("does not create a second lead when the same messageid is replayed", async () => {
    funnelRepoMock.findSmsInboundByProviderMessageId.mockResolvedValue({
      id: "inbound-1",
      handledAs: "interest",
      consultationRequestId: "lead-1",
    });

    const result = await handleInboundSms({
      providerMessageId: MESSAGE_ID,
      from: PHONE_LOCAL,
      body: "1",
    });

    expect(result).toEqual({
      handledAs: "interest",
      consultationRequestId: "lead-1",
      duplicate: true,
    });
    expect(repoMock.createConsultationRequest).not.toHaveBeenCalled();
    expect(repoMock.updateConsultationRequestMessage).not.toHaveBeenCalled();
    expect(finalizeMock.finalizeNewLead).not.toHaveBeenCalled();
    expect(funnelRepoMock.createSmsInbound).not.toHaveBeenCalled();
    expect(funnelRepoMock.addPhoneOptOut).not.toHaveBeenCalled();
  });

  it("treats a unique-constraint race on insert as a duplicate", async () => {
    funnelRepoMock.createSmsInbound.mockRejectedValue(uniqueConstraintError());
    funnelRepoMock.findSmsInboundByProviderMessageId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "inbound-1",
        handledAs: "interest",
        consultationRequestId: "lead-1",
      });

    const result = await handleInboundSms({
      providerMessageId: MESSAGE_ID,
      from: PHONE_LOCAL,
      body: "1",
    });

    expect(result).toEqual({
      handledAs: "interest",
      consultationRequestId: "lead-1",
      duplicate: true,
    });
  });

  it.each(["لغو", "stop"])(
    "records opt-out for %j without creating or mutating a lead",
    async (body) => {
      repoMock.findOpenConsultationRequestByPhone.mockResolvedValue({
        id: "open-lead",
        assignedToId: "expert-A",
        status: "new",
        phone: PHONE_LOCAL,
      });

      const result = await handleInboundSms({
        providerMessageId: `${MESSAGE_ID}-${body}`,
        from: PHONE_KAVENEGAR,
        to: "10004346",
        body,
      });

      expect(result).toEqual({
        handledAs: "opt_out",
        consultationRequestId: null,
        duplicate: false,
      });
      expect(funnelRepoMock.addPhoneOptOut).toHaveBeenCalledWith(PHONE_LOCAL);
      expect(funnelRepoMock.addPhoneOptOut).toHaveBeenCalledTimes(1);
      expect(repoMock.createConsultationRequest).not.toHaveBeenCalled();
      expect(repoMock.updateConsultationRequestMessage).not.toHaveBeenCalled();
      expect(finalizeMock.finalizeNewLead).not.toHaveBeenCalled();
      expect(repoMock.findOpenConsultationRequestByPhone).not.toHaveBeenCalled();
      expect(funnelRepoMock.createSmsInbound).toHaveBeenCalledWith(
        expect.objectContaining({
          handledAs: "opt_out",
          consultationRequestId: null,
          fromPhone: PHONE_LOCAL,
          body,
        }),
      );
    },
  );

  it("audits ignored text without assigning or opting out", async () => {
    const result = await handleInboundSms({
      providerMessageId: MESSAGE_ID,
      from: PHONE_LOCAL,
      body: "سلام، اطلاعات بیشتر؟",
    });

    expect(result).toEqual({
      handledAs: "ignored",
      consultationRequestId: null,
      duplicate: false,
    });
    expect(funnelRepoMock.createSmsInbound).toHaveBeenCalledWith(
      expect.objectContaining({
        handledAs: "ignored",
        consultationRequestId: null,
      }),
    );
    expect(repoMock.createConsultationRequest).not.toHaveBeenCalled();
    expect(finalizeMock.finalizeNewLead).not.toHaveBeenCalled();
    expect(funnelRepoMock.addPhoneOptOut).not.toHaveBeenCalled();
  });

  it("ignores interest keywords when the sender phone cannot be normalized", async () => {
    const result = await handleInboundSms({
      providerMessageId: MESSAGE_ID,
      from: "not-a-phone",
      body: "1",
    });

    expect(result.handledAs).toBe("ignored");
    expect(result.consultationRequestId).toBeNull();
    expect(repoMock.createConsultationRequest).not.toHaveBeenCalled();
    expect(funnelRepoMock.addPhoneOptOut).not.toHaveBeenCalled();
    expect(funnelRepoMock.createSmsInbound).toHaveBeenCalledWith(
      expect.objectContaining({
        fromPhone: "not-a-phone",
        handledAs: "ignored",
      }),
    );
  });

  it("prefers the previous assignee when no open lead exists", async () => {
    repoMock.findLatestAssignedStaffIdByPhone.mockResolvedValue("expert-A");

    await handleInboundSms({
      providerMessageId: MESSAGE_ID,
      from: PHONE_LOCAL,
      body: "1",
    });

    expect(repoMock.findLatestAssignedStaffIdByPhone).toHaveBeenCalledWith(
      PHONE_LOCAL,
    );
    expect(finalizeMock.finalizeNewLead).toHaveBeenCalledWith("lead-1", {
      mode: "immediate",
      preferStaffId: "expert-A",
    });
  });
});
