#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 vois-so
//
// wav-info.mjs: print the duration, sample rate, channels and bit depth of WAV files.
// Node.js 18+, no dependencies, works on macOS, Windows and Linux.
//
// Usage:
//   node wav-info.mjs [--min SECONDS] [--json] FILE.wav [FILE.wav ...]
//
// Exit status: 0 if every file is a readable WAV with a duration of at least --min
// seconds (default: more than 0), 1 if one or more files fail, 2 for a usage error.

import { openSync, readSync, closeSync, statSync } from "node:fs";

function usage(message) {
  if (message) console.error(`wav-info: ${message}`);
  console.error("Usage: node wav-info.mjs [--min SECONDS] [--json] FILE.wav [FILE.wav ...]");
  process.exit(2);
}

function readBytes(fd, position, length) {
  const buf = Buffer.alloc(length);
  const n = readSync(fd, buf, 0, length, position);
  return buf.subarray(0, n);
}

function inspect(file) {
  let size;
  try {
    size = statSync(file).size;
  } catch {
    return { file, ok: false, error: "file not found" };
  }
  const fd = openSync(file, "r");
  try {
    const head = readBytes(fd, 0, 12);
    if (head.length < 12 || head.toString("ascii", 0, 4) !== "RIFF" || head.toString("ascii", 8, 12) !== "WAVE") {
      return { file, ok: false, error: "not a RIFF/WAVE file" };
    }
    let pos = 12;
    let fmt = null;
    let dataBytes = null;
    while (pos + 8 <= size) {
      const hdr = readBytes(fd, pos, 8);
      if (hdr.length < 8) break;
      const id = hdr.toString("ascii", 0, 4);
      let len = hdr.readUInt32LE(4);
      if (id === "fmt ") {
        const b = readBytes(fd, pos + 8, Math.min(len, 40));
        fmt = {
          format: b.readUInt16LE(0),
          channels: b.readUInt16LE(2),
          sampleRate: b.readUInt32LE(4),
          byteRate: b.readUInt32LE(8),
          bitsPerSample: b.readUInt16LE(14),
        };
      } else if (id === "data") {
        // A streamed WAV can carry 0 or 0xFFFFFFFF here: use the rest of the file.
        const rest = size - (pos + 8);
        dataBytes = len === 0 || len === 0xffffffff || len > rest ? rest : len;
        break;
      }
      pos += 8 + len + (len % 2);
    }
    if (!fmt) return { file, ok: false, error: "no fmt chunk" };
    if (dataBytes === null) return { file, ok: false, error: "no data chunk" };
    if (!fmt.byteRate) return { file, ok: false, error: "byte rate is 0" };
    const duration = dataBytes / fmt.byteRate;
    return {
      file,
      ok: true,
      duration_secs: Math.round(duration * 1000) / 1000,
      sample_rate: fmt.sampleRate,
      channels: fmt.channels,
      bits_per_sample: fmt.bitsPerSample,
      bytes: size,
    };
  } finally {
    closeSync(fd);
  }
}

const args = process.argv.slice(2);
let min = 0;
let json = false;
const files = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--min") {
    min = Number(args[++i]);
    if (!Number.isFinite(min) || min < 0) usage("--min takes a number of seconds");
  } else if (a === "--json") {
    json = true;
  } else if (a === "-h" || a === "--help") {
    usage();
  } else if (a.startsWith("--")) {
    usage(`unknown option ${a}`);
  } else {
    files.push(a);
  }
}
if (files.length === 0) usage("give one or more WAV files");

let failed = 0;
const results = files.map((f) => {
  const r = inspect(f);
  const longEnough = min > 0 ? r.duration_secs >= min : r.duration_secs > 0;
  if (r.ok && !longEnough) {
    r.ok = false;
    r.error = min > 0 ? `duration ${r.duration_secs} s is less than ${min} s` : "duration is 0 s";
  }
  if (!r.ok) failed++;
  return r;
});

if (json) {
  console.log(JSON.stringify(results, null, 2));
} else {
  for (const r of results) {
    if (r.ok) {
      console.log(`OK    ${r.duration_secs.toFixed(3)} s  ${r.sample_rate} Hz  ${r.channels} ch  ${r.bits_per_sample} bit  ${r.file}`);
    } else {
      console.log(`FAIL  ${r.error}  ${r.file}`);
    }
  }
}
process.exit(failed ? 1 : 0);
