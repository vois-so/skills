#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 vois-so
//
// Generate NPC lines from a spreadsheet with Vois Studio: one WAV for each
// row, named by its id, and a manifest that a game engine can read.
//
// Usage:
//   node render-barks.mjs <lines.csv> <cast.json> <out_dir>
//        [--only id1,id2] [--force] [--dry-run]
//
// lines.csv (UTF-8, first row is the header; column names are not case-sensitive):
//   id         stable line ID; file name; letters, digits, _ - . only
//   character  a key of "characters" in cast.json
//   line       the spoken text
//   direction  (or "emotion") delivery in plain words; Omni and Craft act it
//   type       optional: bark, dialogue, system (or your own types in cast.json)
//   engine     optional: fast, expressive, multilingual, omni, sonic, craft
//   language   optional: English, Spanish, ... (default from cast.json)
//
// cast.json:
//   { "language": "English",
//     "default_type": "bark",
//     "characters": { "guard": { "voice": "<voice-id>", "speed": 1.0 } },
//     "types": { "bark": { "engine": "expressive", "max_seconds": 3 },
//                "dialogue": { "engine": "craft" },
//                "system": { "engine": "fast" } } }
//
// Output: <out_dir>/<id>.wav (24 kHz mono 16-bit PCM), <out_dir>/manifest.json,
// <out_dir>/manifest.csv. A second run generates only new or changed rows.
// Exit 0 when all rows have audio; 5 when one or more rows failed.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join, resolve } from "node:path";

const ENGINES = ["fast", "expressive", "multilingual", "omni", "sonic", "craft"];
const DIRECTED = ["omni", "craft"];

function fail(msg, code = 1) {
  console.error(`ERROR: ${msg}`);
  process.exit(code);
}

function cliPath() {
  if (process.env.VOIS_CLI) return process.env.VOIS_CLI;
  const c =
    platform() === "win32"
      ? [join(process.env.LOCALAPPDATA || "", "Vois", "vois-cli.exe")]
      : ["/Applications/Vois.app/Contents/MacOS/vois-cli", join(homedir(), "Applications", "Vois.app", "Contents", "MacOS", "vois-cli")];
  const f = c.find((p) => existsSync(p));
  if (!f) fail(`vois-cli not found in: ${c.join(", ")}. Install Vois Studio, or set VOIS_CLI.`);
  return f;
}

function vois(args) {
  const r = spawnSync(cliPath(), ["--format", "json", ...args], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  let json = null;
  try {
    json = JSON.parse(r.stdout);
  } catch {}
  return { code: r.status ?? 1, json, out: (r.stderr || r.stdout || "").trim() };
}

// RFC 4180 CSV: quoted fields, "" inside quotes, commas and newlines in quotes.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let f = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') {
        f += '"';
        i++;
      } else if (c === '"') q = false;
      else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      row.push(f);
      f = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(f);
      rows.push(row);
      row = [];
      f = "";
    } else f += c;
  }
  if (f !== "" || row.length) {
    row.push(f);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
}

const csvCell = (s) => (/[",\n]/.test(String(s)) ? `"${String(s).replace(/"/g, '""')}"` : String(s));

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a === "--force" || a === "--dry-run"));
const onlyIdx = argv.indexOf("--only");
const only = onlyIdx >= 0 ? new Set(argv[onlyIdx + 1].split(",").map((s) => s.trim())) : null;
const pos = argv.filter((a, i) => !a.startsWith("--") && !(onlyIdx >= 0 && i === onlyIdx + 1));
const [csvPath, castPath, outArg] = pos;
if (!csvPath || !castPath || !outArg) fail("Usage: node render-barks.mjs <lines.csv> <cast.json> <out_dir> [--only id1,id2] [--force] [--dry-run]", 3);
const out = resolve(outArg);

const cast = JSON.parse(readFileSync(castPath, "utf8"));
const rows = parseCsv(readFileSync(csvPath, "utf8").replace(/^﻿/, ""));
const header = rows.shift().map((h) => h.trim().toLowerCase());
const col = (name) => header.indexOf(name);
for (const need of ["id", "character", "line"]) if (col(need) < 0) fail(`lines.csv has no "${need}" column. Header: ${header.join(",")}`, 3);
const dirCol = col("direction") >= 0 ? col("direction") : col("emotion");

// Validate all rows before any generation.
const errors = [];
const seen = new Set();
const lines = rows.map((r, i) => {
  const get = (c) => (c >= 0 && r[c] !== undefined ? r[c].trim() : "");
  const id = get(col("id"));
  const character = get(col("character"));
  const ch = cast.characters?.[character];
  const type = get(col("type")) || cast.default_type || "bark";
  const engine = (get(col("engine")) || ch?.engine || cast.types?.[type]?.engine || "expressive").toLowerCase();
  const line = {
    row: i + 2,
    id,
    character,
    type,
    text: get(col("line")),
    direction: get(dirCol),
    engine,
    language: get(col("language")) || ch?.language || cast.language || "English",
    voice: ch?.voice || "",
    speed: Number(ch?.speed ?? 1.0),
  };
  const where = `row ${line.row} (${id || "no id"})`;
  if (!/^[A-Za-z0-9_.-]+$/.test(id)) errors.push(`${where}: id must use only letters, digits, _ - .`);
  if (seen.has(id.toLowerCase())) errors.push(`${where}: id is not unique (file names do not use capital letters on all systems)`);
  seen.add(id.toLowerCase());
  if (!ch) errors.push(`${where}: character "${character}" is not in cast.json`);
  else if (!line.voice) errors.push(`${where}: character "${character}" has no voice in cast.json`);
  if (!line.text) errors.push(`${where}: the line is empty`);
  if (!ENGINES.includes(engine)) errors.push(`${where}: engine "${engine}" is not one of ${ENGINES.join(", ")}`);
  if (engine === "sonic" && !line.voice.startsWith("sonic_")) errors.push(`${where}: Sonic speaks only its built-in voices (sonic_cedar, ...)`);
  if (DIRECTED.includes(engine) && /[()[\]]/.test(line.direction)) errors.push(`${where}: a direction for ${engine} must not have brackets or parentheses`);
  if (line.direction.length >= 2000) errors.push(`${where}: the direction is 2,000 characters or more`);
  line.direction_used = DIRECTED.includes(engine) && line.direction !== "";
  line.input_hash = createHash("sha256").update(JSON.stringify([line.text, line.voice, engine, line.language, line.speed, line.direction_used ? line.direction : ""])).digest("hex").slice(0, 16);
  return line;
});
if (errors.length) fail(`lines.csv has ${errors.length} problems:\n${errors.join("\n")}`, 3);

const unused = lines.filter((l) => l.direction && !l.direction_used);
if (unused.length) console.log(`NOTE ${unused.length} rows have a direction, but their engine does not use it (only Omni and Craft do): ${unused.map((l) => l.id).join(", ")}`);
if (flags.has("--dry-run")) {
  for (const l of lines) console.log(`${l.id}  ${l.character}  ${l.engine}  ${l.language}  ${l.voice}${l.direction_used ? `  direction: ${l.direction}` : ""}`);
  console.log(`Dry run: ${lines.length} rows are correct. No audio was generated.`);
  process.exit(0);
}

mkdirSync(out, { recursive: true });
const manPath = join(out, "manifest.json");
const old = existsSync(manPath) ? JSON.parse(readFileSync(manPath, "utf8")) : { lines: [] };
const oldById = new Map(old.lines.map((l) => [l.id, l]));
const failed = [];
const result = [];

for (const l of lines) {
  const file = `${l.id}.wav`;
  const path = join(out, file);
  const prev = oldById.get(l.id);
  const wanted = !only || only.has(l.id);
  if (!wanted || (!flags.has("--force") && prev && prev.input_hash === l.input_hash && existsSync(path))) {
    if (prev) result.push(prev);
    else if (!wanted) continue;
    console.log(`kept      ${l.id}`);
    continue;
  }
  const args = ["tts", "generate", "-t", l.text, "-v", l.voice, "--engine", l.engine, "-l", l.language, "-s", String(l.speed), "-o", path];
  if (l.direction_used) args.push("-i", l.direction);
  let r = vois(args);
  if (r.code === 10 || r.code === 9) r = vois(args); // a full queue or a timeout: one more try
  if (r.code === 2 || r.code === 7) fail(`${l.id}: exit ${r.code}. ${r.code === 2 ? "Vois Studio is not running. Open it, or run: vois-cli service start" : "The plan does not include this engine or the CLI. Run: vois-cli status --format json"}\n${r.out}`, r.code);
  if (r.code !== 0) {
    const reason = r.json?.error?.data?.reason || "";
    failed.push({ id: l.id, code: r.code, reason, message: r.out.slice(0, 300) });
    console.log(`FAILED    ${l.id} (exit ${r.code}${reason ? `, ${reason}` : ""})`);
    if (prev) result.push(prev);
    continue;
  }
  const bytes = readFileSync(path);
  const duration_ms = Math.round((r.json?.duration_secs || 0) * 1000);
  const max = cast.types?.[l.type]?.max_seconds;
  const entry = {
    id: l.id,
    character: l.character,
    type: l.type,
    text: l.text,
    direction: l.direction,
    direction_used: l.direction_used,
    voice: l.voice,
    engine: l.engine,
    engine_used: r.json?.engine_used || l.engine,
    language: l.language,
    file,
    duration_ms,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    input_hash: l.input_hash,
    generated_at: new Date().toISOString(),
  };
  if (max && duration_ms > max * 1000) entry.warning = `longer than ${max} s for type ${l.type}`;
  result.push(entry);
  console.log(`generated ${l.id}  ${(duration_ms / 1000).toFixed(2)} s  ${entry.engine_used}${entry.warning ? `  WARNING ${entry.warning}` : ""}`);
}

const manifest = {
  version: 1,
  generated_at: new Date().toISOString(),
  audio: { container: "wav", codec: "pcm_s16le", sample_rate: 24000, channels: 1 },
  lines: result,
};
writeFileSync(manPath, JSON.stringify(manifest, null, 2) + "\n");
const csvHead = ["Name", "Character", "Type", "File", "DurationMs", "Engine", "Voice", "Language", "Text"];
const csvRows = result.map((e) => [e.id, e.character, e.type, e.file, e.duration_ms, e.engine_used, e.voice, e.language, e.text].map(csvCell).join(","));
writeFileSync(join(out, "manifest.csv"), [csvHead.join(","), ...csvRows].join("\n") + "\n");

console.log(`Manifest: ${manPath} (${result.length} lines)`);
if (failed.length) {
  writeFileSync(join(out, "failed.json"), JSON.stringify(failed, null, 2) + "\n");
  console.log(`FAILED ${failed.length}: ${failed.map((f) => f.id).join(", ")}. Details: ${join(out, "failed.json")}`);
  process.exit(5);
}
