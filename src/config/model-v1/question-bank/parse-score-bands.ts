export type ScoreBand = {
  min: number;
  max: number;
  label: string;
  description: string;
};

export type OptionScoreInterpretation = {
  score: 0 | 1 | 2 | 3;
  label: string;
  description: string;
};

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

export function normalizePersianDigits(text: string): string {
  return text.replace(/[۰-۹]/g, (char) => String(PERSIAN_DIGITS.indexOf(char)));
}

export function parseDomainScoreBands(text: string): ScoreBand[] {
  const normalized = normalizePersianDigits(text.trim());
  const bands: ScoreBand[] = [];
  const pattern = /(\d+)[–-](\d+)\s+([^:]+):\s*/g;
  const matches = [...normalized.matchAll(pattern)];

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const start = match.index! + match[0].length;
    const end =
      index + 1 < matches.length ? matches[index + 1].index! : normalized.length;
    const description = normalized.slice(start, end).trim().replace(/\.$/, "");

    bands.push({
      min: Number(match[1]),
      max: Number(match[2]),
      label: match[3].trim(),
      description,
    });
  }

  return bands;
}

export function parseQuestionOptionInterpretations(
  text: string,
): OptionScoreInterpretation[] {
  const normalized = normalizePersianDigits(text.trim());
  const interpretations: OptionScoreInterpretation[] = [];
  const pattern = /([0-3])\s+([^:]+):\s*/g;
  const matches = [...normalized.matchAll(pattern)];

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const start = match.index! + match[0].length;
    const end =
      index + 1 < matches.length ? matches[index + 1].index! : normalized.length;
    const description = normalized.slice(start, end).trim().replace(/\.$/, "");

    interpretations.push({
      score: Number(match[1]) as 0 | 1 | 2 | 3,
      label: match[2].trim(),
      description,
    });
  }

  return interpretations;
}

export function lookupScoreBand(
  bands: ScoreBand[],
  rawScore: number,
): ScoreBand | undefined {
  return bands.find((band) => rawScore >= band.min && rawScore <= band.max);
}

export function firstSentence(text: string): string {
  const trimmed = text.trim();
  const dotIndex = trimmed.indexOf(".");
  if (dotIndex === -1) {
    return trimmed;
  }

  return trimmed.slice(0, dotIndex + 1).trim();
}
