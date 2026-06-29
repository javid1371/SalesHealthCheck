#!/usr/bin/env node
/** Bootstrap .text files from Notion page IDs via subprocess MCP is unavailable; reads pre-saved in/*.json */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const inDir = path.join(root, ".tmp/notion-fetch/in");
const tmpDir = path.join(root, ".tmp/notion-fetch");

function extractSeedText(fullText) {
  const m = fullText.match(/## Cursor seed\n```json\n([\s\S]*?)\n```/);
  if (!m) throw new Error("No Cursor seed json block found");
  return `## Cursor seed\n\`\`\`json\n${m[1]}\n\`\`\`\n`;
}

fs.mkdirSync(inDir, { recursive: true });
fs.mkdirSync(tmpDir, { recursive: true });

const pages = [
  { name: "d02", id: "14344ccf-3e47-4ed8-897f-e051ca63d31a", minimal: true },
  { name: "d03", id: "42316883-0e1b-451d-9276-d653f2274db3", minimal: true },
  { name: "d04", id: "7b715862-0cdd-4c05-8a6d-e9d5fb693452", minimal: true },
  { name: "guide", id: "47c733bf-a68d-43d9-a9de-581b5f88284c", minimal: false },
];

for (const { name, id, minimal } of pages) {
  const jsonPath = path.join(inDir, `${name}.json`);
  if (!fs.existsSync(jsonPath)) {
    console.error(`Missing ${jsonPath} — save notion-fetch output for page ${id} first`);
    process.exit(1);
  }
  const payload = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  const text = payload.text;
  if (!text) throw new Error(`No text in ${jsonPath}`);
  const outText = minimal ? extractSeedText(text) : text;
  fs.writeFileSync(path.join(tmpDir, `${name}.text`), outText);
  fs.writeFileSync(path.join(tmpDir, `${name}-mcp.json`), JSON.stringify(payload, null, 2));
  console.log(`Wrote ${name}.text (${outText.length} chars)`);
}

const batch = spawnSync("node", ["scripts/batch-notion-artifacts.mjs"], {
  cwd: root,
  encoding: "utf8",
});
if (batch.stdout) process.stdout.write(batch.stdout);
if (batch.stderr) process.stderr.write(batch.stderr);
if (batch.status !== 0) process.exit(batch.status ?? 1);

console.log("Done.");
