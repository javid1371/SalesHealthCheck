import { db } from "@/lib/db";

export async function findAssessmentsByUserId(userId: string) {
  return db.assessmentSession.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      organization: true,
      overallScore: true,
    },
  });
}
