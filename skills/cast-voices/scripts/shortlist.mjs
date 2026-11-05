#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 vois-so
//
// shortlist.mjs: make a short list of Vois Studio voices for one role.
// It reads `vois-cli voice list --source all --format json` (or a saved copy of it),
// keeps the voices that agree with the filters, gives each voice a score for the
// words of the role, and prints the best voices as a Markdown table or as JSON.
// Node.js 18+, no dependencies. macOS and Windows.
//
// Usage:
//   node shortlist.mjs [--from voices.json] [--cli PATH] [--engine ID] [--gender male|female]
//                      [--source library|builtin|cloned|designed|all] [--category TEXT]
//                      [--language CODE] [--match "warm calm host"] [--exclude ID,ID]
//                      [--limit N] [--json]
//
// Defaults: --source library (builtin with --engine sonic), --limit 12. Without --from, it runs vois-cli.
// Exit status: 0 = one or more voices, 1 = no voice agrees with the filters,
// 64 = usage error, 127 = vois-cli is not at the path, other = the exit code of
// vois-cli (2 = Vois Studio is not open, 7 = the plan has no CLI).

import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ENGINES = ["fast", "expressive", "multilingual", "omni", "sonic", "craft"];
const SOURCES = ["library", "builtin", "cloned", "designed", "all"];

function usage(message) {
  if (message) console.error(`shortlist: ${message}`);
  console.error(
    'Usage: node shortlist.mjs [--from voices.json] [--cli PATH] [--engine ID] [--gender male|female]\n' +
      '       [--source library|builtin|cloned|designed|all] [--category TEXT] [--language CODE]\n' +
      '       [--match "words"] [--exclude ID,ID] [--limit N] [--json]'
  );
  process.exit(64);
}

function defaultCli() {
  if (process.platform === "win32") {
    const base = process.env.LOCALAPPDATA || "";
    return join(base, "Vois", "vois-cli.exe");
  }
  return "/Applications/Vois.app/Contents/MacOS/vois-cli";
}

const opts = { source: "library", limit: 12, json: false, exclude: [] };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  const next = () => {
    const v = argv[++i];
    if (v === undefined) usage(`${a} needs a value`);
    return v;
  };
  switch (a) {
    case "--from": opts.from = next(); break;
    case "--cli": opts.cli = next(); break;
    case "--engine": opts.engine = next().toLowerCase(); break;
    case "--gender": opts.gender = next().toLowerCase(); break;
    case "--source": opts.source = next().toLowerCase(); opts.sourceGiven = true; break;
    case "--category": opts.category = next().toLowerCase(); break;
    case "--language": opts.language = next().toLowerCase(); break;
    case "--match": opts.match = next(); break;
    case "--exclude": opts.exclude = next().split(",").map((s) => s.trim()).filter(Boolean); break;
    case "--limit": opts.limit = Number(next()); break;
    case "--json": opts.json = true; break;
    case "-h": case "--help": usage(); break;
    default: usage(`unknown option ${a}`);
  }
}
if (opts.engine && !ENGINES.includes(opts.engine)) usage(`--engine must be one of ${ENGINES.join(", ")}`);
// Sonic speaks only its built-in voices, so look there when no source is given.
if (opts.engine === "sonic" && !opts.sourceGiven) opts.source = "builtin";
if (!SOURCES.includes(opts.source)) usage(`--source must be one of ${SOURCES.join(", ")}`);
if (opts.gender && !["male", "female"].includes(opts.gender)) usage("--gender must be male or female");
if (!Number.isInteger(opts.limit) || opts.limit < 1) usage("--limit must be a whole number of 1 or more");

let raw;
if (opts.from) {
  if (!existsSync(opts.from)) usage(`no file at ${opts.from}`);
  raw = readFileSync(opts.from, "utf8");
} else {
  const cli = opts.cli || defaultCli();
  if (!existsSync(cli)) {
    console.error(`shortlist: vois-cli is not at ${cli}. Give its full path with --cli.`);
    process.exit(127);
  }
  try {
    raw = execFileSync(cli, ["voice", "list", "--source", "all", "--format", "json"], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (err) {
    const code = typeof err.status === "number" ? err.status : 1;
    const detail = (err.stderr || err.stdout || err.message || "").toString().trim();
    console.error(`shortlist: vois-cli voice list stopped with exit code ${code}.`);
    if (detail) console.error(detail);
    process.exit(code === 0 ? 1 : code);
  }
}

let voices;
try {
  voices = JSON.parse(raw);
} catch {
  console.error("shortlist: the voice list is not valid JSON.");
  process.exit(1);
}
if (!Array.isArray(voices)) voices = voices.voices || [];

const words = (opts.match || "")
  .toLowerCase()
  .split(/[^a-z0-9]+/)
  .filter((w) => w.length > 2);

function text(v) {
  return [v.name, v.description, v.category, v.category_name, ...(v.tags || [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function score(v) {
  if (words.length === 0) return 0;
  const t = text(v);
  let s = 0;
  for (const w of words) if (t.includes(w)) s += 1;
  // A real description (not only a category word) is easier to cast from.
  if (v.description && v.description.split(" ").length > 2) s += 0.5;
  return s;
}

const kept = voices.filter((v) => {
  if (opts.exclude.includes(v.id)) return false;
  if (opts.source !== "all" && v.source !== opts.source) return false;
  if (opts.engine && !(v.supported_engines || []).includes(opts.engine)) return false;
  if (opts.gender && String(v.gender || "").toLowerCase() !== opts.gender) return false;
  if (opts.category && !String(v.category || "").toLowerCase().includes(opts.category)) return false;
  if (opts.language && Array.isArray(v.available_languages) && !v.available_languages.includes(opts.language)) return false;
  if (v.source === "designed" && v.needs_recreate === true) return false;
  if (v.source === "cloned" && v.consent_confirmed !== true) return false;
  return true;
});

const ranked = kept
  .map((v) => ({ v, s: score(v) }))
  .sort((a, b) => b.s - a.s || String(a.v.id).localeCompare(String(b.v.id)))
  .slice(0, opts.limit);

if (ranked.length === 0) {
  console.error("shortlist: no voice agrees with these filters. Remove a filter and try again.");
  process.exit(1);
}

if (opts.json) {
  console.log(
    JSON.stringify(
      ranked.map(({ v, s }) => ({
        id: v.id,
        name: v.name,
        gender: v.gender,
        source: v.source,
        category: v.category,
        description: v.description,
        supported_engines: v.supported_engines,
        available_languages: v.available_languages,
        score: s,
      })),
      null,
      2
    )
  );
} else {
  const cell = (x) => String(x ?? "").replace(/\|/g, "/").replace(/\s+/g, " ").trim();
  console.log(`${kept.length} voices agree with the filters. The best ${ranked.length}:\n`);
  console.log("| Score | Voice ID | Name | Gender | Category | Engines | Description |");
  console.log("|---|---|---|---|---|---|---|");
  for (const { v, s } of ranked) {
    console.log(
      `| ${s} | \`${cell(v.id)}\` | ${cell(v.name)} | ${cell(v.gender)} | ${cell(v.category)} | ${cell((v.supported_engines || []).join(", "))} | ${cell(v.description)} |`
    );
  }
}
