/**
 * Regenerate REPORT_CONTENT_LIBRARY_V1 from the workspace snapshot.
 *
 * Source: docs/specs/report-content-library-v1/domain-bundles.v1.json
 * Output: src/config/model-v1/report-content/report-content-library.v1.generated.ts
 *
 * Usage:
 *   npx tsx scripts/sync-report-content.ts          # write generated seed
 *   npx tsx scripts/sync-report-content.ts --check  # exit 1 if output is stale
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { assertDomainCrosswalkComplete } from "../src/config/model-v1/report-content/domain-crosswalk";
import {
  buildReportContentLibraryV1,
  type DomainBundlesSnapshot,
} from "../src/config/model-v1/report-content/normalize-domain-bundle";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const SNAPSHOT_PATH = path.join(
  root,
  "docs/specs/report-content-library-v1/domain-bundles.v1.json",
);
const OUTPUT_PATH = path.join(
  root,
  "src/config/model-v1/report-content/report-content-library.v1.generated.ts",
);

function relativeFromRoot(absolutePath: string): string {
  return path.relative(root, absolutePath).split(path.sep).join("/");
}

function buildGeneratedSource(
  bundles: ReturnType<typeof buildReportContentLibraryV1>,
  snapshotDate: string,
): string {
  const snapshotRelative = relativeFromRoot(SNAPSHOT_PATH);

  return `// AUTO-GENERATED — do not edit manually.
// Source: ${snapshotRelative}
// Snapshot date: ${snapshotDate}
// Run: npm run sync:report-content

import type { DomainBundle } from "./domain-bundle.types";

export const REPORT_CONTENT_LIBRARY_V1: DomainBundle[] = ${JSON.stringify(bundles, null, 2)};
`;
}

function bundlesPayload(bundles: ReturnType<typeof buildReportContentLibraryV1>): string {
  return JSON.stringify(bundles);
}

function loadSnapshot(): DomainBundlesSnapshot & {
  snapshot_meta?: { snapshot_date?: string };
} {
  if (!fs.existsSync(SNAPSHOT_PATH)) {
    throw new Error(`Snapshot not found: ${relativeFromRoot(SNAPSHOT_PATH)}`);
  }

  const raw = fs.readFileSync(SNAPSHOT_PATH, "utf8");
  return JSON.parse(raw) as DomainBundlesSnapshot;
}

function main(): void {
  const checkOnly = process.argv.includes("--check");

  assertDomainCrosswalkComplete();

  const snapshot = loadSnapshot();
  const bundles = buildReportContentLibraryV1(snapshot);
  const snapshotDate =
    typeof snapshot.snapshot_meta?.snapshot_date === "string"
      ? snapshot.snapshot_meta.snapshot_date
      : "unknown";
  const nextSource = buildGeneratedSource(bundles, snapshotDate);
  const nextPayload = bundlesPayload(bundles);

  if (checkOnly) {
    if (!fs.existsSync(OUTPUT_PATH)) {
      console.error(
        `Missing generated seed: ${relativeFromRoot(OUTPUT_PATH)} — run npm run sync:report-content`,
      );
      process.exit(1);
    }

    const currentSource = fs.readFileSync(OUTPUT_PATH, "utf8");
    const payloadMatch = currentSource.match(
      /export const REPORT_CONTENT_LIBRARY_V1: DomainBundle\[] = (\[[\s\S]*\]);/,
    );
    if (!payloadMatch) {
      console.error(
        `Could not parse generated seed: ${relativeFromRoot(OUTPUT_PATH)} — run npm run sync:report-content`,
      );
      process.exit(1);
    }

    const currentPayload = JSON.stringify(JSON.parse(payloadMatch[1]));
    if (currentPayload !== nextPayload) {
      console.error(
        `Generated seed is stale: ${relativeFromRoot(OUTPUT_PATH)} — run npm run sync:report-content`,
      );
      process.exit(1);
    }

    if (currentSource !== nextSource) {
      console.error(
        `Generated seed header/format differs: ${relativeFromRoot(OUTPUT_PATH)} — run npm run sync:report-content`,
      );
      process.exit(1);
    }

    console.log(
      `Generated seed is up to date (${bundles.length} domain bundles from ${relativeFromRoot(SNAPSHOT_PATH)})`,
    );
    return;
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, nextSource);
  console.log(
    `Wrote ${relativeFromRoot(OUTPUT_PATH)} (${bundles.length} domain bundles from ${relativeFromRoot(SNAPSHOT_PATH)})`,
  );
}

main();
