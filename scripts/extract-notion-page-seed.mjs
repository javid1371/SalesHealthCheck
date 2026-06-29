/**
 * Extract ```json ... ``` seed block from a Notion fetch `text` field export.
 */
import fs from "node:fs";
import path from "node:path";
import path from "node:path";

const inputPath = process.argv[2];
const outputPath = process.argv[3];
if (!inputPath || !outputPath) {
  console.error(
    "Usage: node extract-notion-page-seed.mjs <notion-fetch.json> <out-body.json>",
  );
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const text = raw.text ?? raw;
const match =
  typeof text === "string"
    ? text.match(/```json\n([\s\S]*?)\n```/)
    : null;
if (!match) {
  console.error(`No json code block found in ${inputPath}`);
  process.exit(1);
}

const parsed = JSON.parse(match[1]);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(parsed, null, 2) + "\n");
console.log(`Wrote ${outputPath}`);
