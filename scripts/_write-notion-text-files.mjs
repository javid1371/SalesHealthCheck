/**
 * One-shot: write .text files from Notion MCP fetch payloads (stdin JSON array).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpDir = path.join(root, ".tmp/notion-fetch");

function extractSeedText(fullText) {
  const m = fullText.match(/## Cursor seed\n```json\n([\s\S]*?)\n```/);
  if (!m) throw new Error("No Cursor seed json block found");
  return `## Cursor seed\n\`\`\`json\n${m[1]}\n\`\`\`\n`;
}

const input = fs.readFileSync(0, "utf8");
const pages = JSON.parse(input);

fs.mkdirSync(tmpDir, { recursive: true });

for (const { name, payload, minimal } of pages) {
  const text = payload.text;
  if (!text) throw new Error(`Missing text for ${name}`);
  const out = minimal ? extractSeedText(text) : text;
  const outPath = path.join(tmpDir, `${name}.text`);
  fs.writeFileSync(outPath, out);
  console.log(`Wrote ${outPath} (${out.length} chars)`);
}
