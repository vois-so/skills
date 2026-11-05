// SPDX-License-Identifier: MIT
// Copyright (c) 2026 vois-so
// Shared helpers for the podcast-episode scripts: find vois-cli, run it, run
// ffmpeg/ffprobe, and read a two-host script. Node.js 18+, no npm dependencies.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";

export function cliPath() {
  if (process.env.VOIS_CLI) return process.env.VOIS_CLI;
  const candidates =
    platform() === "win32"
      ? [join(process.env.LOCALAPPDATA || "", "Vois", "vois-cli.exe")]
      : ["/Applications/Vois.app/Contents/MacOS/vois-cli", join(homedir(), "Applications", "Vois.app", "Contents", "MacOS", "vois-cli")];
  const found = candidates.find((p) => existsSync(p));
  if (!found) fail(`vois-cli not found. Looked in: ${candidates.join(", ")}. Install Vois Studio, or set VOIS_CLI to the full path.`);
  return found;
}

const EXIT_HELP = {
  2: "Vois Studio is not running. Open Vois Studio, or run: vois-cli service start",
  3: "Invalid arguments, a destructive command without --force, or a bad cli.toml value.",
  4: "Not found. Check the voice, project or script ID.",
  5: "Generation failed. Run the step again; if it fails again, change the line or the voice.",
  6: "Export failed.",
  7: "Your plan does not include this. Run: vois-cli status --format json and show purchase_url to the user.",
  9: "Timeout. Vois Studio did not answer in time.",
  10: "Sonic queue full. Wait a few seconds and try again.",
  11: "Not enough free memory for the selected engine.",
  13: "The engine package is not available to download yet.",
  64: "Usage error, unknown language (pass --language), or export shorter than 5 seconds.",
  130: "Cancelled.",
};
export const exitHelp = (code) => EXIT_HELP[code] || `vois-cli exit code ${code}`;

// Run vois-cli. Returns { code, json, stdout, stderr }.
export function vois(args, { format = "json" } = {}) {
  const r = spawnSync(cliPath(), ["--format", format, ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  let json = null;
  try {
    json = JSON.parse(r.stdout);
  } catch {
    json = null;
  }
  return { code: r.status ?? 1, json, stdout: r.stdout || "", stderr: r.stderr || "" };
}

// Run vois-cli and stop with a clear message if it fails.
export function voisOk(args, what, opts) {
  const r = vois(args, opts);
  if (r.code !== 0) fail(`${what} failed (exit ${r.code}): ${exitHelp(r.code)}\n${(r.stderr || r.stdout).trim()}`, r.code);
  return r;
}

export function run(bin, args) {
  const r = spawnSync(process.env[bin.toUpperCase()] || bin, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.error && r.error.code === "ENOENT") fail(`${bin} not found. Install ffmpeg (it includes ffprobe), or set ${bin.toUpperCase()} to its path.`);
  return { code: r.status ?? 1, stdout: r.stdout || "", stderr: r.stderr || "" };
}

export function probe(file) {
  const r = run("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", file]);
  if (r.code !== 0) fail(`ffprobe could not read ${file}: ${r.stderr.trim()}`);
  return JSON.parse(r.stdout);
}

// Integrated loudness (LUFS) and true peak (dBTP) with the ffmpeg ebur128 filter.
export function loudness(file) {
  const r = run("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-af", "ebur128=peak=true", "-f", "null", "-"]);
  const tail = r.stderr.slice(r.stderr.lastIndexOf("Summary:"));
  const i = tail.match(/I:\s+(-?[0-9.]+) LUFS/);
  const p = tail.match(/Peak:\s+(-?[0-9.]+|-inf) dBFS/);
  return { lufs: i ? Number(i[1]) : null, true_peak: p ? Number(p[1]) : null };
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

const ACTING_TAGS = /\[(happy|sad|excited|nervous|warm|whisper|whispers|dramatic|angry|calm|serious|laughs|pause)\]/i;
const EXPRESSIVE_TAGS = ["laugh", "chuckle", "gasp", "sigh", "groan", "cough", "clear throat", "sniff", "shush"];

// Read a podcast script. Lines:
//   ## Section title      a show-notes section (not spoken, removed for Vois Studio)
//   [Name]: text          one line for one speaker
//   [pause=800]           a pause of 300-3000 ms on its own line
// Returns { voisText, speakers, sections, segments, errors, warnings, words }.
export function parseScript(text) {
  const errors = [];
  const warnings = [];
  const out = [];
  const sections = [];
  const segments = [];
  const speakers = new Map();
  let words = 0;
  text.replace(/\r\n?/g, "\n").split("\n").forEach((raw, i) => {
    const line = raw.trim();
    const n = i + 1;
    if (!line) return;
    const sec = line.match(/^#{2,3}\s+(.+)$/);
    if (sec) {
      sections.push({ title: sec[1].trim(), segment_index: segments.length });
      return;
    }
    const pause = line.match(/^\[pause=(\d+)\]$/);
    if (pause) {
      const ms = Number(pause[1]);
      if (ms < 300 || ms > 3000) errors.push(`line ${n}: pause ${ms} ms is outside 300-3000`);
      segments.push({ type: "pause", ms });
      out.push(line);
      return;
    }
    const m = line.match(/^\[([^\]=]+)\]:\s*(.+)$/);
    if (!m) {
      errors.push(`line ${n}: not "[Name]: text", "[pause=NNN]" or "## Section": ${line.slice(0, 60)}`);
      return;
    }
    const [, name, body] = m;
    if (/\[[^\]]+\]:/.test(body)) errors.push(`line ${n}: two speakers on one line. Put each speaker on its own line.`);
    if (ACTING_TAGS.test(body)) errors.push(`line ${n}: acting tags such as [happy] are not read as direction. Put the emotion in the words.`);
    for (const t of body.matchAll(/\[([^\]]+)\]/g)) {
      if (EXPRESSIVE_TAGS.includes(t[1].toLowerCase())) warnings.push(`line ${n}: [${t[1]}] works only with the Expressive engine; other engines remove it.`);
      else if (/^pause=\d+$/.test(t[1])) errors.push(`line ${n}: put [${t[1]}] on its own line, so that the section times stay correct.`);
      else if (!ACTING_TAGS.test(t[0])) errors.push(`line ${n}: unknown tag [${t[1]}]`);
    }
    const w = body.replace(/\[[^\]]+\]/g, "").trim().split(/\s+/).length;
    words += w;
    speakers.set(name.trim(), (speakers.get(name.trim()) || 0) + w);
    segments.push({ type: "speech", speaker: name.trim() });
    out.push(`[${name.trim()}]: ${body.trim()}`);
  });
  return { voisText: out.join("\n") + "\n", speakers, sections, segments, errors, warnings, words };
}

export function hms(seconds) {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
