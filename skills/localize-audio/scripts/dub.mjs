#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 vois-so
//
// Dub timed segments into another language with Vois Studio, and fit each
// segment into the time slot of the original.
//
// Usage:
//   node dub.mjs init <source.srt|source.json> <workdir> --target Spanish
//        [--source-language English] [--engine multilingual] [--voice <id>]
//   node dub.mjs run <workdir> [--force]
//
// init writes <workdir>/segments.json with an empty "translation" for each
// segment. Write the translations into that file, then use "run".
//
// run, for each segment:
//   1. generates the translation with vois-cli tts generate (speed 1.0),
//   2. removes the silence at the two ends and measures the length,
//   3. if it is longer than its slot (until the next segment starts), it
//      generates it again faster, up to "max_speed" (default 1.15),
//   4. if it is still too long, it marks the segment "rewrite" with a
//      maximum number of characters.
// When all segments fit, it puts each segment at its start time in one track
// (<workdir>/dub.wav, 24 kHz mono) and measures each start in the track.
// Exit 0 = all segments fit and all starts are within 0.3 s.
// Exit 3 = rewrite one or more translations (see fit-report.json).

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join, resolve } from "node:path";

const LANGS = {
  fast: ["English", "German", "Spanish", "Italian", "Portuguese"],
  multilingual: ["Arabic", "Chinese", "Danish", "Dutch", "English", "Finnish", "French", "German", "Greek", "Hebrew", "Hindi", "Italian", "Japanese", "Korean", "Malay", "Norwegian", "Polish", "Portuguese", "Russian", "Spanish", "Swahili", "Swedish", "Turkish"],
  omni: ["Arabic", "Burmese", "Chinese", "Danish", "Dutch", "English", "Finnish", "French", "German", "Greek", "Hebrew", "Hindi", "Indonesian", "Italian", "Japanese", "Khmer", "Korean", "Lao", "Malay", "Norwegian", "Polish", "Portuguese", "Russian", "Spanish", "Swahili", "Swedish", "Tagalog", "Thai", "Turkish", "Vietnamese"],
  sonic: ["Arabic", "Bulgarian", "Croatian", "Czech", "Danish", "Dutch", "English", "Estonian", "Finnish", "French", "German", "Greek", "Hindi", "Hungarian", "Indonesian", "Italian", "Japanese", "Korean", "Latvian", "Lithuanian", "Polish", "Portuguese", "Romanian", "Russian", "Slovak", "Slovenian", "Spanish", "Swedish", "Turkish", "Ukrainian", "Vietnamese"],
  craft: ["Chinese", "English", "French", "German", "Italian", "Japanese", "Korean", "Portuguese", "Russian", "Spanish"],
};
const START_TOLERANCE = 0.3;
const GUARD = 0.15; // seconds of silence before the next segment starts (also lets the start check find each start)

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

function sh(bin, args) {
  const r = spawnSync(process.env[bin.toUpperCase()] || bin, args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  if (r.error && r.error.code === "ENOENT") fail(`${bin} not found. Install ffmpeg (it includes ffprobe), or set ${bin.toUpperCase()}.`);
  return { code: r.status ?? 1, stdout: r.stdout || "", stderr: r.stderr || "" };
}

function vois(args) {
  const r = spawnSync(cliPath(), ["--format", "json", ...args], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  let json = null;
  try {
    json = JSON.parse(r.stdout);
  } catch {}
  return { code: r.status ?? 1, json, out: (r.stderr || r.stdout || "").trim() };
}

const duration = (f) => Number(JSON.parse(sh("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "json", f]).stdout).format.duration);

// "00:00:01,500" or "00:00:01.500" -> 1.5
function tc(s) {
  const m = s.trim().match(/^(\d+):(\d+):(\d+)[,.](\d+)$/);
  if (!m) fail(`not a time code: ${s}`, 3);
  return +m[1] * 3600 + +m[2] * 60 + +m[3] + Number(`0.${m[4]}`);
}

function parseSrt(text) {
  return text
    .replace(/\r\n?/g, "\n")
    .trim()
    .split(/\n\s*\n/)
    .map((block, i) => {
      const lines = block.split("\n");
      const t = lines.findIndex((l) => l.includes("-->"));
      if (t < 0) return null;
      const [a, b] = lines[t].split("-->");
      return { id: `s${i + 1}`, start: +tc(a).toFixed(3), end: +tc(b.split(/\s/).filter(Boolean)[0]).toFixed(3), text: lines.slice(t + 1).join(" ").replace(/<[^>]+>/g, "").trim(), translation: "" };
    })
    .filter(Boolean);
}

const argv = process.argv.slice(2);
const opt = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : def;
};
const [cmd, a1, a2] = argv.filter((x, i) => !x.startsWith("--") && !(i > 0 && argv[i - 1].startsWith("--") && argv[i - 1] !== "--force"));

if (cmd === "init") {
  if (!a1 || !a2 || !opt("target")) fail("Usage: node dub.mjs init <source.srt|source.json> <workdir> --target Spanish", 3);
  const src = readFileSync(a1, "utf8");
  const segs = a1.toLowerCase().endsWith(".srt") ? parseSrt(src) : (JSON.parse(src).segments || JSON.parse(src)).map((s, i) => ({ id: s.id || `s${i + 1}`, start: s.start, end: s.end, text: s.text, translation: s.translation || "" }));
  mkdirSync(a2, { recursive: true });
  const out = join(a2, "segments.json");
  if (existsSync(out) && !argv.includes("--force")) fail(`${out} exists. Add --force to replace it.`, 3);
  const doc = {
    source_language: opt("source-language", "English"),
    target_language: opt("target"),
    engine: opt("engine", "multilingual"),
    voice: opt("voice", ""),
    instruct: "",
    max_speed: 1.15,
    total_s: null,
    segments: segs,
  };
  writeFileSync(out, JSON.stringify(doc, null, 2) + "\n");
  console.log(`Wrote ${out} with ${segs.length} segments. Write each "translation", set "voice", then: node dub.mjs run ${a2}`);
  process.exit(0);
}

if (cmd !== "run" || !a1) fail("Usage: node dub.mjs init <source> <workdir> --target <Language>  |  node dub.mjs run <workdir> [--force]", 3);

const dir = resolve(a1);
const docPath = join(dir, "segments.json");
const doc = JSON.parse(readFileSync(docPath, "utf8"));
const { engine, voice, target_language: lang } = doc;
const maxSpeed = Math.min(2.0, Number(doc.max_speed || 1.15));
const segs = doc.segments;

// Check the input before any generation.
const problems = [];
if (!LANGS[engine]) problems.push(`engine "${engine}" is not one of ${Object.keys(LANGS).join(", ")}`);
else if (!LANGS[engine].includes(lang)) problems.push(`${engine} does not speak ${lang}. Engines that speak it: ${Object.keys(LANGS).filter((e) => LANGS[e].includes(lang)).join(", ") || "none"}`);
if (!voice) problems.push(`set "voice" in segments.json`);
if (engine === "sonic" && !voice.startsWith("sonic_")) problems.push("Sonic speaks only its built-in voices (sonic_cedar, ...)");
segs.forEach((s, i) => {
  if (!s.translation || !s.translation.trim()) problems.push(`${s.id}: no translation`);
  if (!(s.end > s.start)) problems.push(`${s.id}: end must be after start`);
  if (i > 0 && s.start < segs[i - 1].start) problems.push(`${s.id}: segments must be in time sequence`);
});
if (problems.length) fail(`segments.json has problems:\n${problems.join("\n")}`, 3);

const takes = join(dir, "takes");
mkdirSync(takes, { recursive: true });

// Generate one take at one speed, remove the silence at the two ends, and measure it.
function take(s, speed) {
  const key = createHash("sha256").update(JSON.stringify([s.translation.trim(), voice, engine, lang, speed, doc.instruct || ""])).digest("hex").slice(0, 12);
  const raw = join(takes, `${s.id}-${key}.wav`);
  const trim = join(takes, `${s.id}-${key}.trim.wav`);
  if (argv.includes("--force") || !existsSync(trim)) {
    const args = ["tts", "generate", "-t", s.translation.trim(), "-v", voice, "--engine", engine, "-l", lang, "-s", speed.toFixed(2), "-o", raw];
    if (doc.instruct && (engine === "omni" || engine === "craft")) args.push("-i", doc.instruct);
    let r = vois(args);
    if (r.code === 9 || r.code === 10 || r.code === 5) r = vois(args);
    if (r.code !== 0) fail(`${s.id}: vois-cli exit ${r.code}. ${{ 2: "Open Vois Studio, or run: vois-cli service start", 4: "Check the voice ID with: vois-cli voice list --format json", 7: "The plan does not include this engine or the CLI.", 11: "Not enough free memory for this engine.", 64: "Check the language name." }[r.code] || ""}\n${r.out}`, r.code);
    const f = "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05,areverse";
    const t = sh("ffmpeg", ["-y", "-v", "error", "-i", raw, "-af", f, "-ar", "24000", "-ac", "1", "-c:a", "pcm_s16le", trim]);
    if (t.code !== 0) fail(`ffmpeg could not trim ${raw}: ${t.stderr}`);
  }
  return { file: trim, seconds: duration(trim), speed };
}

const report = [];
segs.forEach((s, i) => {
  const next = segs[i + 1];
  const endLimit = next ? next.start : doc.total_s ?? s.end + 0.5;
  const slot = +(endLimit - s.start - GUARD).toFixed(3);
  const base = take(s, 1.0);
  let best = base;
  if (base.seconds > slot) {
    const need = base.seconds / slot;
    if (need <= maxSpeed) {
      let speed = Math.min(maxSpeed, Math.ceil((need + 0.02) * 100) / 100);
      best = take(s, speed);
      if (best.seconds > slot && speed < maxSpeed) best = take(s, maxSpeed);
    }
  }
  const fits = best.seconds <= slot;
  const row = {
    id: s.id,
    start: s.start,
    slot_s: slot,
    seconds_at_1x: +base.seconds.toFixed(3),
    speed: best.speed,
    seconds: +best.seconds.toFixed(3),
    status: fits ? "fit" : "rewrite",
    file: best.file,
  };
  if (!fits) {
    // Characters that fit at max_speed, with 5% margin.
    row.max_characters = Math.floor((s.translation.trim().length * slot * maxSpeed) / base.seconds * 0.95);
    row.characters_now = s.translation.trim().length;
  }
  report.push(row);
  console.log(`${s.id}  slot ${slot.toFixed(2)} s  at 1.0x ${base.seconds.toFixed(2)} s  ->  ${row.status === "fit" ? `fit at ${best.speed.toFixed(2)}x (${best.seconds.toFixed(2)} s)` : `REWRITE to ${row.max_characters} characters or fewer (now ${row.characters_now})`}`);
});
writeFileSync(join(dir, "fit-report.json"), JSON.stringify(report, null, 2) + "\n");

const rewrite = report.filter((r) => r.status === "rewrite");
if (rewrite.length) {
  console.log(`Rewrite ${rewrite.length} translations shorter (${rewrite.map((r) => r.id).join(", ")}), then run again. Details: ${join(dir, "fit-report.json")}`);
  process.exit(3);
}

// Pad each take to its span (start to next start) and put them in sequence.
const padded = join(dir, "padded");
mkdirSync(padded, { recursive: true });
const list = [];
const lead = join(padded, "_lead.wav");
if (segs[0].start > 0) {
  sh("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono", "-t", String(segs[0].start), "-c:a", "pcm_s16le", lead]);
  list.push(lead);
}
report.forEach((r, i) => {
  const next = segs[i + 1];
  const span = next ? next.start - segs[i].start : Math.max(r.seconds, (doc.total_s ?? segs[i].end) - segs[i].start);
  const out = join(padded, `${r.id}.wav`);
  const p = sh("ffmpeg", ["-y", "-v", "error", "-i", r.file, "-af", `apad=whole_dur=${span.toFixed(4)}`, "-t", span.toFixed(4), "-ar", "24000", "-ac", "1", "-c:a", "pcm_s16le", out]);
  if (p.code !== 0) fail(`ffmpeg could not pad ${r.id}: ${p.stderr}`);
  list.push(out);
});
const listFile = join(dir, "dub-files.txt");
writeFileSync(listFile, list.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n") + "\n");
const dub = join(dir, "dub.wav");
const j = sh("ffmpeg", ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", listFile, "-c:a", "pcm_s16le", dub]);
if (j.code !== 0) fail(`ffmpeg could not make the track: ${j.stderr}`);

// Measure where speech starts in the track, and compare with each start time.
const sd = sh("ffmpeg", ["-hide_banner", "-nostats", "-i", dub, "-af", "silencedetect=noise=-45dB:d=0.1", "-f", "null", "-"]);
const onsets = [...sd.stderr.matchAll(/silence_end: ([0-9.]+)/g)].map((m) => Number(m[1]));
if (!/silence_start: 0(\.0+)?\b/.test(sd.stderr.split("\n").find((l) => l.includes("silence_start")) || "")) onsets.unshift(0);
let ok = true;
const starts = segs.map((s) => {
  const near = onsets.reduce((b, o) => (Math.abs(o - s.start) < Math.abs(b - s.start) ? o : b), Infinity);
  const diff = +(near - s.start).toFixed(3);
  const pass = Math.abs(diff) <= START_TOLERANCE;
  if (!pass) ok = false;
  console.log(`  ${s.id}  expected ${s.start.toFixed(2)} s  measured ${Number.isFinite(near) ? near.toFixed(2) : "none"} s  diff ${diff} s  ${pass ? "PASS" : "FAIL"}`);
  return { id: s.id, expected: s.start, measured: near, diff, pass };
});
writeFileSync(join(dir, "start-check.json"), JSON.stringify({ tolerance_s: START_TOLERANCE, starts }, null, 2) + "\n");
console.log(`Track: ${dub} (${duration(dub).toFixed(2)} s)`);
console.log(ok ? "Start check: PASS" : "Start check: FAIL");
process.exit(ok ? 0 : 1);
