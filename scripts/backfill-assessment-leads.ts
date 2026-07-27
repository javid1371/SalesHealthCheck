/**
 * Backfills ConsultationRequest leads for legacy assessments that have none.
 *
 * Run:
 *   npx tsx scripts/backfill-assessment-leads.ts [--dry-run] [--group=all|active|completed|abandoned] [--limit=N]
 *
 * Production:
 *   docker exec -i $(docker ps -qf name=sales-health-check-app -n 1) \
 *     npx tsx scripts/backfill-assessment-leads.ts --dry-run
 */
import {
  backfillAssessmentLeads,
  type LeadBackfillGroup,
} from "@/modules/consultation/lead-backfill.service";

const VALID_GROUPS: LeadBackfillGroup[] = [
  "all",
  "active",
  "completed",
  "abandoned",
];

function parseArgs(argv: string[]): {
  dryRun: boolean;
  group: LeadBackfillGroup;
  limit?: number;
} {
  let dryRun = false;
  let group: LeadBackfillGroup = "all";
  let limit: number | undefined;

  for (const arg of argv) {
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (arg.startsWith("--group=")) {
      const value = arg.slice("--group=".length) as LeadBackfillGroup;
      if (!VALID_GROUPS.includes(value)) {
        throw new Error(
          `Invalid --group value: ${value}. Expected one of: ${VALID_GROUPS.join(", ")}`,
        );
      }
      group = value;
      continue;
    }

    if (arg.startsWith("--limit=")) {
      const parsed = Number.parseInt(arg.slice("--limit=".length), 10);
      if (!Number.isFinite(parsed) || parsed < 1) {
        throw new Error(`Invalid --limit value: ${arg}`);
      }
      limit = parsed;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { dryRun, group, limit };
}

async function main() {
  const { dryRun, group, limit } = parseArgs(process.argv.slice(2));
  const result = await backfillAssessmentLeads({ dryRun, group, limit });

  console.log(JSON.stringify(result, null, 2));

  if (!dryRun && result.failed > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const { db } = await import("@/lib/db");
    await db.$disconnect();
  });
