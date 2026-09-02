import { randomUUID } from "crypto";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import type { SmsInboundHandledAs } from "@prisma/client";
import { normalizePhone } from "@/modules/auth/auth.validators";
import { findUserByEmailOrPhone } from "@/modules/assessment/assessment.repository";
import {
  createConsultationRequest,
  findLatestAssignedStaffIdByPhone,
  findOpenConsultationRequestByPhone,
  updateConsultationRequestMessage,
} from "@/modules/consultation/consultation.repository";
import { finalizeNewLead } from "@/modules/consultation/lead-assignment.service";
import {
  addPhoneOptOut,
  createSmsInbound,
  findSmsInboundByProviderMessageId,
} from "./funnel.repository";
import {
  DEFAULT_INBOUND_INTEREST_KEYWORDS,
  DEFAULT_INBOUND_OPT_OUT_KEYWORDS,
  getFunnelSettings,
  normalizeInboundKeyword,
} from "./funnel-config.service";

export const SMS_INBOUND_LEAD_NAME = "مخاطب پیامک";

export type InboundSmsInput = {
  providerMessageId?: string | null;
  from: string;
  to?: string | null;
  body: string;
};

export type HandleInboundSmsResult = {
  handledAs: SmsInboundHandledAs;
  consultationRequestId: string | null;
  duplicate: boolean;
};

export function classifyInboundSmsBody(
  body: string,
  options?: {
    interestKeywords?: readonly string[];
    optOutKeywords?: readonly string[];
  },
): SmsInboundHandledAs {
  const normalized = normalizeInboundKeyword(body);
  const interestKeywords = new Set(
    (options?.interestKeywords ?? DEFAULT_INBOUND_INTEREST_KEYWORDS).map(
      normalizeInboundKeyword,
    ),
  );
  const optOutKeywords = new Set(
    (options?.optOutKeywords ?? DEFAULT_INBOUND_OPT_OUT_KEYWORDS).map(
      normalizeInboundKeyword,
    ),
  );

  if (interestKeywords.has(normalized)) {
    return "interest";
  }

  if (optOutKeywords.has(normalized)) {
    return "opt_out";
  }

  return "ignored";
}

function readParam(
  params: URLSearchParams | Record<string, unknown>,
  keys: string[],
): string {
  for (const key of keys) {
    const value =
      params instanceof URLSearchParams ? params.get(key) : params[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return "";
}

/** Map Kavenegar GET/POST fields (`from`/`sender`, `to`/`receptor`, `message`, `messageid`). */
export function inboundSmsFromKavenegarParams(
  params: URLSearchParams | Record<string, unknown>,
): InboundSmsInput {
  return {
    providerMessageId: readParam(params, [
      "messageid",
      "messageId",
      "message_id",
    ]),
    from: readParam(params, ["from", "sender"]),
    to: readParam(params, ["to", "receptor"]),
    body: readParam(params, ["message", "text", "body"]),
  };
}

function resolveProviderMessageId(raw: string | null | undefined): string {
  const trimmed = raw?.trim() ?? "";
  if (trimmed) {
    return trimmed;
  }
  return `noid:${Date.now()}:${randomUUID()}`;
}

async function recordInbound(input: {
  providerMessageId: string;
  fromPhone: string;
  toLine: string;
  body: string;
  handledAs: SmsInboundHandledAs;
  consultationRequestId?: string | null;
}): Promise<boolean> {
  try {
    await createSmsInbound(input);
    return true;
  } catch (error) {
    if (
      error instanceof PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return false;
    }
    throw error;
  }
}

async function resolveLeadName(phone: string): Promise<string> {
  const user = await findUserByEmailOrPhone(undefined, phone);
  const name = user?.name?.trim();
  return name || SMS_INBOUND_LEAD_NAME;
}

async function handleInterest(
  phone: string,
  message: string,
): Promise<string> {
  const existing = await findOpenConsultationRequestByPhone(phone);

  if (existing) {
    await updateConsultationRequestMessage(existing.id, message);
    if (!existing.assignedToId) {
      await finalizeNewLead(existing.id, { mode: "immediate" });
    }
    return existing.id;
  }

  const preferStaffId = await findLatestAssignedStaffIdByPhone(phone);
  const lead = await createConsultationRequest({
    name: await resolveLeadName(phone),
    phone,
    message,
    source: "direct",
    status: "sms_reply",
  });
  await finalizeNewLead(lead.id, { mode: "immediate", preferStaffId });
  return lead.id;
}

export async function handleInboundSms(
  input: InboundSmsInput,
): Promise<HandleInboundSmsResult> {
  const providerMessageId = resolveProviderMessageId(input.providerMessageId);
  const existing = await findSmsInboundByProviderMessageId(providerMessageId);
  if (existing) {
    return {
      handledAs: existing.handledAs,
      consultationRequestId: existing.consultationRequestId,
      duplicate: true,
    };
  }

  const body = input.body ?? "";
  const rawFrom = input.from.trim();
  const phone = normalizePhone(rawFrom);
  const fromPhone = phone ?? rawFrom;
  const toLine = input.to?.trim() ?? "";
  const settings = await getFunnelSettings();
  const keyword = classifyInboundSmsBody(body, {
    interestKeywords: settings.inboundInterestKeywords,
    optOutKeywords: settings.inboundOptOutKeywords,
  });

  let handledAs: SmsInboundHandledAs = keyword;
  let consultationRequestId: string | null = null;

  if (!phone) {
    handledAs = "ignored";
  } else if (keyword === "opt_out") {
    await addPhoneOptOut(phone);
  } else if (keyword === "interest") {
    consultationRequestId = await handleInterest(phone, body.trim());
  }

  const recorded = await recordInbound({
    providerMessageId,
    fromPhone,
    toLine,
    body,
    handledAs,
    consultationRequestId,
  });

  if (!recorded) {
    const duplicate = await findSmsInboundByProviderMessageId(
      providerMessageId,
    );
    if (duplicate) {
      return {
        handledAs: duplicate.handledAs,
        consultationRequestId: duplicate.consultationRequestId,
        duplicate: true,
      };
    }
  }

  return {
    handledAs,
    consultationRequestId,
    duplicate: false,
  };
}
