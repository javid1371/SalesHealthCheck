import type { BottleneckResult, DiagnosisResult } from "@/types/diagnosis";
import type { StructuredDiagnosis } from "@/types/structured-diagnosis";
import type { DiagnosisDomainInput } from "../diagnosis.types";

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

function findDomainByEngineId(
  engineId: number,
  structured: StructuredDiagnosis,
  domains: DiagnosisDomainInput[],
): DiagnosisDomainInput | undefined {
  const perDomain = structured.perDomain.find((domain) => domain.engineId === engineId);
  if (!perDomain) return undefined;
  return domains.find((domain) => domain.slug === perDomain.domainSlug);
}

function toBottleneck(
  engineId: number | null | undefined,
  rank: number,
  structured: StructuredDiagnosis,
  domains: DiagnosisDomainInput[],
): BottleneckResult | null {
  if (engineId == null) return null;

  const domain = findDomainByEngineId(engineId, structured, domains);
  const perDomain = structured.perDomain.find((entry) => entry.engineId === engineId);
  if (!domain || !perDomain) return null;

  return {
    domainId: domain.id,
    domainSlug: domain.slug,
    domainName: domain.name,
    weaknessScore: roundScore(perDomain.gap * 100),
    domainWeight: roundScore(perDomain.W),
    priorityScore: roundScore(perDomain.PI),
    rank,
  };
}

export function toLegacyBottlenecks(
  structured: StructuredDiagnosis,
  domains: DiagnosisDomainInput[],
): BottleneckResult[] {
  const candidates = [
    toBottleneck(structured.primaryIssue, 1, structured, domains),
    toBottleneck(structured.structuralRoots[0], 2, structured, domains),
    toBottleneck(structured.quickWin, 3, structured, domains),
  ].filter((item): item is BottleneckResult => item !== null);

  const seen = new Set<string>();
  const unique: BottleneckResult[] = [];

  for (const bottleneck of candidates) {
    if (seen.has(bottleneck.domainSlug)) continue;
    seen.add(bottleneck.domainSlug);
    unique.push({ ...bottleneck, rank: unique.length + 1 });
  }

  if (unique.length < 3) {
    const piSorted = [...structured.perDomain]
      .filter((domain) => !domain.incomplete)
      .sort((a, b) => b.PI - a.PI);

    for (const entry of piSorted) {
      if (unique.length >= 3) break;
      if (seen.has(entry.domainSlug)) continue;

      const domain = domains.find((item) => item.slug === entry.domainSlug);
      if (!domain) continue;

      unique.push({
        domainId: domain.id,
        domainSlug: domain.slug,
        domainName: domain.name,
        weaknessScore: roundScore(entry.gap * 100),
        domainWeight: roundScore(entry.W),
        priorityScore: roundScore(entry.PI),
        rank: unique.length + 1,
      });
      seen.add(entry.domainSlug);
    }
  }

  return unique.slice(0, 3);
}

export function toLegacyDiagnoses(
  structured: StructuredDiagnosis,
  domains: DiagnosisDomainInput[],
): DiagnosisResult[] {
  const diagnoses: DiagnosisResult[] = [];
  let priority = 1;

  const primaryDomain = structured.primaryIssue
    ? findDomainByEngineId(structured.primaryIssue, structured, domains)
    : undefined;

  if (primaryDomain) {
    const rootText =
      structured.issueRootQuestions.find(
        (question) => question.role === "primary_issue" && question.diagnosticIntent,
      )?.diagnosticIntent ??
      `عارضه اصلی: ${primaryDomain.name}`;

    diagnoses.push({
      diagnosisKey: `v2-primary-${primaryDomain.slug}`,
      title: `عارضه اصلی: ${primaryDomain.name}`,
      description: rootText,
      severity: structured.survivalStatus === "RED" ? "critical" : "high",
      priority: priority++,
      relatedDomainIds: [primaryDomain.id],
      relatedLayerIds: [],
    });
  }

  for (const rootEngineId of structured.structuralRoots.slice(0, 2)) {
    const domain = findDomainByEngineId(rootEngineId, structured, domains);
    if (!domain) continue;

    const rootText =
      structured.issueRootQuestions.find(
        (question) =>
          question.role === "structural_root" && question.engineId === rootEngineId,
      )?.diagnosticIntent ?? `ریشه ساختاری: ${domain.name}`;

    diagnoses.push({
      diagnosisKey: `v2-root-${domain.slug}`,
      title: `ریشه ساختاری: ${domain.name}`,
      description: rootText,
      severity: "high",
      priority: priority++,
      relatedDomainIds: [domain.id],
      relatedLayerIds: [],
    });
  }

  if (structured.instrumentFirst) {
    diagnoses.push({
      diagnosisKey: "v2-instrument-first",
      title: "اولویت ساخت ابزار اندازه‌گیری",
      description:
        "اعتبار تشخیص پایین است؛ ساخت داشبورد ساده فروش باید موازی با اقدامات دیگر در هفته اول انجام شود.",
      severity: "medium",
      priority: priority++,
      relatedDomainIds: [],
      relatedLayerIds: [],
    });
  }

  return diagnoses;
}
