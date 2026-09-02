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

export async function findUserIdsByPhones(
  phones: string[],
): Promise<string[]> {
  const uniquePhones = [...new Set(phones.filter((phone) => phone.length > 0))];
  if (uniquePhones.length === 0) {
    return [];
  }

  const users = await db.user.findMany({
    where: { phone: { in: uniquePhones } },
    select: { id: true },
  });

  return users.map((user) => user.id);
}
