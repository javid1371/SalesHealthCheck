import { db } from "@/lib/db";
import type { ScoringDomainInput, ScoringLayerInput } from "@/modules/scoring/scoring.types";
import type { DiagnosisDomainInput, DiagnosisLayerInput } from "@/modules/diagnosis/diagnosis.types";
import {
  domainsCacheKey,
  getOrSetCached,
  layersCacheKey,
} from "./question-bank.cache";

export async function findActiveModelVersion() {
  return db.modelVersion.findFirst({
    where: { status: "active" },
    orderBy: { activatedAt: "desc" },
  });
}

export async function findModelVersionById(modelVersionId: string) {
  return db.modelVersion.findUnique({
    where: { id: modelVersionId },
  });
}

export async function loadDomainsWithQuestions(modelVersionId: string) {
  return getOrSetCached(domainsCacheKey(modelVersionId), () =>
    db.domain.findMany({
      where: {
        modelVersionId,
        isActive: true,
      },
      include: {
        layer: true,
        questions: {
          where: { isActive: true },
          orderBy: { displayOrder: "asc" },
          include: {
            options: {
              orderBy: { displayOrder: "asc" },
            },
          },
        },
      },
      orderBy: { displayOrder: "asc" },
    }),
  );
}

export async function loadLayers(modelVersionId: string) {
  return getOrSetCached(layersCacheKey(modelVersionId), () =>
    db.layer.findMany({
      where: { modelVersionId },
      orderBy: { displayOrder: "asc" },
    }),
  );
}

export async function findQuestionById(questionId: string) {
  return db.question.findUnique({
    where: { id: questionId },
    include: {
      domain: true,
      options: true,
    },
  });
}

export async function findQuestionsByIds(questionIds: string[]) {
  if (questionIds.length === 0) {
    return [];
  }

  return db.question.findMany({
    where: { id: { in: questionIds } },
    include: {
      domain: true,
      options: true,
    },
  });
}

export async function findOptionById(optionId: string) {
  return db.questionOption.findUnique({
    where: { id: optionId },
    include: { question: true },
  });
}

export async function findOptionsByIds(optionIds: string[]) {
  if (optionIds.length === 0) {
    return [];
  }

  return db.questionOption.findMany({
    where: { id: { in: optionIds } },
    include: { question: true },
  });
}

export async function countActiveQuestions(modelVersionId: string) {
  return db.question.count({
    where: {
      modelVersionId,
      isActive: true,
      domain: { isActive: true },
    },
  });
}

export function toScoringDomainInputs(
  domains: Awaited<ReturnType<typeof loadDomainsWithQuestions>>,
): ScoringDomainInput[] {
  return domains.map((domain) => ({
    id: domain.id,
    slug: domain.slug,
    name: domain.name,
    layerId: domain.layerId,
    layerSlug: domain.layer.slug,
    displayOrder: domain.displayOrder,
  }));
}

export function toScoringLayerInputs(
  layers: Awaited<ReturnType<typeof loadLayers>>,
): ScoringLayerInput[] {
  return layers.map((layer) => ({
    id: layer.id,
    slug: layer.slug,
    name: layer.name,
    displayOrder: layer.displayOrder,
  }));
}

export function toDiagnosisDomainInputs(
  domains: Awaited<ReturnType<typeof loadDomainsWithQuestions>>,
): DiagnosisDomainInput[] {
  return domains.map((domain) => ({
    id: domain.id,
    slug: domain.slug,
    name: domain.name,
    weight: domain.weight,
  }));
}

export function toDiagnosisLayerInputs(
  layers: Awaited<ReturnType<typeof loadLayers>>,
): DiagnosisLayerInput[] {
  return layers.map((layer) => ({
    id: layer.id,
    slug: layer.slug,
    name: layer.name,
  }));
}
