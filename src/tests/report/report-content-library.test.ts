import { describe, expect, it } from "vitest";
import { domainsV1 } from "@/config/model-v1/domains";
import { questionsV1 } from "@/config/model-v1/questions";
import {
  DOMAIN_NUMBER_TO_PROJECT_SLUG,
  NOTION_DOMAIN_ID_TO_PROJECT_SLUG,
  assertDomainCrosswalkComplete,
  domainNumberToProjectSlug,
  notionDomainIdToProjectSlug,
} from "@/config/model-v1/report-content/domain-crosswalk";
import {
  REPORT_CONTENT_LIBRARY_V1,
  getReportContentBundleBySlug,
} from "@/config/model-v1/report-content/report-content-library.v1";

describe("report content domain crosswalk", () => {
  it("maps all 16 domain_numbers to project slugs via displayOrder", () => {
    assertDomainCrosswalkComplete();

    for (const domain of domainsV1) {
      expect(domainNumberToProjectSlug(domain.displayOrder)).toBe(domain.slug);
      expect(DOMAIN_NUMBER_TO_PROJECT_SLUG[domain.displayOrder]).toBe(domain.slug);
    }
  });

  it("maps explicit Notion domain_id overrides", () => {
    expect(notionDomainIdToProjectSlug("offer_pricing")).toBe("offer-design");
    expect(notionDomainIdToProjectSlug("lead_response_capture")).toBe("speed-to-lead");
    expect(notionDomainIdToProjectSlug("first_contact_trust")).toBe("initial-trust");
    expect(notionDomainIdToProjectSlug("professional_presentation")).toBe("presentation");
    expect(notionDomainIdToProjectSlug("sales_closing")).toBe("closing");
    expect(notionDomainIdToProjectSlug("customer_loyalty")).toBe("loyalty");
    expect(notionDomainIdToProjectSlug("sales_path_clarity")).toBe("sales-journey-clarity");
    expect(notionDomainIdToProjectSlug("sales_measurement_optimization")).toBe(
      "measurement-optimization",
    );
  });

  it("covers every Notion domain_id in the snapshot mapping table", () => {
    expect(Object.keys(NOTION_DOMAIN_ID_TO_PROJECT_SLUG)).toHaveLength(16);
  });
});

describe("REPORT_CONTENT_LIBRARY_V1 seed", () => {
  it("contains 16 normalized domain bundles sorted by domain_number", () => {
    expect(REPORT_CONTENT_LIBRARY_V1).toHaveLength(16);
    expect(REPORT_CONTENT_LIBRARY_V1.map((bundle) => bundle.domain_number)).toEqual(
      Array.from({ length: 16 }, (_, index) => index + 1),
    );
  });

  it("uses project slugs as domain_id, not Notion snake_case ids", () => {
    const bundle = getReportContentBundleBySlug("speed-to-lead");
    expect(bundle).toBeDefined();
    expect(bundle?.domain_id).toBe("speed-to-lead");
    expect(bundle?.domain_number).toBe(6);
    expect(bundle?.engine_id).toBe("D06");
  });

  it("merges question text and option labels from questionsV1 for D05–D16", () => {
    const bundle = getReportContentBundleBySlug("lead-nurturing");
    expect(bundle).toBeDefined();

    const bankQuestions = questionsV1.filter(
      (question) => question.domainSlug === "lead-nurturing",
    );
    expect(bundle?.questions).toHaveLength(bankQuestions.length);

    for (const bankQuestion of bankQuestions) {
      const merged = bundle?.questions.find(
        (question) => question.question_number === bankQuestion.displayOrder,
      );
      expect(merged?.question_text_fa).toBe(bankQuestion.text);
      expect(merged?.options).toHaveLength(4);

      for (const bankOption of bankQuestion.options) {
        const mergedOption = merged?.options.find(
          (option) => option.score === bankOption.score,
        );
        expect(mergedOption?.text_fa).toBe(bankOption.text);
      }
    }
  });

  it("preserves Notion-authored levels, roots, and actions for property-based domains", () => {
    const bundle = getReportContentBundleBySlug("lead-nurturing");
    expect(bundle?.domain_levels).toHaveLength(5);
    expect(bundle?.root_causes[0]?.root_id).toBe("unstructured_nurture_path");
    expect(bundle?.actions[0]?.action_id).toBe("build_nurture_path");
    expect(bundle?.question_root_rules.some((rule) => rule.condition === "score<=1")).toBe(
      true,
    );
  });

  it("keeps full D01–D04 body content with merged question bank text", () => {
    const bundle = getReportContentBundleBySlug("persona");
    expect(bundle?.domain_levels).toHaveLength(5);
    expect(bundle?.root_causes).toHaveLength(2);
    expect(bundle?.questions).toHaveLength(5);
    expect(bundle?.questions[0]?.options[0]?.public_reflection_fa).toContain("پاسخ شما");
    expect(bundle?.questions[0]?.question_text_fa).toBe(
      questionsV1.find(
        (question) =>
          question.domainSlug === "persona" && question.displayOrder === 1,
      )?.text,
    );
  });

  it("is deterministic across repeated imports", () => {
    const first = REPORT_CONTENT_LIBRARY_V1.map((bundle) => bundle.domain_id).join(",");
    const second = REPORT_CONTENT_LIBRARY_V1.map((bundle) => bundle.domain_id).join(",");
    expect(first).toBe(second);
  });
});
