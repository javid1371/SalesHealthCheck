/**
 * Batch: wrap .text fetch payloads, extract seeds, render guide markdown.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpDir = path.join(root, ".tmp/notion-fetch");
const seedsDir = path.join(root, "docs/specs/report-content-library-v1/seeds");

function cleanGuide(text, outPath) {
  const contentMatch = text.match(/<content>\n([\s\S]*)\n<\/content>/);
  if (!contentMatch) throw new Error("No <content> in guide");
  let body = contentMatch[1];
  body = body.replace(/<callout[^>]*>\n([\s\S]*?)<\/callout>/g, (_, inner) =>
    inner
      .split("\n")
      .map((l) => l.replace(/^\t/, ""))
      .filter((l) => l.trim())
      .map((l) => `> ${l}`)
      .join("\n") + "\n",
  );
  body = body.replace(
    /<mention-page url="([^"]+)">([^<]*)<\/mention-page>/g,
    (_, url, title) => (title.trim() ? `[${title.trim()}](${url})` : url),
  );
  body = body.replace(/<mention-page url="([^"]+)"\/>/g, "$1");
  body = body.replace(
    /<\/?(?:page|ancestor-path|parent-data-source|ancestor-\d+-database|ancestor-\d+-page|ancestor-\d+-data-source|properties|content)[^>]*>\n?/g,
    "",
  );
  body = body.replace(/```plain text/g, "```");
  const frontMatter = `---
source: Notion
notion_url: https://app.notion.com/p/47c733bfa68d43d9a9de581b5f88284c
snapshot_date: 2026-06-29
---

# Cursor Implementation Guide — Report Content Library v1

`;
  fs.writeFileSync(outPath, frontMatter + body.trim() + "\n");
}

function processSeed(name) {
  const textPath = path.join(tmpDir, `${name}.text`);
  const fetchPath = path.join(tmpDir, `${name}.json`);
  const outPath = path.join(seedsDir, `${name}-body.json`);
  const text = fs.readFileSync(textPath, "utf8");
  fs.writeFileSync(fetchPath, JSON.stringify({ text }));
  const r = spawnSync(
    "node",
    ["scripts/extract-notion-page-seed.mjs", fetchPath, outPath],
    { cwd: root, encoding: "utf8" },
  );
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
  console.log(r.stdout.trim());
}

const seeds = ["d01", "d02", "d03", "d04"];
for (const name of seeds) {
  if (fs.existsSync(path.join(tmpDir, `${name}.text`))) {
    processSeed(name);
  }
}

if (fs.existsSync(path.join(tmpDir, "guide.text"))) {
  const text = fs.readFileSync(path.join(tmpDir, "guide.text"), "utf8");
  cleanGuide(
    text,
    path.join(root, "docs/specs/report-content-library-v1/cursor-implementation-guide.md"),
  );
  console.log("Wrote cursor-implementation-guide.md");
}
