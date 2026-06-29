#!/usr/bin/env node
/** Persist multiple Notion MCP fetch payloads from a JSON map file. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const mapPath = process.argv[2];
if (!mapPath) {
  console.error("Usage: persist-notion-mcp-map.mjs <map.json>");
  process.exit(1);
}

const tmpDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../.tmp/notion-fetch");
const map = JSON.parse(fs.readFileSync(mapPath, "utf8"));
fs.mkdirSync(tmpDir, { recursive: true });

function extractSeedText(fullText) {
  const m = fullText.match(/## Cursor seed\n```json\n([\s\S]*?)\n```/);
  if (!m) throw new Error("No Cursor seed json block found");
  return `## Cursor seed\n\`\`\`json\n${m[1]}\n\`\`\`\n`;
}

for (const [name, payload] of Object.entries(map)) {
  const text = payload.text;
  if (!text) throw new Error(`Missing text for ${name}`);
  fs.writeFileSync(path.join(tmpDir, `${name}-mcp.json`), JSON.stringify(payload, null, 2));
  const minimal = name.startsWith("d0");
  const outText = minimal ? extractSeedText(text) : text;
  fs.writeFileSync(path.join(tmpDir, `${name}.text`), outText);
  console.log(`Wrote ${name}.text (${outText.length} chars)`);
}
