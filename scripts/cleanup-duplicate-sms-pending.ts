/**
 * Cancels duplicate pending SMS for the same user + sequence + step.
 * Keeps the oldest pending message; cancels newer duplicates.
 *
 * Run:
 *   tsx scripts/cleanup-duplicate-sms-pending.ts [--dry-run] [--limit=N]
 *
 * Production (after deploy):
 *   docker exec -it $(docker ps -qf name=app -n 1) npx tsx scripts/cleanup-duplicate-sms-pending.ts --dry-run
 */
import { fileURLToPath } from "node:url";
import { db } from "@/lib/db";

type PendingRow = {
  id: string;
  sequenceKey: string;
  stepKey: string;
  createdAt: Date;
  enrollment: { userId: string };
};

function parseArgs(argv: string[]): { dryRun: boolean; limit?: number } {
  let dryRun = false;
  let limit: number | undefined;

  for (const arg of argv) {
    if (arg === "--dry-run") {
      dryRun = true;
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

  return { dryRun, limit };
}

function groupKey(row: PendingRow): string {
  return `${row.enrollment.userId}:${row.sequenceKey}:${row.stepKey}`;
}

export function findDuplicatePendingIds(rows: PendingRow[]): string[] {
  const groups = new Map<string, PendingRow[]>();

  for (const row of rows) {
    const key = groupKey(row);
    const bucket = groups.get(key) ?? [];
    bucket.push(row);
    groups.set(key, bucket);
  }

  const duplicateIds: string[] = [];

  for (const group of groups.values()) {
    if (group.length <= 1) continue;

    const sorted = [...group].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
    for (const row of sorted.slice(1)) {
      duplicateIds.push(row.id);
    }
  }

  return duplicateIds;
}

async function main() {
  const { dryRun, limit } = parseArgs(process.argv.slice(2));

  const pending = await db.smsMessage.findMany({
    where: { status: "pending" },
    select: {
      id: true,
      sequenceKey: true,
      stepKey: true,
      createdAt: true,
      enrollment: { select: { userId: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const duplicateIds = findDuplicatePendingIds(pending);
  const toCancel = limit ? duplicateIds.slice(0, limit) : duplicateIds;

  console.log(
    JSON.stringify(
      {
        dryRun,
        pendingTotal: pending.length,
        duplicateGroups: duplicateIds.length,
        toCancel: toCancel.length,
      },
      null,
      2,
    ),
  );

  if (toCancel.length === 0) {
    return;
  }

  if (dryRun) {
    for (const id of toCancel) {
      const row = pending.find((item) => item.id === id);
      if (!row) continue;
      console.log(
        `[dry-run] cancel ${id} (${groupKey(row)}, created ${row.createdAt.toISOString()})`,
      );
    }
    return;
  }

  const result = await db.smsMessage.updateMany({
    where: { id: { in: toCancel }, status: "pending" },
    data: {
      status: "canceled",
      error: "duplicate_cleanup",
    },
  });

  console.log(`Canceled ${result.count} duplicate pending SMS message(s).`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await db.$disconnect();
    });
}
