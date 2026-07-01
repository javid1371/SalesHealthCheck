import { db } from "@/lib/db";
import { resolveMessengerButtonLabel } from "./messenger-labels.utils";

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
