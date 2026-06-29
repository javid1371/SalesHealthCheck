#!/usr/bin/env node
/**
 * Writes guide.text from Notion notion-fetch payload JSON path argv[2].
 * Usage: node save-guide-fetch.mjs <notion-fetch.json>
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const src = process.argv[2];
if (!src) {
  console.error("Usage: node save-guide-fetch.mjs <notion-fetch.json>");
  process.exit(1);
}
const payload = JSON.parse(fs.readFileSync(src, "utf8"));
const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../.tmp/notion-fetch");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "guide.text"), payload.text);
fs.writeFileSync(path.join(outDir, "in", "guide-fetch.json"), JSON.stringify(payload));
console.log(`Wrote guide.text (${payload.text.length} chars)`);
