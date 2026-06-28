import { PrismaClient } from "@prisma/client";
import { domainsV1, layersV1 } from "../src/config/model-v1/domains";
import { questionsV1 } from "../src/config/model-v1/questions";

const prisma = new PrismaClient();

const MODEL_VERSION_NUMBER = "1.0.0";

async function main() {
  const existing = await prisma.modelVersion.findFirst({
    where: { versionNumber: MODEL_VERSION_NUMBER, status: "active" },
    include: {
      _count: { select: { questions: true } },
    },
  });

  if (existing && existing._count.questions >= questionsV1.length) {
    console.log(
      `Active ModelVersion ${MODEL_VERSION_NUMBER} already seeded (${existing._count.questions} questions). Skipping.`,
    );
    return;
  }

  if (existing) {
    await prisma.modelVersion.delete({ where: { id: existing.id } });
    console.log(
      `Removed incomplete ModelVersion ${MODEL_VERSION_NUMBER} for re-seed.`,
    );
  }

  const otherActive = await prisma.modelVersion.findMany({
    where: { status: "active" },
  });
  for (const mv of otherActive) {
    await prisma.modelVersion.update({
      where: { id: mv.id },
      data: { status: "archived" },
    });
  }

  const modelVersion = await prisma.modelVersion.create({
    data: {
      name: "Sales Health Check v1",
      versionNumber: MODEL_VERSION_NUMBER,
      status: "active",
      diagnosisEngineVersion: "v2",
      activatedAt: new Date(),
    },
  });

  const layerIdBySlug = new Map<string, string>();
  for (const layer of layersV1) {
    const created = await prisma.layer.create({
      data: {
        modelVersionId: modelVersion.id,
        name: layer.name,
        slug: layer.slug,
        description: layer.description,
        displayOrder: layer.displayOrder,
      },
    });
    layerIdBySlug.set(layer.slug, created.id);
  }

  const domainIdBySlug = new Map<string, string>();
  for (const domain of domainsV1) {
    const layerId = layerIdBySlug.get(domain.layerSlug);
    if (!layerId) {
      throw new Error(`Unknown layer slug: ${domain.layerSlug}`);
    }

    const created = await prisma.domain.create({
      data: {
        modelVersionId: modelVersion.id,
        layerId,
        name: domain.name,
        slug: domain.slug,
        description: domain.description,
        weight: domain.weight,
        displayOrder: domain.displayOrder,
        isActive: true,
      },
    });
    domainIdBySlug.set(domain.slug, created.id);
  }

  let questionCount = 0;
  let optionCount = 0;

  for (const question of questionsV1) {
    const domainId = domainIdBySlug.get(question.domainSlug);
    if (!domainId) {
      throw new Error(`Unknown domain slug: ${question.domainSlug}`);
    }

    if (question.options.length !== 4) {
      throw new Error(
        `Question "${question.text}" must have exactly 4 options, got ${question.options.length}`,
      );
    }

    const scores = question.options.map((o) => o.score);
    if (!scores.every((s, i) => s === i)) {
      throw new Error(
        `Question "${question.text}" options must have scores 0, 1, 2, 3 in order`,
      );
    }

    await prisma.question.create({
      data: {
        modelVersionId: modelVersion.id,
        domainId,
        text: question.text,
        helpText: null,
        displayOrder: question.displayOrder,
        isActive: true,
        options: {
          create: question.options.map((option, index) => ({
            text: option.text,
            score: option.score,
            displayOrder: index + 1,
          })),
        },
      },
    });

    questionCount += 1;
    optionCount += question.options.length;
  }

  console.log("Seed completed successfully.");
  console.log(`  ModelVersion: ${MODEL_VERSION_NUMBER} (${modelVersion.id})`);
  console.log(`  Layers: ${layersV1.length}`);
  console.log(`  Domains: ${domainsV1.length}`);
  console.log(`  Questions: ${questionCount}`);
  console.log(`  Options: ${optionCount}`);
  console.log(`  Diagnosis engine: v2 (EMC engine enabled; see ADR 0013)`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
