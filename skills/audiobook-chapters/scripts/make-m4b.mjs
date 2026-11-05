#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 vois-so
//
// Join the chapter MP3s that Vois Studio exported into one M4B audiobook with
// a chapter mark at the start of each chapter, then read the marks back with
// ffprobe.
//
// Usage:
//   node make-m4b.mjs <workdir> [--out book.m4b] [--cover cover.jpg]
//        [--bitrate 64k]
//
// It reads <workdir>/plan.json for the book title, author and chapter titles,
// and <workdir>/mp3/<id> - <title>.mp3 for the audio.

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { run, probe, fail, parseArgs } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
const workdir = args._[0] && resolve(args._[0]);
if (!workdir) fail("Usage: node make-m4b.mjs <workdir> [--out book.m4b] [--cover cover.jpg] [--bitrate 64k]", 3);
const plan = JSON.parse(readFileSync(join(workdir, "plan.json"), "utf8"));
const mp3Dir = join(workdir, "mp3");
const files = existsSync(mp3Dir) ? readdirSync(mp3Dir).filter((f) => f.endsWith(".mp3")) : [];

const chapters = plan.chapters.map((ch) => {
  const f = files.find((x) => x.startsWith(`${ch.id} - `));
  if (!f) fail(`No MP3 for chapter ${ch.id}. Run render-chapters.mjs first.`);
  const info = probe(join(mp3Dir, f));
  const a = info.streams.find((s) => s.codec_type === "audio");
  return { ...ch, file: join(mp3Dir, f), duration: Number(info.format.duration), channels: a.channels };
});

const esc = (s) => String(s).replace(/([=;#\\\n])/g, "\\$1");
let meta = ";FFMETADATA1\n";
meta += `title=${esc(plan.title)}\nalbum=${esc(plan.title)}\n`;
if (plan.author) meta += `artist=${esc(plan.author)}\nalbum_artist=${esc(plan.author)}\n`;
meta += "genre=Audiobook\n";
let t = 0;
for (const ch of chapters) {
  const start = Math.round(t * 1000);
  t += ch.duration;
  meta += `\n[CHAPTER]\nTIMEBASE=1/1000\nSTART=${start}\nEND=${Math.round(t * 1000)}\ntitle=${esc(ch.title)}\n`;
}
const metaFile = join(workdir, "m4b-chapters.txt");
writeFileSync(metaFile, meta);
const listFile = join(workdir, "m4b-files.txt");
writeFileSync(listFile, chapters.map((c) => `file '${c.file.replace(/'/g, "'\\''")}'`).join("\n") + "\n");

const out = resolve(args.out || join(workdir, `${plan.title.replace(/[\\/:*?"<>|]+/g, "").trim() || "book"}.m4b`));
const channels = Math.max(...chapters.map((c) => c.channels));
const bitrate = args.bitrate || (channels > 1 ? "128k" : "64k");
const ff = ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", listFile, "-f", "ffmetadata", "-i", metaFile];
if (args.cover) ff.push("-i", resolve(args.cover));
ff.push("-map", "0:a", "-map_metadata", "1", "-map_chapters", "1");
if (args.cover) ff.push("-map", "2:v", "-c:v", "copy", "-disposition:v:0", "attached_pic");
ff.push("-c:a", "aac", "-b:a", bitrate, "-ar", "44100", "-movflags", "+faststart", "-f", "mp4", out);
const r = run("ffmpeg", ff);
if (r.code !== 0) fail(`ffmpeg could not make the M4B: ${r.stderr}`);

// Read the marks back and compare them with the plan.
const info = probe(out);
const got = info.chapters || [];
let ok = got.length === chapters.length;
console.log(`M4B: ${out}`);
console.log(`Duration ${Number(info.format.duration).toFixed(2)} s, ${got.length} chapter marks (expected ${chapters.length})`);
got.forEach((c, i) => {
  const title = c.tags?.title;
  const exp = chapters[i];
  const match = exp && title === exp.title;
  if (!match) ok = false;
  console.log(`  ${String(i + 1).padStart(2, "0")}  ${Number(c.start_time).toFixed(2)}-${Number(c.end_time).toFixed(2)} s  ${title}${match ? "" : "  (title does not match the plan)"}`);
});
console.log(ok ? "M4B check: PASS" : "M4B check: FAIL");
process.exit(ok ? 0 : 1);
