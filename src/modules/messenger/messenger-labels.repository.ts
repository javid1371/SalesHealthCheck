import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { findActiveModelVersion } from "@/modules/question-bank/question-bank.repository";
import { resolveMessengerButtonLabel } from "./messenger-labels.utils";

export interface MessengerLabelAdminOption {
  optionId: string;
  score: number;
  displayOrder: number;
  text: string;
  messengerLabel: string | null;
  /** Effective button label (stored or truncated fallback). */
  resolvedLabel: string;
}

export interface MessengerLabelAdminQuestion {
  questionId: string;
  displayOrder: number;
  text: string;
  options: MessengerLabelAdminOption[];
}

export interface MessengerLabelAdminDomain {
  domainId: string;
  slug: string;
  name: string;
  displayOrder: number;
  questions: MessengerLabelAdminQuestion[];
}

export interface MessengerLabelUpdate {
  optionId: string;
  messengerLabel: string | null;
}

export async function loadMessengerLabelsByOptionIds(
  optionIds: string[],
): Promise<Map<string, string>> {
  if (optionIds.length === 0) {
    return new Map();
  }

  const options = await db.questionOption.findMany({
    where: { id: { in: optionIds } },
    select: {
      id: true,
      text: true,
      messengerLabel: true,
    },
  });

  const labels = new Map<string, string>();

  for (const option of options) {
    labels.set(
      option.id,
      resolveMessengerButtonLabel(option.messengerLabel, option.text),
    );
  }

  return labels;
}

export async function listMessengerLabelsForAdmin(): Promise<{
  domains: MessengerLabelAdminDomain[];
  modelVersionId: string | null;
  modelVersionName: string | null;
}> {
  const model = await findActiveModelVersion();
  if (!model) {
    return {
      domains: [],
      modelVersionId: null,
      modelVersionName: null,
    };
  }

  const domains = await db.domain.findMany({
    where: {
      modelVersionId: model.id,
      isActive: true,
    },
    orderBy: { displayOrder: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      displayOrder: true,
      questions: {
        where: { isActive: true },
        orderBy: { displayOrder: "asc" },
        select: {
          id: true,
          displayOrder: true,
          text: true,
          options: {
            orderBy: { displayOrder: "asc" },
            select: {
              id: true,
              score: true,
              displayOrder: true,
              text: true,
              messengerLabel: true,
            },
          },
        },
      },
    },
  });

  return {
    modelVersionId: model.id,
    modelVersionName: model.name,
    domains: domains.map((domain) => ({
      domainId: domain.id,
      slug: domain.slug,
      name: domain.name,
      displayOrder: domain.displayOrder,
      questions: domain.questions.map((question) => ({
        questionId: question.id,
        displayOrder: question.displayOrder,
        text: question.text,
        options: question.options.map((option) => ({
          optionId: option.id,
          score: option.score,
          displayOrder: option.displayOrder,
          text: option.text,
          messengerLabel: option.messengerLabel,
          resolvedLabel: resolveMessengerButtonLabel(
            option.messengerLabel,
            option.text,
          ),
        })),
      })),
    })),
  };
}

export async function updateMessengerLabels(
  updates: MessengerLabelUpdate[],
): Promise<{ updated: number }> {
  if (updates.length === 0) {
    return { updated: 0 };
  }

  const optionIds = updates.map((item) => item.optionId);
  const existing = await db.questionOption.findMany({
    where: { id: { in: optionIds } },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((row) => row.id));

  const missing = optionIds.filter((id) => !existingIds.has(id));
  if (missing.length > 0) {
    throw new AppError(
      "NOT_FOUND",
      `Unknown optionId(s): ${missing.slice(0, 5).join(", ")}`,
      404,
    );
  }

  await db.$transaction(
    updates.map((item) =>
      db.questionOption.update({
        where: { id: item.optionId },
        data: { messengerLabel: item.messengerLabel },
      }),
    ),
  );

  return { updated: updates.length };
}
