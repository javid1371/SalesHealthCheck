import { describe, expect, it } from "vitest";
import { domainsV1 } from "@/config/model-v1/domains";
import { loadModelV1FromCsv } from "@/config/model-v1/question-bank/load-model-v1-from-csv";
import {
  lookupScoreBand,
  parseDomainScoreBands,
  parseQuestionOptionInterpretations,
} from "@/config/model-v1/question-bank/parse-score-bands";
import { questionsV1 } from "@/config/model-v1/questions";
import {
  domainReportConfigV1,
  getDomainReportConfig,
  getQuestionAnalysis,
  questionAnalysisMetadataV1,
  questionAnalysisV1,
} from "@/config/model-v1/question-analysis-config";

describe("loadModelV1FromCsv", () => {
  it("loads 80 questions, 16 domain configs, and 80 analysis entries", () => {
    const model = loadModelV1FromCsv();

    expect(model.questions).toHaveLength(80);
    expect(model.domains).toHaveLength(16);
    expect(model.questionAnalysis).toHaveLength(80);
  });

  it("maps each domain to exactly 5 questions with scored options", () => {
    const { questions } = loadModelV1FromCsv();
    const byDomain = new Map<string, number[]>();

    for (const question of questions) {
      const orders = byDomain.get(question.domainSlug) ?? [];
      orders.push(question.displayOrder);
      byDomain.set(question.domainSlug, orders);
    }

    expect(byDomain.size).toBe(domainsV1.length);

    for (const domain of domainsV1) {
      expect(byDomain.get(domain.slug)?.sort((a, b) => a - b)).toEqual([
        1, 2, 3, 4, 5,
      ]);
    }

    for (const question of questions) {
      expect(question.options.map((option) => option.score)).toEqual([
        0, 1, 2, 3,
      ]);
    }
  });

  it("parses domain score bands and question option interpretations", () => {
    const personaConfig = domainReportConfigV1.find(
      (config) => config.domainSlug === "persona",
    );
    expect(personaConfig?.domainScoreBands.length).toBeGreaterThanOrEqual(4);

    const band = lookupScoreBand(personaConfig!.domainScoreBands, 6);
    expect(band?.label).toContain("ضعیف");

    const analysis = questionAnalysisMetadataV1.find(
      (entry) => entry.domainSlug === "persona" && entry.questionNumber === 1,
    );
    expect(analysis?.diagnosticIntent.length).toBeGreaterThan(0);
    expect(analysis?.optionInterpretations[0].length).toBeGreaterThan(0);
  });

  it("exposes lookup helpers for internal report/diagnosis config", () => {
    const domainConfig = getDomainReportConfig("persona");
    expect(domainConfig?.correctiveAction.length).toBeGreaterThan(0);
    expect(domainConfig?.diagnosticSymptoms.length).toBeGreaterThan(0);
    expect(domainConfig?.domainScoreBands.length).toBeGreaterThanOrEqual(4);

    const analysis = getQuestionAnalysis("persona", 1);
    expect(analysis?.diagnosticIntent).toBe(
      questionAnalysisV1.find(
        (entry) => entry.domainSlug === "persona" && entry.questionNumber === 1,
      )?.diagnosticIntent,
    );
  });

  it("exports questionsV1 from the full CSV source", () => {
    expect(questionsV1).toHaveLength(80);
    expect(questionsV1[0]?.domainSlug).toBe("persona");
    expect(questionsV1[0]?.text).toContain("مشتری‌های قبلی");
    expect(questionsV1[0]).not.toHaveProperty("helpText");
  });
});

describe("parse-score-bands helpers", () => {
  it("parses Persian digit score bands", () => {
    const bands = parseDomainScoreBands(
      "جمع ۵ سؤال (۰ تا ۱۵). ۰–۳ بحرانی: مشتری هدف تعریف نشده. ۴–۶ ضعیف: شناخت پراکنده.",
    );

    expect(bands).toHaveLength(2);
    expect(bands[0]).toMatchObject({ min: 0, max: 3, label: "بحرانی" });
    expect(bands[1]).toMatchObject({ min: 4, max: 6, label: "ضعیف" });
  });

  it("parses question option interpretations", () => {
    const interpretations = parseQuestionOptionInterpretations(
      "۰ بحرانی: هر خریداری مشتری محسوب می‌شود. ۱ ضعیف: حس کلی هست.",
    );

    expect(interpretations).toHaveLength(2);
    expect(interpretations[0].score).toBe(0);
    expect(interpretations[0].description).toContain("هر خریداری");
  });
});
