#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 vois-so
//
// Measure a reference recording before you clone a voice with Vois Studio.
//
// Usage:
//   node check-reference.mjs <audio file> [--transcript "exact words"]
//
// Checks (FAIL stops the clone; WARN lowers the quality of the clone):
//   length       5-60 s is accepted by vois-cli voice clone; 10-15 s is best
//   clipping     sample peak at -0.1 dBFS or higher = FAIL; above -1 dBFS = WARN
//   level        speech RMS below -35 dBFS = WARN (too quiet)
//   noise floor  quietest 0.5 s above -50 dBFS = WARN, above -40 dBFS = FAIL
//   silence      more than 1 s of silence at the start or at the end = WARN
//   transcript   about 2-4 words a second of speech; far outside = WARN
// Exit 0 = no FAIL, 1 = one or more FAIL.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const argv = process.argv.slice(2);
const file = argv.find((a, i) => !a.startsWith("--") && argv[i - 1] !== "--transcript");
const ti = argv.indexOf("--transcript");
const transcript = ti >= 0 ? argv[ti + 1] : "";
if (!file || !existsSync(file)) {
  console.error('ERROR: Usage: node check-reference.mjs <audio file> [--transcript "exact words"]');
  process.exit(3);
}

function sh(bin, args) {
  const r = spawnSync(process.env[bin.toUpperCase()] || bin, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.error && r.error.code === "ENOENT") {
    console.error(`ERROR: ${bin} not found. Install ffmpeg (it includes ffprobe).`);
    process.exit(1);
  }
  return r;
}

const info = JSON.parse(sh("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", file]).stdout || "{}");
const a = (info.streams || []).find((s) => s.codec_type === "audio");
if (!a) {
  console.error("ERROR: no audio stream in the file.");
  process.exit(1);
}
const duration = Number(info.format.duration);

const num = (text, label) => {
  const m = text.match(new RegExp(`${label} dB: (-?inf|-?[0-9.]+)`));
  return m ? (m[1].includes("inf") ? -Infinity : Number(m[1])) : null;
};
const overall = sh("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-af", "astats=measure_perchannel=none:measure_overall=Peak_level", "-f", "null", "-"]).stderr;
const peak = num(overall, "Peak level");
const speech = sh("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-af", "silenceremove=start_periods=1:stop_periods=-1:stop_duration=0.3:stop_threshold=-45dB,astats=measure_perchannel=none:measure_overall=RMS_level", "-f", "null", "-"]).stderr;
const speechRms = num(speech, "RMS level");
const speechSec = Number((speech.match(/time=(\d+):(\d+):([0-9.]+)/g) || []).pop()?.replace(/time=(\d+):(\d+):([0-9.]+)/, (_, h, m, s) => String(+h * 3600 + +m * 60 + +s)) || 0);

// Quietest 0.5 s window = an estimate of the noise floor.
const win = sh("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-af", "aresample=24000,pan=mono|c0=c0,asetnsamples=n=12000:p=0,astats=metadata=1:reset=1,ametadata=mode=print:key=lavfi.astats.Overall.RMS_level", "-f", "null", "-"]).stderr;
const windows = [...win.matchAll(/lavfi\.astats\.Overall\.RMS_level=(-?inf|-?[0-9.]+)/g)].map((m) => (m[1].includes("inf") ? -Infinity : Number(m[1])));
const floor = windows.length ? Math.min(...windows) : null;

const sd = sh("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-af", "silencedetect=noise=-45dB:d=0.3", "-f", "null", "-"]).stderr;
const starts = [...sd.matchAll(/silence_start: (-?[0-9.]+)/g)].map((m) => Number(m[1]));
const ends = [...sd.matchAll(/silence_end: ([0-9.]+)/g)].map((m) => Number(m[1]));
const head = starts.length && starts[0] <= 0.01 && ends.length ? ends[0] : 0;
const lastEnd = ends.length === starts.length ? ends[ends.length - 1] : null;
const tail = starts.length && (lastEnd === null || lastEnd >= duration - 0.05) ? duration - starts[starts.length - 1] : 0;

const results = [];
const add = (level, item, text) => results.push({ level, item, text });

if (duration < 5 || duration > 60) add("FAIL", "length", `${duration.toFixed(1)} s; vois-cli voice clone accepts 5-60 s`);
else if (duration < 10 || duration > 15) add("WARN", "length", `${duration.toFixed(1)} s; 10-15 s of clean speech gives the best clone`);
else add("PASS", "length", `${duration.toFixed(1)} s`);

if (peak >= -0.1) add("FAIL", "clipping", `peak ${peak.toFixed(1)} dBFS; record again with a lower input level`);
else if (peak > -1) add("WARN", "clipping", `peak ${peak.toFixed(1)} dBFS; keep peaks below -1 dBFS`);
else add("PASS", "clipping", `peak ${peak.toFixed(1)} dBFS`);

if (speechRms !== null && speechRms < -35) add("WARN", "level", `speech RMS ${speechRms.toFixed(1)} dBFS; the recording is quiet, move closer to the microphone`);
else if (speechRms !== null) add("PASS", "level", `speech RMS ${speechRms.toFixed(1)} dBFS`);

if (floor === null) add("WARN", "noise floor", "could not measure");
else if (floor > -40) add("FAIL", "noise floor", `${floor.toFixed(1)} dBFS; too much background noise, record in a quieter room`);
else if (floor > -50) add("WARN", "noise floor", `${floor.toFixed(1)} dBFS; a quieter room gives a cleaner clone`);
else add("PASS", "noise floor", `${floor === -Infinity ? "-inf" : floor.toFixed(1)} dBFS`);

if (head > 1 || tail > 1) add("WARN", "silence", `${head.toFixed(1)} s at the start, ${tail.toFixed(1)} s at the end; cut it to less than 0.5 s`);
else add("PASS", "silence", `${head.toFixed(1)} s at the start, ${tail.toFixed(1)} s at the end`);

if (transcript) {
  const words = transcript.trim().split(/\s+/).length;
  const rate = words / Math.max(0.1, speechSec || duration);
  if (rate < 1.5 || rate > 5) add("WARN", "transcript", `${words} words for ${(speechSec || duration).toFixed(1)} s of speech (${rate.toFixed(1)} words a second); make sure that it has every spoken word and nothing more`);
  else add("PASS", "transcript", `${words} words, ${rate.toFixed(1)} words a second`);
} else add("WARN", "transcript", "no --transcript given; vois-cli voice clone needs the exact transcript");

console.log(`${file}: ${a.codec_name}, ${a.sample_rate} Hz, ${a.channels} ch`);
for (const r of results) console.log(`${r.level.padEnd(4)}  ${r.item.padEnd(11)}  ${r.text}`);
const failed = results.some((r) => r.level === "FAIL");
console.log(failed ? "Reference check: FAIL" : results.some((r) => r.level === "WARN") ? "Reference check: PASS with warnings" : "Reference check: PASS");
process.exit(failed ? 1 : 0);
