import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { StructuredDiagnosis } from "@/types/structured-diagnosis";
import type { StructuredReport } from "@/types/report";
import type { ReportSpec } from "@/types/report-spec";
import type { BottleneckResult } from "@/types/diagnosis";
import type {
  DomainScoreResult,
  LayerScoreResult,
  OverallScoreResult,
} from "@/types/scoring";
import type { DiagnosisResult } from "@/types/diagnosis";

export async function findUserById(userId: string) {
  return db.user.findUnique({ where: { id: userId } });
}

export async function updateUserProfile(
  userId: string,
  data: { name: string; email?: string },
) {
  return db.user.update({
    where: { id: userId },
    data: {
      name: data.name,
      email: data.email,
    },
  });
}

export async function findUserByEmailOrPhone(email?: string, phone?: string) {
  if (!email && !phone) return null;

  return db.user.findFirst({
    where: {
      OR: [
        ...(email ? [{ email }] : []),
        ...(phone ? [{ phone }] : []),
      ],
    },
  });
}

export async function createUser(data: {
  name: string;
  email?: string;
  phone?: string;
}) {
  return db.user.create({ data });
}

export async function createOrganization(data: {
  userId: string;
  businessName: string;
  industry?: string;
  teamSize: string;
  salesModel: string;
}) {
  return db.organization.create({
    data: {
      userId: data.userId,
      businessName: data.businessName,
      industry: data.industry,
      teamSize: data.teamSize,
      salesModel: data.salesModel as Prisma.OrganizationCreateInput["salesModel"],
    },
  });
}

export async function createAssessmentSession(data: {
  userId: string;
  organizationId: string;
  modelVersionId: string;
  resultToken: string;
}) {
  return db.assessmentSession.create({
    data: {
      userId: data.userId,
      organizationId: data.organizationId,
      modelVersionId: data.modelVersionId,
      resultToken: data.resultToken,
      status: "started",
    },
  });
}

export async function findAssessmentById(assessmentId: string) {
  return db.assessmentSession.findUnique({
    where: { id: assessmentId },
    include: {
      user: true,
      organization: true,
      modelVersion: true,
      report: true,
      answers: true,
    },
  });
}

export async function findAssessmentForResult(assessmentId: string) {
  return db.assessmentSession.findUnique({
    where: { id: assessmentId },
    include: {
      organization: true,
      modelVersion: true,
      report: true,
      overallScore: true,
      domainScores: {
        include: { domain: { include: { layer: true } } },
        orderBy: { domain: { displayOrder: "asc" } },
      },
      layerScores: {
        include: { layer: true },
        orderBy: { layer: { displayOrder: "asc" } },
      },
      bottlenecks: {
        include: { domain: true },
        orderBy: { rank: "asc" },
      },
      diagnoses: {
        orderBy: { priority: "asc" },
      },
    },
  });
}

export async function countAnswersForAssessment(assessmentId: string) {
  return db.answer.count({
    where: { assessmentSessionId: assessmentId },
  });
}

export async function upsertAnswer(data: {
  assessmentSessionId: string;
  questionId: string;
  selectedOptionId: string;
  scoreSnapshot: number;
}) {
  return db.answer.upsert({
    where: {
      assessmentSessionId_questionId: {
        assessmentSessionId: data.assessmentSessionId,
        questionId: data.questionId,
      },
    },
    create: {
      assessmentSessionId: data.assessmentSessionId,
      questionId: data.questionId,
      selectedOptionId: data.selectedOptionId,
      scoreSnapshot: data.scoreSnapshot,
    },
    update: {
      selectedOptionId: data.selectedOptionId,
      scoreSnapshot: data.scoreSnapshot,
      answeredAt: new Date(),
    },
  });
}

export async function updateAssessmentStatus(
  assessmentId: string,
  status: "started" | "in_progress" | "completed",
) {
  return db.assessmentSession.update({
    where: { id: assessmentId },
    data: {
      status,
      ...(status === "completed" ? { completedAt: new Date() } : {}),
    },
  });
}

export async function abandonAssessment(assessmentId: string) {
  return db.assessmentSession.update({
    where: { id: assessmentId },
    data: { status: "abandoned" },
  });
}

export async function abandonInProgressAssessmentsForUser(userId: string) {
  return db.assessmentSession.updateMany({
    where: {
      userId,
      status: { in: ["started", "in_progress"] },
    },
    data: { status: "abandoned" },
  });
}

export async function updateOrganization(
  organizationId: string,
  data: {
    businessName: string;
    industry?: string;
    teamSize: string;
    salesModel: string;
  },
) {
  return db.organization.update({
    where: { id: organizationId },
    data: {
      businessName: data.businessName,
      industry: data.industry,
      teamSize: data.teamSize,
      salesModel: data.salesModel as Prisma.OrganizationUpdateInput["salesModel"],
    },
  });
}

export async function getAnswersWithDetails(assessmentId: string) {
  return db.answer.findMany({
    where: { assessmentSessionId: assessmentId },
    include: {
      question: {
        include: { domain: true },
      },
    },
  });
}

export async function updateAssessmentBusinessMetrics(
  assessmentId: string,
  metrics: {
    monthlyRevenue: number;
    averageOrderValue: number;
    monthlyLeads: number;
    repeatPurchaseRate?: number;
  },
) {
  return db.assessmentSession.update({
    where: { id: assessmentId },
    data: {
      monthlyRevenue: metrics.monthlyRevenue,
      averageOrderValue: metrics.averageOrderValue,
      monthlyLeads: metrics.monthlyLeads,
      repeatPurchaseRate: metrics.repeatPurchaseRate ?? null,
    },
  });
}

export async function updateReportSpec(
  reportId: string,
  reportSpec: ReportSpec | null,
) {
  return db.report.update({
    where: { id: reportId },
    data: {
      reportSpec:
        reportSpec != null
          ? (reportSpec as unknown as Prisma.InputJsonValue)
          : Prisma.DbNull,
    },
  });
}

export async function persistAssessmentResults(data: {
  assessmentId: string;
  domainScores: DomainScoreResult[];
  layerScores: LayerScoreResult[];
  overallScore: OverallScoreResult;
  bottlenecks: BottleneckResult[];
  diagnoses: DiagnosisResult[];
  structuredReport: StructuredReport;
  structuredDiagnosis?: StructuredDiagnosis | null;
  reportSpec?: ReportSpec | null;
}) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM assessment_sessions WHERE id = ${data.assessmentId} FOR UPDATE`;

    const existingSession = await tx.assessmentSession.findUnique({
      where: { id: data.assessmentId },
      include: { report: true },
    });

    if (existingSession?.status === "completed" && existingSession.report) {
      return {
        report: existingSession.report,
        bottlenecks: [],
        diagnoses: [],
      };
    }

    await tx.domainScore.deleteMany({
      where: { assessmentSessionId: data.assessmentId },
    });
    await tx.layerScore.deleteMany({
      where: { assessmentSessionId: data.assessmentId },
    });
    await tx.overallScore.deleteMany({
      where: { assessmentSessionId: data.assessmentId },
    });
    await tx.bottleneck.deleteMany({
      where: { assessmentSessionId: data.assessmentId },
    });
    await tx.diagnosis.deleteMany({
      where: { assessmentSessionId: data.assessmentId },
    });
    await tx.actionPlan.deleteMany({
      where: { assessmentSessionId: data.assessmentId },
    });

    await tx.domainScore.createMany({
      data: data.domainScores.map((score) => ({
        assessmentSessionId: data.assessmentId,
        domainId: score.domainId,
        rawScore: score.rawScore,
        maxScore: score.maxScore,
        percentage: score.percentage,
        healthLevel: score.healthLevel,
      })),
    });

    await tx.layerScore.createMany({
      data: data.layerScores.map((score) => ({
        assessmentSessionId: data.assessmentId,
        layerId: score.layerId,
        rawScore: score.rawScore,
        maxScore: score.maxScore,
        percentage: score.percentage,
        healthLevel: score.healthLevel,
      })),
    });

    await tx.overallScore.create({
      data: {
        assessmentSessionId: data.assessmentId,
        rawScore: data.overallScore.rawScore,
        maxScore: data.overallScore.maxScore,
        percentage: data.overallScore.percentage,
        healthLevel: data.overallScore.healthLevel,
      },
    });

    const createdBottlenecks = await Promise.all(
      data.bottlenecks.map((bottleneck) =>
        tx.bottleneck.create({
          data: {
            assessmentSessionId: data.assessmentId,
            domainId: bottleneck.domainId,
            weaknessScore: bottleneck.weaknessScore,
            domainWeight: bottleneck.domainWeight,
            priorityScore: bottleneck.priorityScore,
            rank: bottleneck.rank,
          },
        }),
      ),
    );

    const bottleneckIdByRank = new Map(
      createdBottlenecks.map((b) => [b.rank, b.id]),
    );

    const createdDiagnoses = await Promise.all(
      data.diagnoses.map((diagnosis) =>
        tx.diagnosis.create({
          data: {
            assessmentSessionId: data.assessmentId,
            diagnosisKey: diagnosis.diagnosisKey,
            title: diagnosis.title,
            description: diagnosis.description,
            severity: diagnosis.severity,
            priority: diagnosis.priority,
            relatedDomainIds: diagnosis.relatedDomainIds,
            relatedLayerIds: diagnosis.relatedLayerIds,
          },
        }),
      ),
    );

    const actionPlanRecords: Prisma.ActionPlanCreateManyInput[] = [];
    const structuredPlans = data.structuredReport.actionPlans;

    if (structuredPlans) {
      for (const action of structuredPlans.sevenDay) {
        actionPlanRecords.push({
          assessmentSessionId: data.assessmentId,
          timeframe: "seven_days",
          title: action.title,
          description: action.description,
          priority: actionPlanRecords.length + 1,
        });
      }
      for (const action of structuredPlans.thirtyDay) {
        actionPlanRecords.push({
          assessmentSessionId: data.assessmentId,
          timeframe: "thirty_days",
          title: action.title,
          description: action.description,
          priority: actionPlanRecords.length + 1,
        });
      }
    } else {
      for (const action of data.structuredReport.correctiveActions ?? []) {
        actionPlanRecords.push({
          assessmentSessionId: data.assessmentId,
          timeframe: "seven_days",
          title: action.domainName,
          description: action.description,
          priority: actionPlanRecords.length + 1,
        });
      }
    }

    if (actionPlanRecords.length > 0) {
      await tx.actionPlan.createMany({ data: actionPlanRecords });
    }

    const reportSpecValue =
      data.reportSpec != null
        ? (data.reportSpec as unknown as Prisma.InputJsonValue)
        : Prisma.DbNull;

    const report = await tx.report.upsert({
      where: { assessmentSessionId: data.assessmentId },
      create: {
        assessmentSessionId: data.assessmentId,
        reportStatus: "generated",
        structuredReport: data.structuredReport as unknown as Prisma.InputJsonValue,
        ...(data.reportSpec != null ? { reportSpec: reportSpecValue as Prisma.InputJsonValue } : {}),
      },
      update: {
        reportStatus: "generated",
        structuredReport: data.structuredReport as unknown as Prisma.InputJsonValue,
        reportSpec: reportSpecValue,
      },
    });

    await tx.assessmentSession.update({
      where: { id: data.assessmentId },
      data: {
        status: "completed",
        completedAt: new Date(),
        structuredDiagnosis: data.structuredDiagnosis
          ? (data.structuredDiagnosis as unknown as Prisma.InputJsonValue)
          : undefined,
      },
    });

    return {
      report,
      bottlenecks: createdBottlenecks,
      diagnoses: createdDiagnoses,
    };
  });
}

export async function findReportById(reportId: string) {
  return db.report.findUnique({
    where: { id: reportId },
    include: {
      assessmentSession: {
        include: {
          organization: true,
          overallScore: true,
          bottlenecks: {
            orderBy: { rank: "asc" },
            include: { domain: true },
          },
          diagnoses: {
            orderBy: { priority: "desc" },
          },
        },
      },
    },
  });
}
