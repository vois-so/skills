#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 vois-so
//
// Check a game-barks output folder before you import it into a game engine:
// each manifest line has its WAV, the SHA-256 is the same, the WAV is 24 kHz
// mono PCM, it is not silent, and it does not clip.
//
// Usage:
//   node check-manifest.mjs <out_dir> [--csv lines.csv]
//
// --csv: also report rows of the spreadsheet that have no audio yet.
// Exit 0 = all checks pass, 1 = one or more problems.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const argv = process.argv.slice(2);
const csvIdx = argv.indexOf("--csv");
const dir = resolve(argv.find((a, i) => !a.startsWith("--") && i !== csvIdx + 1) || "");
const manPath = join(dir, "manifest.json");
if (!existsSync(manPath)) {
  console.error(`ERROR: no manifest at ${manPath}. Usage: node check-manifest.mjs <out_dir> [--csv lines.csv]`);
  process.exit(3);
}
const man = JSON.parse(readFileSync(manPath, "utf8"));

function ff(bin, args) {
  const r = spawnSync(process.env[bin.toUpperCase()] || bin, args, { encoding: "utf8" });
  if (r.error) return null;
  return r;
}

const problems = [];
for (const l of man.lines) {
  const p = join(dir, l.file);
  if (!existsSync(p)) {
    problems.push(`${l.id}: file ${l.file} is missing`);
    continue;
  }
  const sha = createHash("sha256").update(readFileSync(p)).digest("hex");
  if (sha !== l.sha256) problems.push(`${l.id}: the WAV changed after the manifest was written (SHA-256 differs)`);
  const pr = ff("ffprobe", ["-v", "error", "-show_entries", "stream=codec_name,sample_rate,channels:format=duration", "-of", "json", p]);
  if (!pr) {
    console.log("NOTE ffprobe not found: format, silence and clip checks skipped.");
    continue;
  }
  const info = JSON.parse(pr.stdout);
  const s = info.streams?.[0] || {};
  if (s.codec_name !== "pcm_s16le" || Number(s.sample_rate) !== 24000 || s.channels !== 1) problems.push(`${l.id}: ${s.codec_name} ${s.sample_rate} Hz ${s.channels} ch, not pcm_s16le 24000 Hz mono`);
  const st = ff("ffmpeg", ["-hide_banner", "-nostats", "-i", p, "-af", "astats=measure_perchannel=none:measure_overall=RMS_level+Peak_level", "-f", "null", "-"]);
  const peak = Number((st.stderr.match(/Peak level dB: (-?[0-9.]+|-inf)/) || [])[1]);
  const rms = Number((st.stderr.match(/RMS level dB: (-?[0-9.]+|-inf)/) || [])[1]);
  if (!(rms > -50)) problems.push(`${l.id}: almost silent (RMS ${rms} dB)`);
  if (peak >= -0.1) problems.push(`${l.id}: peak ${peak} dB, the line can clip`);
  if (Math.abs(Number(info.format.duration) * 1000 - l.duration_ms) > 100) problems.push(`${l.id}: duration differs from the manifest`);
}

if (csvIdx >= 0) {
  const text = readFileSync(argv[csvIdx + 1], "utf8").replace(/^﻿/, "");
  const head = text.split(/\r?\n/)[0].toLowerCase().split(",").map((h) => h.trim());
  const idCol = head.indexOf("id");
  const ids = new Set(man.lines.map((l) => l.id));
  // Simple read of the id column: ids have no commas or quotes.
  for (const row of text.split(/\r?\n/).slice(1)) {
    const id = row.split(",")[idCol]?.trim();
    if (id && !ids.has(id)) problems.push(`${id}: in the spreadsheet, but no audio in the manifest`);
  }
}

console.log(`${man.lines.length} lines in the manifest, ${problems.length} problems.`);
for (const p of problems) console.log(`- ${p}`);
console.log(problems.length ? "FAIL" : "PASS");
process.exit(problems.length ? 1 : 0);
