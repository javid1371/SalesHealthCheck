import { loadModelV1FromCsv } from "./load-model-v1-from-csv";
import type { QuestionConfig } from "../types";

export function loadQuestionsFromCsv(
  csvPath?: string,
): QuestionConfig[] {
  return loadModelV1FromCsv(csvPath).questions;
}
