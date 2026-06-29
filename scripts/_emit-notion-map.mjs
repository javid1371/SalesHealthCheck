#!/usr/bin/env node
/**
 * Emit .tmp/notion-fetch/mcp-map.json from individual page fetch files.
 * Each input file is a full notion-fetch tool JSON response.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const inDir = path.join(root, ".tmp/notion-fetch/in");
const outPath = path.join(root, ".tmp/notion-fetch/mcp-map.json");

const names = ["d02", "d03", "d04", "guide"];
const map = {};
for (const name of names) {
  const p = path.join(inDir, `${name}.json`);
  map[name] = JSON.parse(fs.readFileSync(p, "utf8"));
}
fs.writeFileSync(outPath, JSON.stringify(map));
console.log(`Wrote ${outPath}`);
