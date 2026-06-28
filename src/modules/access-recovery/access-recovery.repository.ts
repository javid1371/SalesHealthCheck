import { db } from "@/lib/db";

export async function findLatestCompletedSession(userId: string) {
  return db.assessmentSession.findFirst({
    where: {
      userId,
      status: "completed",
    },
    orderBy: { completedAt: "desc" },
    select: {
      id: true,
      resultToken: true,
    },
  });
}
