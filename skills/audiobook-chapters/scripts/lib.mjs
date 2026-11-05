// SPDX-License-Identifier: MIT
// Copyright (c) 2026 vois-so
// Shared helpers for the audiobook-chapters scripts: find vois-cli, run it,
// run ffmpeg/ffprobe, and measure audio. Node.js 18+, no npm dependencies.

import { spawnSync } from "node:child_process";
import { existsSync, openSync, readSync, closeSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";

// Find vois-cli. VOIS_CLI overrides the default install path.
export function cliPath() {
  if (process.env.VOIS_CLI) return process.env.VOIS_CLI;
  const candidates =
    platform() === "win32"
      ? [join(process.env.LOCALAPPDATA || "", "Vois", "vois-cli.exe")]
      : [
          "/Applications/Vois.app/Contents/MacOS/vois-cli",
          join(homedir(), "Applications", "Vois.app", "Contents", "MacOS", "vois-cli"),
        ];
  const found = candidates.find((p) => existsSync(p));
  if (!found) {
    fail(`vois-cli not found. Looked in: ${candidates.join(", ")}. Install Vois Studio, or set VOIS_CLI to the full path.`);
  }
  return found;
}

const EXIT_HELP = {
  2: "Vois Studio is not running. Open Vois Studio, or run: vois-cli service start",
  3: "Invalid arguments or a bad cli.toml value.",
  4: "Not found (voice, script or file). Check the ID with: vois-cli voice list --format json",
  5: "Generation failed. Try the line again; if it fails again, change the text or the voice.",
  6: "Export failed.",
  7: "Your plan does not include this. Run: vois-cli status --format json and show purchase_url to the user.",
  8: "Quota exceeded.",
  9: "Timeout. Vois Studio did not answer in time.",
  10: "Sonic queue full. Wait a few seconds and try again.",
  11: "Not enough free memory for this engine. Close other apps or use a smaller engine.",
  12: "Model download failed.",
  13: "The engine package is not available to download yet.",
  64: "Usage error, unknown language (pass --language), or export shorter than 5 seconds.",
  130: "Cancelled.",
};

export function exitHelp(code) {
  return EXIT_HELP[code] || `vois-cli exit code ${code}`;
}

// Run vois-cli with --format json. Returns { code, json, stdout, stderr }.
export function vois(args, { retries = 1 } = {}) {
  const cli = cliPath();
  let last;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const r = spawnSync(cli, ["--format", "json", ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    let json = null;
    try {
      json = JSON.parse(r.stdout);
    } catch {
      json = null;
    }
    last = { code: r.status ?? 1, json, stdout: r.stdout, stderr: r.stderr };
    // Retry only the codes where a second try can help.
    if (last.code === 0 || ![5, 9, 10].includes(last.code)) break;
    sleep(last.code === 10 ? 5000 : 1000);
  }
  return last;
}

export function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export function tool(name) {
  return process.env[name.toUpperCase()] || name;
}

// Run ffmpeg or ffprobe. Stops the script if the tool is missing.
export function run(bin, args) {
  const r = spawnSync(tool(bin), args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.error && r.error.code === "ENOENT") fail(`${bin} not found. Install ffmpeg (it includes ffprobe), or set ${bin.toUpperCase()} to its path.`);
  return { code: r.status ?? 1, stdout: r.stdout || "", stderr: r.stderr || "" };
}

export function probe(file) {
  const r = run("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-show_chapters", "-of", "json", file]);
  if (r.code !== 0) fail(`ffprobe could not read ${file}: ${r.stderr.trim()}`);
  return JSON.parse(r.stdout);
}

// Overall RMS and sample peak (dBFS) of a file or of a part of it.
export function levels(file, { start, duration } = {}) {
  const args = ["-hide_banner", "-nostats"];
  if (start !== undefined) args.push("-ss", String(start));
  if (duration !== undefined) args.push("-t", String(duration));
  args.push("-i", file, "-af", "astats=measure_perchannel=none:measure_overall=RMS_level+Peak_level", "-f", "null", "-");
  const r = run("ffmpeg", args);
  const num = (label) => {
    const m = r.stderr.match(new RegExp(`${label} dB: (-?inf|-?[0-9.]+)`));
    if (!m) return null;
    return m[1].includes("inf") ? -Infinity : Number(m[1]);
  };
  return { rms: num("RMS level"), peak: num("Peak level") };
}

// RMS and peak (dBFS) of the speech only: pauses longer than 0.2 s removed.
export function speechLevels(file) {
  const r = run("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-af",
    "silenceremove=start_periods=1:stop_periods=-1:stop_duration=0.2:stop_threshold=-50dB,astats=measure_perchannel=none:measure_overall=RMS_level+Peak_level",
    "-f", "null", "-"]);
  const num = (label) => {
    const m = r.stderr.match(new RegExp(`${label} dB: (-?inf|-?[0-9.]+)`));
    return m ? (m[1].includes("inf") ? -Infinity : Number(m[1])) : null;
  };
  return { rms: num("RMS level"), peak: num("Peak level") };
}

// Silence at the start and at the end of a file, in seconds.
export function edgeSilence(file, durationSec, thresholdDb = -60, minSec = 0.2) {
  const r = run("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-af", `silencedetect=noise=${thresholdDb}dB:d=${minSec}`, "-f", "null", "-"]);
  const starts = [...r.stderr.matchAll(/silence_start: (-?[0-9.]+)/g)].map((m) => Number(m[1]));
  const ends = [...r.stderr.matchAll(/silence_end: ([0-9.]+)/g)].map((m) => Number(m[1]));
  let head = 0;
  if (starts.length && starts[0] <= 0.01 && ends.length) head = ends[0];
  let tail = 0;
  if (starts.length) {
    const lastStart = starts[starts.length - 1];
    // A silence that runs to the end of the file has no silence_end, or (in
    // newer ffmpeg) a silence_end at the end of the file.
    const lastEnd = ends.length === starts.length ? ends[ends.length - 1] : null;
    if (lastEnd === null || lastEnd >= durationSec - 0.05) tail = durationSec - lastStart;
  }
  return { head, tail };
}

export function fail(message, code = 1) {
  console.error(`ERROR: ${message}`);
  process.exit(code);
}

// Flags in `booleans` never take a value.
export function parseArgs(argv, booleans = []) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (booleans.includes(key) || next === undefined || next.startsWith("--")) out[key] = true;
      else {
        out[key] = next;
        i++;
      }
    } else out._.push(a);
  }
  return out;
}

export function safeName(s) {
  return String(s).replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").trim().slice(0, 80) || "untitled";
}

// Retail numbers (common ACX-style rules; check the current rules of your retailer).
export const RULES = { rmsMin: -23, rmsMax: -18, peakMax: -3, floorMax: -60, headMin: 0.5, headMax: 1.0, tailMin: 1.0, tailMax: 5.0, maxSec: 7200 };

function isCbr(file) {
  const fd = openSync(file, "r");
  const buf = Buffer.alloc(16384);
  readSync(fd, buf, 0, buf.length, 0);
  closeSync(fd);
  const s = buf.toString("latin1");
  if (s.includes("Xing")) return false;
  return true; // "Info" tag or no tag: constant bitrate
}

export function checkRetail(file, voisPeak) {
  const info = probe(file);
  const a = info.streams.find((s) => s.codec_type === "audio") || {};
  const duration = Number(info.format.duration);
  const lv = levels(file);
  const edges = edgeSilence(file, duration, RULES.floorMax, 0.3);
  const floor = edges.head > 0.2 ? levels(file, { start: 0.05, duration: Math.max(0.1, edges.head - 0.1) }).rms : null;
  const peak = Math.max(lv.peak, voisPeak ?? -Infinity);
  const r = {
    file,
    codec: a.codec_name,
    sample_rate: Number(a.sample_rate),
    channels: a.channels,
    bit_rate: Number(a.bit_rate),
    cbr: isCbr(file),
    duration_s: +duration.toFixed(2),
    rms_db: +lv.rms.toFixed(2),
    peak_db: +peak.toFixed(2),
    noise_floor_db: floor === null ? null : floor === -Infinity ? "-inf" : +floor.toFixed(1),
    head_s: +edges.head.toFixed(2),
    tail_s: +edges.tail.toFixed(2),
  };
  const problems = [];
  if (r.codec !== "mp3") problems.push("not MP3");
  if (r.sample_rate !== 44100) problems.push(`sample rate ${r.sample_rate}, not 44100`);
  if (r.bit_rate < 192000 || !r.cbr) problems.push("not 192 kbps CBR");
  if (r.rms_db < RULES.rmsMin || r.rms_db > RULES.rmsMax) problems.push(`RMS ${r.rms_db} dB outside ${RULES.rmsMin} to ${RULES.rmsMax}`);
  if (r.peak_db > RULES.peakMax) problems.push(`peak ${r.peak_db} dB above ${RULES.peakMax}`);
  if (floor !== null && floor > RULES.floorMax) problems.push(`noise floor ${r.noise_floor_db} dB above ${RULES.floorMax}`);
  if (r.head_s < RULES.headMin || r.head_s > RULES.headMax + 0.1) problems.push(`room tone at start ${r.head_s} s (need ${RULES.headMin}-${RULES.headMax})`);
  if (r.tail_s < RULES.tailMin || r.tail_s > RULES.tailMax) problems.push(`room tone at end ${r.tail_s} s (need ${RULES.tailMin}-${RULES.tailMax})`);
  if (duration > RULES.maxSec) problems.push("longer than 120 minutes: split the chapter");
  r.problems = problems;
  r.result = problems.length ? "FAIL" : "PASS";
  return r;
}
