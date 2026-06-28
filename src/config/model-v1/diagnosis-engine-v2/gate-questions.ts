import { displayOrderToEngineId } from "./domain-crosswalk";

export type GateQuestionRef = {
  engineId: number;
  displayOrder: number;
  questionNumber: number;
};

/** Gate questions keyed by DB domain.question (converted to engine_id). */
export const GATE_QUESTIONS: GateQuestionRef[] = [
  { displayOrder: 4, questionNumber: 5, engineId: displayOrderToEngineId(4) },
  { displayOrder: 6, questionNumber: 1, engineId: displayOrderToEngineId(6) },
  { displayOrder: 6, questionNumber: 4, engineId: displayOrderToEngineId(6) },
  { displayOrder: 12, questionNumber: 2, engineId: displayOrderToEngineId(12) },
  { displayOrder: 9, questionNumber: 1, engineId: displayOrderToEngineId(9) },
  { displayOrder: 16, questionNumber: 2, engineId: displayOrderToEngineId(16) },
];
