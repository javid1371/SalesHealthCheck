import { readFileSync } from "node:fs";
import { join } from "node:path";
import { domainsV1 } from "../domains";
import type {
  DomainReportConfig,
  ModelV1FromCsv,
  PublicQuestionConfig,
  QuestionAnalysisEntry,
} from "../types";
import {
  parseDomainScoreBands,
  parseQuestionOptionInterpretations,
} from "./parse-score-bands";

export type { ModelV1FromCsv } from "../types";

const CSV_PATH = join(
  process.cwd(),
  "src/config/model-v1/question-bank/data/questions-v1-full.csv",
);

const domainSlugByNumber = new Map(
  [...domainsV1]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((domain) => [domain.displayOrder, domain.slug]),
);

const CSV_COLUMNS = {
  question: "سؤال",
  domainNumber: "شماره دامنه",
  domainTitle: "عنوان دامنه",
  questionNumber: "شماره سؤال",
  option0: "گزینه ۰",
  option1: "گزینه ۱",
  option2: "گزینه ۲",
  option3: "گزینه ۳",
  correctiveAction: "اقدام اصلاحی بخش",
  diagnosticIntent: "تشخیص پشت‌صحنه سؤال",
  domainScoreInterpretation: "تفسیر امتیاز (بخش)",
  questionScoreInterpretation: "تفسیر امتیاز (سؤال)",
  diagnosticSymptoms: "عارضه‌های تشخیصی بخش",
} as const;

type ParsedRow = Record<(typeof CSV_COLUMNS)[keyof typeof CSV_COLUMNS], string>;

function parseCsvLine(line: string): string[] {
  return line.split(",");
}

function parseCsvRows(content: string): ParsedRow[] {
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) {
    throw new Error("Question CSV must include a header and at least one row");
  }

  const headers = parseCsvLine(lines[0]);
  const columnIndex = new Map<string, number>();

  for (const [key, header] of Object.entries(CSV_COLUMNS)) {
    const index = headers.indexOf(header);
    if (index === -1) {
      throw new Error(`Missing CSV column: ${header} (${key})`);
    }
    columnIndex.set(key, index);
  }

  return lines.slice(1).map((line, rowIndex) => {
    const columns = parseCsvLine(line);
    const expectedColumns = headers.length;

    if (columns.length !== expectedColumns) {
      throw new Error(
        `Invalid CSV row ${rowIndex + 2}: expected ${expectedColumns} columns, got ${columns.length}`,
      );
    }

    const get = (key: keyof typeof CSV_COLUMNS) => {
      const index = columnIndex.get(key);
      if (index === undefined) {
        throw new Error(`Missing column index for ${key}`);
      }
      return columns[index]?.trim() ?? "";
    };

    return {
      [CSV_COLUMNS.question]: get("question"),
      [CSV_COLUMNS.domainNumber]: get("domainNumber"),
      [CSV_COLUMNS.domainTitle]: get("domainTitle"),
      [CSV_COLUMNS.questionNumber]: get("questionNumber"),
      [CSV_COLUMNS.option0]: get("option0"),
      [CSV_COLUMNS.option1]: get("option1"),
      [CSV_COLUMNS.option2]: get("option2"),
      [CSV_COLUMNS.option3]: get("option3"),
      [CSV_COLUMNS.correctiveAction]: get("correctiveAction"),
      [CSV_COLUMNS.diagnosticIntent]: get("diagnosticIntent"),
      [CSV_COLUMNS.domainScoreInterpretation]: get("domainScoreInterpretation"),
      [CSV_COLUMNS.questionScoreInterpretation]: get("questionScoreInterpretation"),
      [CSV_COLUMNS.diagnosticSymptoms]: get("diagnosticSymptoms"),
    };
  });
}

function toPublicQuestion(row: ParsedRow, domainSlug: string): PublicQuestionConfig {
  const questionNumber = Number(row[CSV_COLUMNS.questionNumber]);

  return {
    domainSlug,
    displayOrder: questionNumber,
    text: row[CSV_COLUMNS.question],
    options: [
      { score: 0, text: row[CSV_COLUMNS.option0] },
      { score: 1, text: row[CSV_COLUMNS.option1] },
      { score: 2, text: row[CSV_COLUMNS.option2] },
      { score: 3, text: row[CSV_COLUMNS.option3] },
    ],
  };
}

function toQuestionAnalysis(
  row: ParsedRow,
  domainSlug: string,
): QuestionAnalysisEntry {
  const questionNumber = Number(row[CSV_COLUMNS.questionNumber]);
  const interpretations = parseQuestionOptionInterpretations(
    row[CSV_COLUMNS.questionScoreInterpretation],
  );

  const optionInterpretations = {
    0: "",
    1: "",
    2: "",
    3: "",
  } as Record<0 | 1 | 2 | 3, string>;

  for (const interpretation of interpretations) {
    optionInterpretations[interpretation.score] = interpretation.description;
  }

  return {
    domainSlug,
    questionNumber,
    diagnosticIntent: row[CSV_COLUMNS.diagnosticIntent],
    optionInterpretations,
  };
}

function toDomainReportConfig(row: ParsedRow, domainSlug: string): DomainReportConfig {
  return {
    domainSlug,
    correctiveAction: row[CSV_COLUMNS.correctiveAction],
    diagnosticSymptoms: row[CSV_COLUMNS.diagnosticSymptoms],
    domainScoreBands: parseDomainScoreBands(row[CSV_COLUMNS.domainScoreInterpretation]),
  };
}

export function loadModelV1FromCsv(csvPath: string = CSV_PATH): ModelV1FromCsv {
  const content = readFileSync(csvPath, "utf8");
  const rows = parseCsvRows(content);

  const questions: PublicQuestionConfig[] = [];
  const questionAnalysis: QuestionAnalysisEntry[] = [];
  const domains: DomainReportConfig[] = [];
  const domainConfigBySlug = new Map<string, DomainReportConfig>();

  for (const row of rows) {
    const domainNumber = Number(row[CSV_COLUMNS.domainNumber]);
    const domainSlug = domainSlugByNumber.get(domainNumber);

    if (!domainSlug) {
      throw new Error(`Unknown domain number in CSV: ${domainNumber}`);
    }

    questions.push(toPublicQuestion(row, domainSlug));
    questionAnalysis.push(toQuestionAnalysis(row, domainSlug));

    if (!domainConfigBySlug.has(domainSlug)) {
      const domainConfig = toDomainReportConfig(row, domainSlug);
      domainConfigBySlug.set(domainSlug, domainConfig);
      domains.push(domainConfig);
    }
  }

  questions.sort((a, b) => {
    const domainOrderA =
      domainsV1.find((domain) => domain.slug === a.domainSlug)?.displayOrder ?? 0;
    const domainOrderB =
      domainsV1.find((domain) => domain.slug === b.domainSlug)?.displayOrder ?? 0;

    if (domainOrderA !== domainOrderB) {
      return domainOrderA - domainOrderB;
    }

    return a.displayOrder - b.displayOrder;
  });

  questionAnalysis.sort((a, b) => {
    const domainOrderA =
      domainsV1.find((domain) => domain.slug === a.domainSlug)?.displayOrder ?? 0;
    const domainOrderB =
      domainsV1.find((domain) => domain.slug === b.domainSlug)?.displayOrder ?? 0;

    if (domainOrderA !== domainOrderB) {
      return domainOrderA - domainOrderB;
    }

    return a.questionNumber - b.questionNumber;
  });

  domains.sort((a, b) => {
    const domainOrderA =
      domainsV1.find((domain) => domain.slug === a.domainSlug)?.displayOrder ?? 0;
    const domainOrderB =
      domainsV1.find((domain) => domain.slug === b.domainSlug)?.displayOrder ?? 0;
    return domainOrderA - domainOrderB;
  });

  return { questions, questionAnalysis, domains };
}
