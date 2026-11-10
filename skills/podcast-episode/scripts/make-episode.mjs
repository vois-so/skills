#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 vois-so
//
// Make one two-host podcast episode with Vois Studio, from an episode file.
//
// Usage:
//   node make-episode.mjs <episode.json>
//
// episode.json:
//   {
//     "show": "Small Workshop",            project name in Vois Studio
//     "title": "Fix a squeaky door",       script title in Vois Studio
//     "language": "English",
//     "hosts": { "Maya": "<voice-id>", "Theo": "<voice-id>" },
//     "script": "script.txt",              [Name]: text lines, ## sections, [pause=NNN]
//     "profile": "spotify_podcasts",       or apple_podcasts (AAC .m4a)
//     "intro_music": "", "outro_music": "",  optional audio files that you have the rights to
//     "out_dir": "out"
//   }
//
// It writes <out_dir>/receipt.json with the project, script and speaker IDs.
// Run it again after you change the script: it updates the same script.
// Steps: check the script, find or make the project, make or update the
// script and speakers, generate, compile, add music, export with the profile,
// measure, and write section times.

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { dirname, join, resolve, extname } from "node:path";
import { vois, voisOk, run, probe, loudness, parseScript, fail, hms } from "./lib.mjs";

const cfgPath = process.argv[2] && resolve(process.argv[2]);
if (!cfgPath) fail("Usage: node make-episode.mjs <episode.json>", 3);
const base = dirname(cfgPath);
const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
const outDir = resolve(base, cfg.out_dir || "out");
mkdirSync(outDir, { recursive: true });
const receiptPath = join(outDir, "receipt.json");
const receipt = existsSync(receiptPath) ? JSON.parse(readFileSync(receiptPath, "utf8")) : {};

// 1. Check the script.
const scriptFile = resolve(base, cfg.script || "script.txt");
const parsed = parseScript(readFileSync(scriptFile, "utf8"));
const hosts = Object.keys(cfg.hosts || {});
for (const name of parsed.speakers.keys()) if (!hosts.includes(name)) parsed.errors.push(`speaker "${name}" has no voice in "hosts"`);
for (const [h, v] of Object.entries(cfg.hosts || {})) if (!v) parsed.errors.push(`host "${h}" has no voice ID`);
if (parsed.errors.length) fail(`The script has errors:\n${parsed.errors.join("\n")}\nCorrect them, or check with: node lint-script.mjs ${scriptFile}`);
const voisScript = join(outDir, "script.vois.txt");
writeFileSync(voisScript, parsed.voisText);

// 2. Make sure that Vois Studio is ready.
const status = voisOk(["status"], "status").json;
if (status.next_action !== "ready") fail(`Vois Studio is not ready: next_action=${status.next_action}. ${status.message || ""} Purchase page: ${status.purchase_url || "https://vois.so/pricing"}`, 7);

// 3. Find or make the project.
if (!receipt.project_id) {
  const list = voisOk(["project", "list"], "project list").json || [];
  const found = list.find((p) => p.name === cfg.show);
  if (found) {
    receipt.project_id = found.id;
    receipt.project_created = false;
  } else {
    receipt.project_id = voisOk(["project", "create", "--name", cfg.show, "--description", "Podcast episodes"], "project create").json.id;
    receipt.project_created = true;
  }
}

// 4. Make or update the script.
const exists = receipt.script_id && vois(["script", "get", "--id", String(receipt.script_id)]).code === 0;
if (exists) {
  voisOk(["script", "update", "--id", String(receipt.script_id), "--title", cfg.title, "--content-file", voisScript], "script update");
} else {
  receipt.script_id = voisOk(["script", "create", "--project", String(receipt.project_id), "--title", cfg.title, "--content-file", voisScript], "script create").json.id;
}
const sid = String(receipt.script_id);

// 5. One speaker for each host that the script text names, with its voice.
// The script text is saved first: Vois Studio 2.6.3 and after refuses a
// speaker that the text does not name (data.reason "speaker_not_in_script").
const current = voisOk(["speaker", "list", "--script", sid], "speaker list").json || [];
receipt.speakers = {};
for (const [name, voice] of Object.entries(cfg.hosts)) {
  if (!parsed.speakers.has(name)) continue;
  const sp = current.find((x) => x.name === name);
  if (!sp) receipt.speakers[name] = voisOk(["speaker", "create", "--script", sid, "--name", name, "--voice", voice], `speaker create ${name}`).json.id;
  else {
    if (sp.voice_id !== voice) voisOk(["speaker", "update", "--id", String(sp.id), "--voice", voice], `speaker update ${name}`);
    receipt.speakers[name] = sp.id;
  }
}
writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + "\n");

// 6. Generate all lines with the engine that is selected in Vois Studio.
console.log(`Generating script ${sid} (${parsed.segments.length} segments)...`);
const gen = voisOk(["script", "generate", "--id", sid, "--language", cfg.language || "English"], "script generate").json;
const engines = [...new Set(gen.segments.filter((s) => s.type === "speech").map((s) => s.engine_used))];
receipt.engine_used = engines;
if (gen.skipped_locked?.length || gen.skipped_unspoken?.length) console.log(`WARNING skipped segments: locked ${JSON.stringify(gen.skipped_locked)}, unspoken ${JSON.stringify(gen.skipped_unspoken)}`);
console.log(`Generated ${gen.segment_count} segments, ${gen.total_duration_secs.toFixed(1)} s, engine ${engines.join(", ")}`);

// 7. Compile the lines into one WAV (48 kHz stereo). Quiet output gives the full path.
const compiledPath = voisOk(["export", "compile-script", "--script", sid], "export compile-script", { format: "quiet" }).stdout.trim();
if (!compiledPath || !existsSync(compiledPath)) fail(`compile-script did not give a file path: "${compiledPath}"`);
receipt.compiled_app_path = compiledPath;
const compiled = join(outDir, "compiled.wav");
copyFileSync(compiledPath, compiled);

// 8. Optional intro and outro music around the voices.
let master = compiled;
let offset = 0;
const intro = cfg.intro_music ? resolve(base, cfg.intro_music) : "";
const outro = cfg.outro_music ? resolve(base, cfg.outro_music) : "";
if (intro || outro) {
  const inputs = [intro, compiled, outro].filter(Boolean);
  if (intro) offset = Number(probe(intro).format.duration);
  const ff = ["-y", "-v", "error"];
  for (const f of inputs) ff.push("-i", f);
  const pre = inputs.map((_, i) => `[${i}:a]aresample=48000,aformat=channel_layouts=stereo[a${i}]`).join(";");
  ff.push("-filter_complex", `${pre};${inputs.map((_, i) => `[a${i}]`).join("")}concat=n=${inputs.length}:v=0:a=1[out]`, "-map", "[out]", "-c:a", "pcm_s16le");
  master = join(outDir, "mix.wav");
  ff.push(master);
  const r = run("ffmpeg", ff);
  if (r.code !== 0) fail(`ffmpeg could not add the music: ${r.stderr}`);
}

// 9. Export with the platform profile (it masters to the profile loudness).
const profileId = cfg.profile || "spotify_podcasts";
const profile = voisOk(["export", "profile", "--id", profileId], "export profile").json;
const ext = { mp3: ".mp3", aac: ".m4a", m4a: ".m4a", wav: ".wav", flac: ".flac" }[profile.format] || `.${profile.format}`;
const episodeFile = join(outDir, `episode${ext}`);
const exp = voisOk(["export", "with-profile", "--input", master, "--output", episodeFile, "--profile", profileId], "export with-profile").json;

// 10. Measure the file.
const info = probe(episodeFile);
const a = info.streams.find((s) => s.codec_type === "audio");
const lv = loudness(episodeFile);
const duration = Number(info.format.duration);
receipt.episode = {
  file: episodeFile,
  mime: { ".mp3": "audio/mpeg", ".m4a": "audio/x-m4a", ".wav": "audio/wav", ".flac": "audio/flac" }[extname(episodeFile)] || "application/octet-stream",
  bytes: statSync(episodeFile).size,
  duration_s: +duration.toFixed(2),
  codec: a.codec_name,
  sample_rate: Number(a.sample_rate),
  channels: a.channels,
  bit_rate: Number(a.bit_rate || info.format.bit_rate),
  lufs: lv.lufs,
  true_peak_db: lv.true_peak,
  target_lufs: exp.target_lufs ?? profile.target_lufs,
};
const e = receipt.episode;
const problems = [];
if (e.lufs === null || Math.abs(e.lufs - e.target_lufs) > 1.0) problems.push(`loudness ${e.lufs} LUFS, target ${e.target_lufs}`);
if (e.true_peak_db !== null && e.true_peak_db > -1.0) problems.push(`true peak ${e.true_peak_db} dBTP is above -1`);

// 11. Section times for the show notes (from the generated segment lengths).
const segs = gen.segments;
const chapters = [];
if (segs.length === parsed.segments.length) {
  const starts = [];
  let t = offset;
  for (const s of segs) {
    starts.push(t);
    t += (s.duration_ms || 0) / 1000;
  }
  for (const sec of parsed.sections) chapters.push({ start_s: +(starts[sec.segment_index] ?? t).toFixed(2), start: hms(starts[sec.segment_index] ?? t), title: sec.title });
} else console.log(`WARNING the result has ${segs.length} segments, the script has ${parsed.segments.length}; no section times.`);
writeFileSync(join(outDir, "chapters.json"), JSON.stringify(chapters, null, 2) + "\n");
receipt.problems = problems;
writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + "\n");

console.log(`Episode: ${episodeFile}`);
console.log(`  ${e.codec}, ${e.sample_rate} Hz, ${e.channels} ch, ${Math.round(e.bit_rate / 1000)} kbps, ${hms(duration)} (${e.duration_s} s), ${e.bytes} bytes`);
console.log(`  loudness ${e.lufs} LUFS (target ${e.target_lufs}), true peak ${e.true_peak_db} dBTP`);
for (const c of chapters) console.log(`  ${c.start}  ${c.title}`);
for (const p of problems) console.log(`  FAIL ${p}`);
console.log(problems.length ? "Episode check: FAIL" : "Episode check: PASS");
console.log(`Receipt: ${receiptPath}`);
process.exit(problems.length ? 1 : 0);
