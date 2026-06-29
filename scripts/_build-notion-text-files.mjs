/**
 * Build .text files from -mcp.json fetch payloads or -seed.json for domains.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const tmpDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../.tmp/notion-fetch");

function extractSeedText(fullText) {
  const m = fullText.match(/## Cursor seed\n```json\n([\s\S]*?)\n```/);
  if (!m) throw new Error("No Cursor seed json block found");
  return `## Cursor seed\n\`\`\`json\n${m[1]}\n\`\`\`\n`;
}

function fromMcp(name, minimal) {
  const mcpPath = path.join(tmpDir, `${name}-mcp.json`);
  const data = JSON.parse(fs.readFileSync(mcpPath, "utf8"));
  const text = data.text;
  if (!text) throw new Error(`Missing text in ${mcpPath}`);
  const out = minimal ? extractSeedText(text) : text;
  fs.writeFileSync(path.join(tmpDir, `${name}.text`), out);
  console.log(`Wrote ${name}.text (${out.length} chars)`);
}

function fromSeed(name) {
  const seedPath = path.join(tmpDir, `${name}-seed.json`);
  const seed = fs.readFileSync(seedPath, "utf8").trim();
  const out = `## Cursor seed\n\`\`\`json\n${seed}\n\`\`\`\n`;
  fs.writeFileSync(path.join(tmpDir, `${name}.text`), out);
  console.log(`Wrote ${name}.text (${out.length} chars)`);
}

fs.mkdirSync(tmpDir, { recursive: true });

for (const name of ["d02", "d03", "d04"]) {
  const mcp = path.join(tmpDir, `${name}-mcp.json`);
  const seed = path.join(tmpDir, `${name}-seed.json`);
  if (fs.existsSync(mcp)) fromMcp(name, true);
  else if (fs.existsSync(seed)) fromSeed(name);
  else throw new Error(`Missing ${name}-mcp.json or ${name}-seed.json`);
}

if (fs.existsSync(path.join(tmpDir, "guide-mcp.json"))) {
  fromMcp("guide", false);
} else if (fs.existsSync(path.join(tmpDir, "guide-raw.text"))) {
  const text = fs.readFileSync(path.join(tmpDir, "guide-raw.text"), "utf8");
  fs.writeFileSync(path.join(tmpDir, "guide.text"), text);
  console.log(`Wrote guide.text (${text.length} chars)`);
} else {
  throw new Error("Missing guide-mcp.json or guide-raw.text");
}
