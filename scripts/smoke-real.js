#!/usr/bin/env node
/**
 * smoke-real.js — run the real outline -> generate pipeline against the live
 * Claude API and report how often the server-side validation accepts the output.
 *
 * Usage: ANTHROPIC_API_KEY=... node scripts/smoke-real.js [samples-dir] [--runs N] [--save-docx dir]
 *
 * samples-dir (default ./samples, git-ignored) holds one UTF-8 .txt per hymn:
 *   line 1: title / hymnal number, e.g. 生命詩歌 293 首
 *   rest:   lyrics you are allowed to use, stanzas separated by a blank line.
 * Every run makes 2 API calls (outline + full report), so cost = files x runs x 2.
 */
const fs = require("node:fs");
const path = require("node:path");
const { once } = require("node:events");

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args.splice(i, 2)[1];
};
const runs = Number(flag("--runs") || 1);
const saveDir = flag("--save-docx");
const dir = path.resolve(args[0] || "samples");

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is not set.");
  process.exit(2);
}
if (!fs.existsSync(dir)) {
  console.error(`Samples directory not found: ${dir}`);
  process.exit(2);
}
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".txt")).sort();
if (!files.length) {
  console.error(`No .txt samples in ${dir}`);
  process.exit(2);
}
process.env.RATE_LIMIT_MAX = "1000";
const { app } = require("../server");

async function post(base, route, body) {
  const started = Date.now();
  const response = await fetch(base + route, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(300_000),
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  const json = response.headers.get("content-type")?.includes("json") ? JSON.parse(buffer.toString("utf8")) : null;
  return { status: response.status, json, buffer, seconds: ((Date.now() - started) / 1000).toFixed(1) };
}

(async () => {
  const web = app.listen(0, "127.0.0.1");
  await once(web, "listening");
  const base = `http://127.0.0.1:${web.address().port}`;
  const rows = [];
  for (const file of files) {
    const [title, ...rest] = fs.readFileSync(path.join(dir, file), "utf8").trim().split(/\r?\n/);
    const lyrics = rest.join("\n").trim();
    for (let run = 1; run <= runs; run += 1) {
      const row = { file, run, outline: "-", generate: "-", docx: "-", seconds: "-", error: "" };
      rows.push(row);
      const outline = await post(base, "/api/outline", { title, lyrics });
      row.outline = outline.status;
      if (outline.status !== 200) { row.error = outline.json?.error || ""; continue; }
      const generated = await post(base, "/api/generate", {
        title, lyrics, outline: outline.json.outline, gate1Confirmed: true, gate2Confirmed: true,
      });
      row.generate = generated.status;
      row.seconds = generated.seconds;
      if (generated.status !== 200) { row.error = generated.json?.error || ""; continue; }
      const docx = await post(base, "/api/download", { report: generated.json.report });
      row.docx = docx.status;
      if (docx.status === 200 && saveDir) {
        fs.mkdirSync(saveDir, { recursive: true });
        fs.writeFileSync(path.join(saveDir, `${path.basename(file, ".txt")}-${run}.docx`), docx.buffer);
        fs.writeFileSync(path.join(saveDir, `${path.basename(file, ".txt")}-${run}.json`), JSON.stringify(generated.json.report, null, 1));
      }
    }
  }
  web.close();
  console.table(rows);
  const ok = rows.filter((r) => r.outline === 200 && r.generate === 200 && r.docx === 200).length;
  console.log(`Full pipeline passed: ${ok}/${rows.length} (${Math.round((ok / rows.length) * 100)}%)`);
  const reasons = {};
  rows.filter((r) => r.error).forEach((r) => { reasons[r.error] = (reasons[r.error] || 0) + 1; });
  if (Object.keys(reasons).length) console.log("Failure reasons:", reasons);
  process.exit(ok === rows.length ? 0 : 1);
})();
