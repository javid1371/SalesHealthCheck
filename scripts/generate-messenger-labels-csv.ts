/**
 * Generates option-labels.v1.csv from questions-v1-full.csv.
 * Run: tsx scripts/generate-messenger-labels-csv.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { domainsV1 } from "../src/config/model-v1/domains";
import { parseQuestionOptionInterpretations } from "../src/config/model-v1/question-bank/parse-score-bands";

const MAX_LABEL_LENGTH = 64;
const CSV_PATH = join(
  process.cwd(),
  "src/config/model-v1/question-bank/data/questions-v1-full.csv",
);

const domainSlugByNumber = new Map(
  [...domainsV1]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((domain) => [domain.displayOrder, domain.slug]),
);

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

function truncateLabel(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= MAX_LABEL_LENGTH) {
    return trimmed;
  }
  return `${trimmed.slice(0, MAX_LABEL_LENGTH - 1)}…`;
}

function buildMessengerLabel(
  score: number,
  label: string,
  description: string,
): string {
  const prefix = `${score} ${label}`;
  const separator = ": ";
  const available = MAX_LABEL_LENGTH - prefix.length - separator.length;

  if (available <= 8) {
    return truncateLabel(prefix);
  }

  const shortDescription =
    description.length > available
      ? `${description.slice(0, available - 1)}…`
      : description;

  return truncateLabel(`${prefix}${separator}${shortDescription}`);
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function main() {
  const content = readFileSync(CSV_PATH, "utf8").trim();
  const lines = content.split("\n");
  const header = parseCsvLine(lines[0]!);
  const questionScoreIndex = header.indexOf("تفسیر امتیاز (سؤال)");
  const domainNumberIndex = header.indexOf("شماره دامنه");
  const questionNumberIndex = header.indexOf("شماره سؤال");

  if (
    questionScoreIndex === -1 ||
    domainNumberIndex === -1 ||
    questionNumberIndex === -1
  ) {
    throw new Error("CSV header columns not found");
  }

  const rows: string[] = [
    "domain_slug,question_display_order,score,messenger_label",
  ];

  for (const line of lines.slice(1)) {
    const columns = parseCsvLine(line);
    const domainNumber = Number(columns[domainNumberIndex]);
    const questionNumber = Number(columns[questionNumberIndex]);
    const domainSlug = domainSlugByNumber.get(domainNumber);

    if (!domainSlug) {
      throw new Error(`Unknown domain number: ${domainNumber}`);
    }

    const interpretations = parseQuestionOptionInterpretations(
      columns[questionScoreIndex] ?? "",
    );

    for (const interpretation of interpretations) {
      const messengerLabel = buildMessengerLabel(
        interpretation.score,
        interpretation.label,
        interpretation.description,
      );

      if (messengerLabel.length > MAX_LABEL_LENGTH) {
        throw new Error(
          `Label exceeds ${MAX_LABEL_LENGTH} chars for ${domainSlug} q${questionNumber} score ${interpretation.score}`,
        );
      }

      rows.push(
        [
          domainSlug,
          String(questionNumber),
          String(interpretation.score),
          escapeCsv(messengerLabel),
        ].join(","),
      );
    }
  }

  const outputPath = join(
    process.cwd(),
    "src/config/model-v1/messenger/option-labels.v1.csv",
  );

  writeFileSync(outputPath, `${rows.join("\n")}\n`, "utf8");
  console.log(`Wrote ${rows.length - 1} labels to ${outputPath}`);
}

main();
