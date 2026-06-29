#!/usr/bin/env node
/** Save Notion MCP notion-fetch JSON from stdin to .tmp/notion-fetch/<name>-mcp.json */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const name = process.argv[2];
if (!name) {
  console.error("Usage: save-notion-mcp-fetch.mjs <name>  # reads JSON from stdin");
  process.exit(1);
}

let input = "";
for await (const chunk of process.stdin) input += chunk;
const raw = JSON.parse(input);
const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../.tmp/notion-fetch");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, `${name}-mcp.json`);
fs.writeFileSync(outPath, JSON.stringify(raw, null, 2));
if (raw.text) {
  fs.writeFileSync(path.join(outDir, `${name}.text`), raw.text);
  console.log(`Wrote ${outPath} and ${name}.text (${raw.text.length} chars)`);
} else {
  console.log(`Wrote ${outPath}`);
}
