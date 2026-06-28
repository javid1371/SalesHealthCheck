import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GATE_QUESTIONS } from "@/config/model-v1/diagnosis-engine-v2";
import { displayOrderToEngineId } from "@/config/model-v1/diagnosis-engine-v2/domain-crosswalk";

const CSV_PATH = join(
  process.cwd(),
  "src/config/model-v1/question-bank/data/questions-v1-full.csv",
);

function parseCsvRows(): string[][] {
  const content = readFileSync(CSV_PATH, "utf-8");
  const lines = content.trim().split("\n");
  return lines.slice(1).map((line) => line.split(","));
}

describe("gate questions vs question bank CSV", () => {
  it("references valid domain.question pairs in the CSV", () => {
    const rows = parseCsvRows();
    const keysInCsv = new Set(
      rows.map((row) => `${row[1]}.${row[3]}`),
    );

    for (const gate of GATE_QUESTIONS) {
      const dbKey = `${gate.displayOrder}.${gate.questionNumber}`;
      expect(keysInCsv.has(dbKey)).toBe(true);
      expect(gate.engineId).toBe(displayOrderToEngineId(gate.displayOrder));
    }
  });
});
