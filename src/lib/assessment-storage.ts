import type { QuestionsForAssessmentDto } from "@/modules/question-bank/question-bank.types";

const TOKEN_PREFIX = "shc:token:";
const QUESTIONS_PREFIX = "shc:questions:";
const ANSWERS_PREFIX = "shc:answers:";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function saveResultToken(assessmentId: string, token: string): void {
  if (!isBrowser()) return;
  sessionStorage.setItem(`${TOKEN_PREFIX}${assessmentId}`, token);
}

export function getResultToken(assessmentId: string): string | null {
  if (!isBrowser()) return null;
  return sessionStorage.getItem(`${TOKEN_PREFIX}${assessmentId}`);
}

export function saveQuestions(
  assessmentId: string,
  questions: QuestionsForAssessmentDto,
): void {
  if (!isBrowser()) return;
  sessionStorage.setItem(
    `${QUESTIONS_PREFIX}${assessmentId}`,
    JSON.stringify(questions),
  );
}

export function getQuestions(
  assessmentId: string,
): QuestionsForAssessmentDto | null {
  if (!isBrowser()) return null;
  const raw = sessionStorage.getItem(`${QUESTIONS_PREFIX}${assessmentId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as QuestionsForAssessmentDto;
  } catch {
    return null;
  }
}

export type AnswerMap = Record<string, string>;

export function saveAnswers(assessmentId: string, answers: AnswerMap): void {
  if (!isBrowser()) return;
  sessionStorage.setItem(
    `${ANSWERS_PREFIX}${assessmentId}`,
    JSON.stringify(answers),
  );
}

export function getAnswers(assessmentId: string): AnswerMap {
  if (!isBrowser()) return {};
  const raw = sessionStorage.getItem(`${ANSWERS_PREFIX}${assessmentId}`);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as AnswerMap;
  } catch {
    return {};
  }
}

export function setAnswer(
  assessmentId: string,
  questionId: string,
  optionId: string,
): AnswerMap {
  const answers = getAnswers(assessmentId);
  answers[questionId] = optionId;
  saveAnswers(assessmentId, answers);
  return answers;
}

export function mergeAnswersFromServer(
  assessmentId: string,
  serverAnswers: Array<{ questionId: string; selectedOptionId: string }>,
): AnswerMap {
  const local = getAnswers(assessmentId);
  const fromServer: AnswerMap = {};

  for (const answer of serverAnswers) {
    fromServer[answer.questionId] = answer.selectedOptionId;
  }

  const merged = { ...fromServer, ...local };
  saveAnswers(assessmentId, merged);
  return merged;
}
