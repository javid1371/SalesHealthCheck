#!/usr/bin/env node
/** Write guide.text from notion-fetch JSON on stdin */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const inputPath = process.argv[2];
const input = inputPath
  ? fs.readFileSync(inputPath, "utf8")
  : fs.readFileSync(0, "utf8");
const payload = JSON.parse(input);
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), "../.tmp/notion-fetch/guide.text");
fs.writeFileSync(out, payload.text);
console.log(`Wrote ${out} (${payload.text.length} chars)`);
