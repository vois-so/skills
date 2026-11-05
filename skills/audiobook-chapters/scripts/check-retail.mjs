#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 vois-so
//
// Check MP3 files against common retail audiobook numbers: MP3 44.1 kHz,
// 192 kbps CBR, RMS -23 to -18 dB, peak at or below -3 dB, noise floor at or
// below -60 dB, 0.5-1 s room tone at the start, 1-5 s at the end, 120 minutes
// or less, the same channel count in every file. Check the current rules of
// your retailer: they can change.
//
// Usage:
//   node check-retail.mjs <file.mp3> [more.mp3 ...] [--sample]
//
// --sample: a retail sample has no room tone rule, and must be 1-5 minutes.

import { checkRetail, fail, parseArgs } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2), ["sample"]);
if (!args._.length) fail("Usage: node check-retail.mjs <file.mp3> [more.mp3 ...] [--sample]", 3);

let failed = 0;
const channels = new Set();
for (const file of args._) {
  const qc = checkRetail(file);
  if (args.sample) {
    qc.problems = qc.problems.filter((p) => !p.startsWith("room tone"));
    if (qc.duration_s < 60 || qc.duration_s > 300) qc.problems.push(`sample is ${qc.duration_s} s; retail samples are usually 1-5 minutes`);
    qc.result = qc.problems.length ? "FAIL" : "PASS";
  }
  channels.add(qc.channels);
  if (qc.result !== "PASS") failed++;
  console.log(`${qc.result}  ${file}`);
  console.log(`  RMS ${qc.rms_db} dB, peak ${qc.peak_db} dB, noise floor ${qc.noise_floor_db ?? "n/a"} dB, start ${qc.head_s} s, end ${qc.tail_s} s`);
  console.log(`  ${qc.codec}, ${qc.sample_rate} Hz, ${qc.channels} ch, ${qc.bit_rate / 1000} kbps${qc.cbr ? " CBR" : " VBR"}, ${qc.duration_s} s`);
  for (const p of qc.problems) console.log(`  - ${p}`);
}
if (channels.size > 1) {
  console.log("FAIL: the files do not all have the same channel count.");
  failed++;
}
process.exit(failed ? 1 : 0);
