import { randomUUID } from "crypto";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import type { SmsInboundHandledAs } from "@prisma/client";
import { normalizePhone } from "@/modules/auth/auth.validators";
import { findUserByEmailOrPhone } from "@/modules/assessment/assessment.repository";
import {
  createConsultationRequest,
  findOpenConsultationRequestByPhone,
  updateConsultationRequestMessage,
} from "@/modules/consultation/consultation.repository";
import { finalizeNewLead } from "@/modules/consultation/lead-assignment.service";
import {
  addPhoneOptOut,
  createSmsInbound,
  findSmsInboundByProviderMessageId,
} from "./funnel.repository";

export const SMS_INBOUND_LEAD_NAME = "مخاطب پیامک";

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const INTEREST_KEYWORDS = new Set(["1", "بله"]);
const OPT_OUT_KEYWORDS = new Set(["لغو", "stop"]);

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

function normalizeInboundText(raw: string): string {
  return raw
    .replace(/[۰-۹]/g, (char) => String(PERSIAN_DIGITS.indexOf(char)))
    .trim();
}

export function classifyInboundSmsBody(body: string): SmsInboundHandledAs {
  const normalized = normalizeInboundText(body);
  const lowered = normalized.toLowerCase();

  if (INTEREST_KEYWORDS.has(normalized) || INTEREST_KEYWORDS.has(lowered)) {
    return "interest";
  }

  if (OPT_OUT_KEYWORDS.has(normalized) || OPT_OUT_KEYWORDS.has(lowered)) {
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

  const lead = await createConsultationRequest({
    name: await resolveLeadName(phone),
    phone,
    message,
    source: "direct",
  });
  await finalizeNewLead(lead.id, { mode: "immediate" });
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
  const keyword = classifyInboundSmsBody(body);

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
