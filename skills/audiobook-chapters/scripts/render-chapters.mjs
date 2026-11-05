#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 vois-so
//
// Narrate the chapters in <workdir>/plan.json with Vois Studio, join the
// blocks with pauses and room tone, export retail MP3s through Vois Studio,
// and check each MP3 against the retail numbers below.
//
// Usage:
//   node render-chapters.mjs <workdir> [--only 01,03] [--redo 01:4,02:1]
//        [--no-export] [--export-only]
//
// Output:
//   <workdir>/blocks/<id>/<nnn>.wav   one take for each block (kept for retakes)
//   <workdir>/wav/<id>.wav            joined chapter, 24 kHz mono, with room tone
//   <workdir>/mp3/<id> - <title>.mp3  retail chapter file (44.1 kHz, 192 kbps CBR)
//   <workdir>/qc.json                 measured values and PASS/FAIL per chapter
//
// Retail numbers checked (common ACX-style rules; check the current rules of
// your retailer): MP3 44.1 kHz, 192 kbps CBR, RMS -23 to -18 dB, peak at or
// below -3 dB, noise floor at or below -60 dB, 0.5-1 s room tone at the start,
// 1-5 s at the end, 120 minutes or less per file, the same channel count in
// every file.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { vois, exitHelp, run, speechLevels, checkRetail, RULES, fail, parseArgs, safeName } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2), ["no-export", "export-only"]);
const workdir = args._[0] && resolve(args._[0]);
if (!workdir) fail("Usage: node render-chapters.mjs <workdir> [--only 01,03] [--redo 01:4] [--no-export] [--export-only]", 3);
const planPath = join(workdir, "plan.json");
if (!existsSync(planPath)) fail(`No plan at ${planPath}. Run split-manuscript.mjs first.`);
const plan = JSON.parse(readFileSync(planPath, "utf8"));

const only = args.only ? String(args.only).split(",").map((s) => s.trim()) : null;
const redo = new Set(args.redo ? String(args.redo).split(",").map((s) => s.trim()) : []);

const missing = Object.entries(plan.voices).filter(([, v]) => !v).map(([k]) => k);
if (missing.length) fail(`Set a voice for each speaker in plan.json "voices": ${missing.join(", ")}`, 3);


function key(obj) {
  return createHash("sha256").update(JSON.stringify(obj)).digest("hex").slice(0, 16);
}

function silence(ms) {
  const dir = join(workdir, "silence");
  mkdirSync(dir, { recursive: true });
  const f = join(dir, `${ms}.wav`);
  if (!existsSync(f)) {
    const r = run("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono", "-t", String(ms / 1000), "-c:a", "pcm_s16le", f]);
    if (r.code !== 0) fail(`ffmpeg could not make silence: ${r.stderr}`);
  }
  return f;
}

function renderBlock(ch, n, block) {
  const dir = join(workdir, "blocks", ch.id);
  mkdirSync(dir, { recursive: true });
  const name = String(n).padStart(3, "0");
  const wav = join(dir, `${name}.wav`);
  const meta = join(dir, `${name}.json`);
  const voice = plan.voices[block.speaker];
  const settings = { text: block.text, voice, engine: plan.engine, language: plan.language, speed: plan.speed, instruct: block.instruct ?? plan.instruct ?? "" };
  const k = key(settings);
  const forced = redo.has(`${ch.id}:${n}`);
  if (!forced && existsSync(wav) && existsSync(meta) && JSON.parse(readFileSync(meta, "utf8")).key === k) return { wav, skipped: true };

  const cmd = ["tts", "generate", "-t", block.text, "-v", voice, "--engine", plan.engine, "-l", plan.language, "-s", String(plan.speed), "-o", wav];
  if (settings.instruct) cmd.push("-i", settings.instruct);
  const r = vois(cmd);
  if (r.code !== 0) {
    const reason = r.json?.error?.data?.reason || r.json?.data?.reason || "";
    fail(`Chapter ${ch.id} block ${n} failed (exit ${r.code}${reason ? `, ${reason}` : ""}): ${exitHelp(r.code)}\n${(r.stderr || r.stdout).trim()}`, r.code);
  }
  writeFileSync(meta, JSON.stringify({ key: k, ...settings, engine_used: r.json?.engine_used, duration_secs: r.json?.duration_secs }, null, 2));
  return { wav, skipped: false, seconds: r.json?.duration_secs };
}

function joinChapter(ch, wavs) {
  const dir = join(workdir, "wav");
  mkdirSync(dir, { recursive: true });
  const list = [silence(plan.head_ms)];
  ch.blocks.forEach((b, i) => {
    if (b.type === "break") {
      list.push(silence(plan.break_ms));
      return;
    }
    list.push(wavs[i]);
    const next = ch.blocks[i + 1];
    if (next && next.type !== "break") list.push(silence(plan.pause_ms));
  });
  list.push(silence(plan.tail_ms));
  const listFile = join(dir, `${ch.id}.txt`);
  writeFileSync(listFile, list.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n") + "\n");
  const joined = join(dir, `${ch.id}.joined.wav`);
  const r = run("ffmpeg", ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", listFile, "-ar", "24000", "-ac", "1", "-c:a", "pcm_s16le", joined]);
  if (r.code !== 0) fail(`ffmpeg could not join chapter ${ch.id}: ${r.stderr}`);
  // Peak control: the export keeps peaks below -1 dB, but retail rules ask for
  // -3 dB. Limit only the few loudest peaks so that no peak is more than
  // CREST_DB above the speech RMS. Then the export target puts RMS and peak
  // inside the retail limits together.
  const out = join(dir, `${ch.id}.wav`);
  const sp = speechLevels(joined);
  const crest = plan.crest_db ?? 15;
  const limitDb = sp.rms + crest;
  const filter = sp.peak > limitDb ? `alimiter=limit=${Math.pow(10, limitDb / 20).toFixed(4)}:level=0:attack=5:release=60:latency=1` : "anull";
  const r2 = run("ffmpeg", ["-y", "-v", "error", "-i", joined, "-af", filter, "-ar", "24000", "-ac", "1", "-c:a", "pcm_s16le", out]);
  if (r2.code !== 0) fail(`ffmpeg could not limit chapter ${ch.id}: ${r2.stderr}`);
  return out;
}

function exportChapter(ch, wav) {
  const dir = join(workdir, "mp3");
  mkdirSync(dir, { recursive: true });
  const out = join(dir, `${ch.id} - ${safeName(ch.title)}.mp3`);
  let target = plan.target_lufs ?? -20;
  let qc;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const r = vois(["export", "audio", "-i", wav, "-o", out, "--audio-format", "mp3", "-b", "192", "--sample-rate", "44100", "--normalize", "--target-lufs", String(target)]);
    if (r.code !== 0) fail(`Export of chapter ${ch.id} failed (exit ${r.code}): ${exitHelp(r.code)}\n${(r.stderr || r.stdout).trim()}`, r.code);
    qc = checkRetail(out, r.json?.mastering?.output_true_peak_db);
    qc.target_lufs = target;
    qc.export_attempts = attempt;
    // Move the loudness target to bring peak and RMS inside the limits.
    // Never raise the level into the peak limit.
    const headroom = RULES.peakMax - qc.peak_db;
    let step = 0;
    if (headroom < 0) step = headroom - 0.3;
    else if (qc.rms_db < RULES.rmsMin) step = Math.min(RULES.rmsMin - qc.rms_db + 0.3, headroom - 0.3);
    else if (qc.rms_db > RULES.rmsMax) step = RULES.rmsMax - qc.rms_db - 0.3;
    if (Math.abs(step) < 0.1) {
      if (qc.rms_db < RULES.rmsMin) qc.problems.push(`RMS and peak cannot both pass: the peaks are too high for this RMS. Lower crest_db in plan.json (now ${plan.crest_db ?? 15}) and run again.`);
      break;
    }
    target = +(target + step).toFixed(1);
  }
  return qc;
}

const qcPath = join(workdir, "qc.json");
const qcAll = existsSync(qcPath) ? JSON.parse(readFileSync(qcPath, "utf8")) : {};
const channelSet = new Set();

for (const ch of plan.chapters) {
  if (only && !only.includes(ch.id)) continue;
  console.log(`Chapter ${ch.id}: ${ch.title}`);
  const wavs = [];
  let wav = join(workdir, "wav", `${ch.id}.wav`);
  if (!args["export-only"]) {
    ch.blocks.forEach((b, i) => {
      if (b.type !== "speech") return;
      const res = renderBlock(ch, i + 1, b);
      wavs[i] = res.wav;
      console.log(`  block ${i + 1}/${ch.blocks.length} ${res.skipped ? "kept (no change)" : `rendered ${res.seconds?.toFixed?.(1) ?? "?"} s`}`);
    });
    wav = joinChapter(ch, wavs);
    ch.status = "rendered";
  }
  if (!args["no-export"]) {
    if (!existsSync(wav)) fail(`No joined WAV for chapter ${ch.id}. Run without --export-only first.`);
    const qc = exportChapter(ch, wav);
    qcAll[ch.id] = qc;
    channelSet.add(qc.channels);
    ch.status = qc.result === "PASS" ? "qc_pass" : "qc_fail";
    console.log(`  ${qc.result}  ${qc.file}`);
    console.log(`  RMS ${qc.rms_db} dB, peak ${qc.peak_db} dB, start ${qc.head_s} s, end ${qc.tail_s} s, ${qc.sample_rate} Hz, ${qc.bit_rate / 1000} kbps${qc.cbr ? " CBR" : ""}, ${qc.duration_s} s`);
    for (const p of qc.problems) console.log(`  - ${p}`);
  }
}

writeFileSync(planPath, JSON.stringify(plan, null, 2) + "\n");
writeFileSync(qcPath, JSON.stringify(qcAll, null, 2) + "\n");
const all = Object.values(qcAll);
const allChannels = new Set(all.map((q) => q.channels));
if (allChannels.size > 1) console.log("FAIL: the chapter files do not all have the same channel count.");
const failed = all.filter((q) => q.result !== "PASS").length;
console.log(`QC: ${all.length - failed} PASS, ${failed} FAIL. Details: ${qcPath}`);
process.exit(failed || allChannels.size > 1 ? 1 : 0);
