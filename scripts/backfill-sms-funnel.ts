/**
 * Backfills SMS funnel enrollments for legacy users who started/completed
 * assessments before the funnel was enabled.
 *
 * Run:
 *   tsx scripts/backfill-sms-funnel.ts [--dry-run] [--group=all|in_progress|completed|started|report_viewed] [--limit=N]
 *
 * Production (after deploy):
 *   docker exec -it $(docker ps -qf name=app -n 1) npx tsx scripts/backfill-sms-funnel.ts --dry-run --group=in_progress
 */
import {
  runBackfill,
  type BackfillGroup,
} from "@/modules/sms-funnel/backfill.service";

const VALID_GROUPS: BackfillGroup[] = [
  "all",
  "in_progress",
  "completed",
  "started",
  "report_viewed",
];

function parseArgs(argv: string[]): {
  dryRun: boolean;
  group: BackfillGroup;
  limit?: number;
} {
  let dryRun = false;
  let group: BackfillGroup = "all";
  let limit: number | undefined;

  for (const arg of argv) {
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (arg.startsWith("--group=")) {
      const value = arg.slice("--group=".length) as BackfillGroup;
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
  const result = await runBackfill({ group, dryRun, limit });

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
