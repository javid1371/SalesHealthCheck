/**
 * Backfills reports.report_spec for legacy assessments (report_spec IS NULL).
 * Run: tsx scripts/backfill-report-spec.ts
 */
import { PrismaClient } from "@prisma/client";
import { ensureReportSpec } from "@/modules/report/report-spec.service";

const prisma = new PrismaClient();

async function main() {
  const reports = await prisma.report.findMany({
    where: { reportSpec: { equals: null } },
    select: { id: true, assessmentSessionId: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Found ${reports.length} reports without report_spec.`);

  let succeeded = 0;
  let failed = 0;

  for (const report of reports) {
    try {
      await ensureReportSpec(report.id);
      succeeded += 1;
      console.log(`OK  report=${report.id} assessment=${report.assessmentSessionId}`);
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `FAIL report=${report.id} assessment=${report.assessmentSessionId}: ${message}`,
      );
    }
  }

  console.log(`Done. succeeded=${succeeded} failed=${failed}`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
