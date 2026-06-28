import { loadModelV1FromCsv } from "./question-bank/load-model-v1-from-csv";
import type { PublicQuestionConfig } from "./types";

export const questionsV1: PublicQuestionConfig[] = loadModelV1FromCsv().questions;

export type { PublicQuestionConfig, QuestionConfig, QuestionOptionConfig } from "./types";
