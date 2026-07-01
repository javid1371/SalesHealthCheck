/**
 * Backfills question_options.messenger_label from option-labels.v1.csv.
 * Run: tsx scripts/backfill-messenger-labels.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const MAX_LABEL_LENGTH = 64;
const EXPECTED_ROWS = 320;

const prisma = new PrismaClient();

type LabelRow = {
  domainSlug: string;
  questionDisplayOrder: number;
  score: number;
  messengerLabel: string;
};

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function loadLabelRows(): LabelRow[] {
  const csvPath = join(
    process.cwd(),
    "src/config/model-v1/messenger/option-labels.v1.csv",
  );
  const content = readFileSync(csvPath, "utf8").trim();
  const lines = content.split("\n").slice(1);

  return lines.map((line, index) => {
    const [domainSlug, questionDisplayOrder, score, messengerLabel] =
      parseCsvLine(line);

    if (!domainSlug || !questionDisplayOrder || score === undefined) {
      throw new Error(`Invalid CSV row ${index + 2}: ${line}`);
    }

    const label = messengerLabel ?? "";
    if (label.length > MAX_LABEL_LENGTH) {
      throw new Error(
        `Label too long on row ${index + 2}: ${label.length} chars`,
      );
    }

    return {
      domainSlug,
      questionDisplayOrder: Number(questionDisplayOrder),
      score: Number(score),
      messengerLabel: label,
    };
  });
}

async function main() {
  const rows = loadLabelRows();

  if (rows.length !== EXPECTED_ROWS) {
    throw new Error(`Expected ${EXPECTED_ROWS} rows, got ${rows.length}`);
  }

  const activeModel = await prisma.modelVersion.findFirst({
    where: { status: "active" },
    select: { id: true },
  });

  if (!activeModel) {
    throw new Error("No active model version found");
  }

  let updated = 0;
  const missing: string[] = [];

  for (const row of rows) {
    const option = await prisma.questionOption.findFirst({
      where: {
        score: row.score,
        question: {
          displayOrder: row.questionDisplayOrder,
          modelVersionId: activeModel.id,
          domain: {
            slug: row.domainSlug,
          },
        },
      },
      select: { id: true },
    });

    if (!option) {
      missing.push(
        `${row.domainSlug}:${row.questionDisplayOrder}:${row.score}`,
      );
      continue;
    }

    await prisma.questionOption.update({
      where: { id: option.id },
      data: { messengerLabel: row.messengerLabel },
    });
    updated += 1;
  }

  if (missing.length > 0) {
    throw new Error(
      `Failed to match ${missing.length} options. First misses: ${missing.slice(0, 5).join(", ")}`,
    );
  }

  console.log(`Updated ${updated}/${EXPECTED_ROWS} messenger labels.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
