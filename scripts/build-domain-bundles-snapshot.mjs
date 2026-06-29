/**
 * One-time builder: merges Notion SQL export + D01–D04 page-body seeds
 * into docs/specs/report-content-library-v1/domain-bundles.v1.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outPath = path.join(
  root,
  "docs/specs/report-content-library-v1/domain-bundles.v1.json",
);
const queryExportPath = process.argv[2];
if (!queryExportPath) {
  console.error("Usage: node build-domain-bundles-snapshot.mjs <notion-query-export.json>");
  process.exit(1);
}

const seedsDir = path.join(root, "docs/specs/report-content-library-v1/seeds");
const queryExport = JSON.parse(fs.readFileSync(queryExportPath, "utf8"));

function parseJsonField(value) {
  if (value == null || value === "") return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function loadBodySeed(engineId) {
  const file = path.join(seedsDir, `${engineId.toLowerCase()}-body.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

const domains = queryExport.results.map((row) => {
  const engineId = row.engine_id;
  const bodySeedJson = loadBodySeed(engineId);

  return {
    notion_url: row.url.startsWith("http") ? row.url : `https://app.notion.com${row.url}`,
    domain_bundle_title: row["Domain Bundle"],
    properties: {
      domain_id: row.domain_id,
      domain_number: row.domain_number,
      engine_id: row.engine_id,
      family: row.family,
      role_in_funnel_fa: row.role_in_funnel_fa,
      public_summary_fa: row.public_summary_fa,
      internal_diagnosis_summary_fa: row.internal_diagnosis_summary_fa,
      domain_levels_json: parseJsonField(row.domain_levels_json),
      questions_json: parseJsonField(row.questions_json),
      answer_options_json: parseJsonField(row.answer_options_json),
      root_causes_json: parseJsonField(row.root_causes_json),
      question_root_rules_json: parseJsonField(row.question_root_rules_json),
      symptoms_json: parseJsonField(row.symptoms_json),
      actions_json: parseJsonField(row.actions_json),
      rendering_rules_fa: row.rendering_rules_fa,
      cursor_seed_json: row.cursor_seed_json,
      content_version: row.content_version,
      status: row.Status,
      show_in_free_report: row.show_in_free_report === "__YES__",
      sort_order: row.sort_order,
      source_question_urls: row.source_question_urls,
    },
    ...(bodySeedJson ? { body_seed_json: bodySeedJson } : {}),
  };
});

const snapshot = {
  snapshot_meta: {
    content_version: "v1",
    snapshot_date: "2026-06-29",
    source: "Notion — Report Content Library — Domain Bundles",
    notion_database_url:
      "https://app.notion.com/p/32af24eade0544d092052dc8c7b4f75d",
    notion_library_page_url:
      "https://app.notion.com/p/8a472c052d3242fcbf7e68c4921ecdf6",
    domain_count: domains.length,
    notes: {
      d01_d04:
        "Full seed JSON lives in body_seed_json (page body). Database JSON properties are empty.",
      d05_d16:
        "Structured content in properties.*_json fields. Question/option text merged from questionsV1 at seed time.",
    },
  },
  domains,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2) + "\n");
console.log(`Wrote ${outPath} (${domains.length} domains)`);
