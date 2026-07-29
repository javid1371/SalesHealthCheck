import { AppError } from "@/lib/errors";
import {
  listMessengerLabelsForAdmin,
  updateMessengerLabels,
  type MessengerLabelAdminDomain,
  type MessengerLabelUpdate,
} from "./messenger-labels.repository";
import { MESSENGER_BUTTON_MAX_LENGTH } from "./messenger-labels.utils";

export type { MessengerLabelAdminDomain, MessengerLabelUpdate };

export async function getMessengerLabelsForAdmin(): Promise<{
  domains: MessengerLabelAdminDomain[];
  modelVersionId: string | null;
  modelVersionName: string | null;
}> {
  return listMessengerLabelsForAdmin();
}

function normalizeLabel(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export async function saveMessengerLabels(
  updates: MessengerLabelUpdate[],
): Promise<{ updated: number }> {
  if (!Array.isArray(updates)) {
    throw new AppError("VALIDATION_ERROR", "updates must be an array", 400);
  }
  if (updates.length === 0) {
    return { updated: 0 };
  }
  if (updates.length > 500) {
    throw new AppError(
      "VALIDATION_ERROR",
      "updates cannot exceed 500 items",
      400,
    );
  }

  const normalized: MessengerLabelUpdate[] = [];

  for (const item of updates) {
    if (!item || typeof item.optionId !== "string" || !item.optionId.trim()) {
      throw new AppError(
        "VALIDATION_ERROR",
        "each update requires a valid optionId",
        400,
      );
    }

    const messengerLabel = normalizeLabel(item.messengerLabel);
    if (
      messengerLabel !== null &&
      messengerLabel.length > MESSENGER_BUTTON_MAX_LENGTH
    ) {
      throw new AppError(
        "VALIDATION_ERROR",
        `messengerLabel exceeds ${MESSENGER_BUTTON_MAX_LENGTH} characters`,
        400,
      );
    }

    normalized.push({
      optionId: item.optionId.trim(),
      messengerLabel,
    });
  }

  return updateMessengerLabels(normalized);
}
