// vois-voice.mjs: shared helpers for the Vois Studio skill scripts.
// Renders lines with vois-cli, reads and writes 16-bit PCM WAV files, finds the
// pauses in a take, joins clips with exact gaps, and writes SRT captions.
// Node.js 18+. No npm dependencies.
//
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Vois Studio. Released under the MIT License:
// https://opensource.org/license/mit

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export class VoisError extends Error {
  constructor(message, code = 1) {
    super(message);
    this.code = code;
  }
}

export const log = (...parts) => process.stderr.write(parts.join(' ') + '\n');

// ---------------------------------------------------------------- arguments

// --key value, --key=value and --flag. Values stay strings.
export function parseArgs(argv, flags = []) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { out._.push(a); continue; }
    const eq = a.indexOf('=');
    const key = a.slice(2, eq < 0 ? undefined : eq);
    if (eq >= 0) out[key] = a.slice(eq + 1);
    else if (flags.includes(key) || i + 1 >= argv.length || argv[i + 1].startsWith('--')) out[key] = true;
    else out[key] = argv[++i];
  }
  return out;
}

export const num = (v, fallback) => (v === undefined || v === null || v === '' ? fallback : Number(v));

// ---------------------------------------------------------------- vois-cli

// The CLI ships inside Vois Studio. --cli or VOIS_CLI can name another path.
export function findCli(explicit) {
  const tried = [];
  if (explicit) tried.push(explicit);
  if (process.env.VOIS_CLI) tried.push(process.env.VOIS_CLI);
  if (process.platform === 'darwin') {
    tried.push('/Applications/Vois.app/Contents/MacOS/vois-cli');
    tried.push(join(homedir(), 'Applications/Vois.app/Contents/MacOS/vois-cli'));
  } else if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local');
    tried.push(join(local, 'Vois', 'vois-cli.exe'));
  }
  const found = tried.find((p) => existsSync(p));
  if (!found) {
    throw new VoisError(`vois-cli was not found (looked in: ${tried.join(', ') || 'nothing for this platform'}). `
      + 'Install Vois Studio from https://vois.so, or pass --cli <path to vois-cli>.', 2);
  }
  return found;
}

// What to do for each vois-cli exit code.
export const ADVICE = {
  1: 'General error. Read the message. If Vois Studio restarted, run the command again.',
  2: 'Vois Studio is not running. Open Vois Studio, or start the headless service with: vois-cli service start',
  3: 'Invalid arguments. Check the voice ID, engine, language and speed (0.5 to 2.0).',
  4: 'Not found. Check the voice ID with: vois-cli voice list --source all --format json',
  5: 'Generation failed. A near-silent take also exits 5: make the line longer, remove symbols, or pick another voice.',
  6: 'Export failed. Check that the output folder exists and that you can write to it.',
  7: 'This plan does not include this. CLI files need Pro (or Subscriber, AppSumo Lifetime Tier 2 or 3), or export credits on Free. '
    + 'Omni, Craft and Voice Design need Pro. Show the purchase_url from "vois-cli status --format json" to the user.',
  8: 'Quota exceeded. Show the purchase_url from "vois-cli status --format json" to the user.',
  9: 'Vois Studio did not answer in time. Check that it responds, then run the command again.',
  10: 'The Sonic queue is full. Wait a few seconds, then run the command again.',
  11: 'Not enough free memory for this engine. Close other apps, or pick Fast or Expressive.',
  12: 'The model download failed. Check the internet connection, then: vois-cli model download --model <engine>',
  13: 'The model package is not available to download yet. Pick another engine.',
  64: 'Usage error, or the language is not clear. Pass --language (for example English).',
  130: 'Cancelled.',
};

export function runCli(cli, args, input) {
  const r = spawnSync(cli, [...args, '--format', 'json'], {
    input: input ?? '',
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    timeout: 20 * 60 * 1000,
    windowsHide: true,
  });
  if (r.error) throw new VoisError(`Could not start vois-cli: ${r.error.message}`, 1);
  const parse = (s) => { try { return JSON.parse(s); } catch { return null; } };
  const json = parse(r.stdout);
  const errDoc = r.status === 0 ? null : parse(r.stderr) || parse(r.stdout);
  const message = errDoc?.error?.message || (r.stderr || r.stdout || '').trim().split('\n').slice(-3).join(' ');
  return { code: r.status, json, error: errDoc?.error ?? null, message };
}

// Checks that Vois Studio answers and that this plan can write files from the CLI.
export function preflight(cli) {
  const r = runCli(cli, ['status']);
  if (r.code !== 0) throw new VoisError(`vois-cli status failed (exit ${r.code}). ${ADVICE[r.code] || r.message}`, r.code);
  const s = r.json || {};
  if (!s.cli_access_enabled || s.license_valid === false) {
    throw new VoisError(`This Vois Studio plan cannot write audio files from the CLI (next_action: ${s.next_action}). `
      + `Plans with CLI files: Pro, Subscriber, AppSumo Lifetime Tier 2 or 3, or export credits on Free. `
      + `Show this link to the user: ${s.purchase_url || 'https://vois.so/pricing'}`, 7);
  }
  s.metered = s.access_mode !== 'subscription';
  return s;
}

// On export credits, each written file uses one credit. Stop unless the user agreed.
export function creditGate(status, files, agreed) {
  if (!status.metered || files === 0) return;
  const msg = `This run writes ${files} file(s). On export credits each file uses one credit `
    + `(balance: ${status.credit_balance}). Retakes use more. Free is for non-commercial use only.`;
  if (!agreed) throw new VoisError(`${msg} Ask the user, then run again with --use-credits.`, 7);
  log(msg);
}

// Renders one line to a WAV file. Retries only the errors that a retry can fix.
export function renderLine(cli, o) {
  const args = ['tts', 'generate', '--text', '-', '--output', o.out];
  if (o.voice) args.push('--voice', o.voice);
  if (o.engine) args.push('--engine', o.engine);
  if (o.language) args.push('--language', o.language);
  if (o.speed && Number(o.speed) !== 1) args.push('--speed', String(o.speed));
  if (o.instruct) args.push('--instruct', o.instruct);
  if (o.seed !== undefined && o.seed !== null) args.push('--seed', String(o.seed));
  mkdirSync(dirname(o.out), { recursive: true });
  for (let attempt = 1; ; attempt++) {
    const r = runCli(cli, args, o.text);
    if (r.code === 0) return r.json || {};
    const retry = (r.code === 10 && attempt <= 5) || (r.code === 9 && attempt <= 2)
      || (r.code === 1 && attempt <= 2 && /restart|retry|connect/i.test(r.message));
    if (!retry) {
      const why = r.error?.data?.reason ? ` (${r.error.data.reason})` : '';
      throw new VoisError(`vois-cli tts generate failed with exit ${r.code}${why}: ${r.message}\n  What to do: ${ADVICE[r.code] || 'Read the message above.'}`, r.code);
    }
    log(`  exit ${r.code}, trying again (${attempt})`);
    sleep(r.code === 10 ? 3000 : 1500);
  }
}

export function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export const fingerprint = (obj) => createHash('sha256').update(JSON.stringify(obj)).digest('hex').slice(0, 16);

// Directions act only on Omni and Craft. Other engines ignore them.
export const takesDirection = (engine) => engine === 'omni' || engine === 'craft';

// ---------------------------------------------------------------- WAV files

export function readWav(file) {
  const buf = readFileSync(file);
  if (buf.length < 12 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new VoisError(`${file} is not a WAV file.`, 6);
  }
  let off = 12;
  let fmt = null;
  let data = null;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    let size = buf.readUInt32LE(off + 4);
    const body = off + 8;
    if (id === 'fmt ') {
      fmt = {
        format: buf.readUInt16LE(body),
        channels: buf.readUInt16LE(body + 2),
        sampleRate: buf.readUInt32LE(body + 4),
        bits: buf.readUInt16LE(body + 14),
      };
      if (fmt.format === 0xfffe && size >= 26) fmt.format = buf.readUInt16LE(body + 24);
    } else if (id === 'data') {
      if (body + size > buf.length) size = buf.length - body;
      data = buf.subarray(body, body + size);
      break;
    }
    off = body + size + (size & 1);
  }
  if (!fmt || !data) throw new VoisError(`${file}: no fmt or data chunk.`, 6);
  const pcm16 = fmt.format === 1 && fmt.bits === 16;
  const f32 = fmt.format === 3 && fmt.bits === 32;
  if (!pcm16 && !f32) throw new VoisError(`${file}: only 16-bit PCM or 32-bit float WAV is supported.`, 6);
  const bytes = fmt.bits / 8;
  const frames = Math.floor(data.length / (bytes * fmt.channels));
  const samples = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (let c = 0; c < fmt.channels; c++) {
      const p = (i * fmt.channels + c) * bytes;
      sum += pcm16 ? data.readInt16LE(p) / 32768 : data.readFloatLE(p);
    }
    samples[i] = sum / fmt.channels;
  }
  return { file, sampleRate: fmt.sampleRate, channels: fmt.channels, frames, duration: frames / fmt.sampleRate, samples };
}

// Writes mono 16-bit PCM.
export function writeWav(file, samples, sampleRate) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(v < 0 ? v * 32768 : v * 32767), 44 + i * 2);
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, buf);
}

// Joins clips and silences on one timeline. parts: [{ wav } | { silence: seconds }].
// Every clip must have the same sample rate. Returns the start time of each part.
export function joinWavs(file, parts) {
  const rate = parts.find((p) => p.wav)?.wav.sampleRate;
  if (!rate) throw new VoisError('Nothing to join.', 3);
  let total = 0;
  const lengths = parts.map((p) => {
    if (p.wav && p.wav.sampleRate !== rate) {
      throw new VoisError(`${p.wav.file} has ${p.wav.sampleRate} Hz, the others ${rate} Hz. Resample it first (for example with ffmpeg).`, 6);
    }
    const n = p.wav ? p.wav.frames : Math.max(0, Math.round(p.silence * rate));
    total += n;
    return n;
  });
  const out = new Float32Array(total);
  const starts = [];
  let at = 0;
  parts.forEach((p, i) => {
    starts.push(at / rate);
    if (p.wav) out.set(p.wav.samples, at);
    at += lengths[i];
  });
  writeWav(file, out, rate);
  return { file, sampleRate: rate, duration: total / rate, starts };
}

// ---------------------------------------------------------------- speech analysis

// Finds where speech starts and ends, and the pauses inside it.
export function analyseSpeech(wav, opts = {}) {
  const frameMs = opts.frameMs ?? 10;
  const rangeDb = opts.rangeDb ?? 38;
  const floorDb = opts.floorDb ?? -55;
  const minPause = (opts.minPauseMs ?? 140) / 1000;
  const hop = Math.max(1, Math.round((wav.sampleRate * frameMs) / 1000));
  const db = [];
  for (let i = 0; i < wav.frames; i += hop) {
    let s = 0;
    const end = Math.min(wav.frames, i + hop);
    for (let j = i; j < end; j++) s += wav.samples[j] * wav.samples[j];
    db.push(10 * Math.log10(s / Math.max(1, end - i) + 1e-12));
  }
  const peak = db.length ? Math.max(...db) : -120;
  const threshold = Math.max(floorDb, peak - rangeDb);
  const voiced = db.map((v) => v > threshold);
  const first = voiced.indexOf(true);
  const last = voiced.lastIndexOf(true);
  const step = hop / wav.sampleRate;
  if (first < 0) return { silent: true, start: 0, end: 0, speech: 0, pauses: [], peakDb: peak, length: wav.duration };
  const pauses = [];
  let runStart = -1;
  for (let i = first; i <= last; i++) {
    if (!voiced[i] && runStart < 0) runStart = i;
    if (voiced[i] && runStart >= 0) {
      if ((i - runStart) * step >= minPause) pauses.push({ start: runStart * step, end: i * step });
      runStart = -1;
    }
  }
  const start = first * step;
  const end = Math.min(wav.duration, (last + 1) * step);
  return { silent: false, start, end, speech: end - start, pauses, peakDb: peak, length: wav.duration };
}

// Words a second of speech. Typical narration is about 2.0 to 3.2.
export function speechRate(text, an) {
  return an.speech > 0 ? countWords(text) / an.speech : 0;
}

// A take is suspect when it is silent, or when its pace is far from normal speech.
export function takeProblem(text, an) {
  if (an.silent) return 'the take is silent';
  const rate = speechRate(text, an);
  if (countWords(text) >= 4 && (rate < 1.2 || rate > 4.8)) return `the pace is ${rate.toFixed(1)} words a second (expected about 2 to 3.5)`;
  return null;
}

// ---------------------------------------------------------------- text and captions

export const countWords = (text) => (text.trim().match(/\S+/g) || []).length;

export function splitSentences(text) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const parts = clean.match(/[^.!?…]+(?:[.!?…]+["'”’)\]]*|$)\s*/g) || [clean];
  return parts.map((s) => s.trim()).filter(Boolean);
}

// About how long a word takes to say, in syllables.
export function wordWeight(w) {
  const bare = w.toLowerCase().replace(/[^a-z0-9À-ɏ]/g, '');
  let syl = 0;
  if (/\d/.test(bare)) syl += bare.replace(/\D/g, '').length * 1.3;
  const letters = bare.replace(/\d/g, '');
  if (letters) {
    const groups = letters.match(/[aeiouyà-ÿ]+/g) || [];
    syl += Math.max(1, groups.length - (/[^aeiou]e$/.test(letters) && groups.length > 1 ? 1 : 0));
  }
  return Math.max(1, syl) + 0.35;
}

// Splits text into phrases: at sentence ends, and after a comma, colon, semicolon or dash.
export function splitPhrases(text) {
  return splitSentences(text).flatMap((s) => s.match(/[^,;:\u2013\u2014]+(?:[,;:\u2013\u2014]+|$)\s*/g).map((p) => p.trim()).filter(Boolean));
}

// Gives each phrase of a take a start and an end. Phrase ends snap to the pauses that
// the voice made, so caption cues change when the voice stops.
export function timePhrases(text, an, offset = 0) {
  const phrases = splitPhrases(text);
  if (!phrases.length) return [];
  const weights = phrases.map((s) => s.split(/\s+/).reduce((a, w) => a + wordWeight(w), 0));
  const total = weights.reduce((a, b) => a + b, 0);
  const span = an.end - an.start;
  const expected = [];
  let acc = 0;
  for (let i = 0; i < phrases.length - 1; i++) {
    acc += weights[i];
    expected.push(an.start + (span * acc) / total);
  }
  const match = matchPauses(expected, an.pauses, Math.max(0.6, span * 0.2));
  const out = [];
  let cursor = an.start;
  phrases.forEach((text, i) => {
    let end = an.end;
    let next = an.end;
    if (i < phrases.length - 1) {
      const p = match[i];
      if (p) { end = p.start; next = p.end; } else { end = Math.max(cursor, expected[i]); next = end; }
    }
    out.push({ text, start: offset + cursor, end: offset + Math.max(cursor, end) });
    cursor = Math.max(cursor, next);
  });
  return out;
}

// Pairs each expected phrase end with at most one pause, in order, so that the
// total distance is the smallest. A phrase end with no pause near it gets null.
function matchPauses(expected, pauses, maxDev) {
  const B = expected.length;
  const P = pauses.length;
  const mid = (p) => (p.start + p.end) / 2;
  const cost = Array.from({ length: B + 1 }, () => new Array(P + 1).fill(0));
  const pick = Array.from({ length: B + 1 }, () => new Array(P + 1).fill(0));
  for (let i = 1; i <= B; i++) {
    for (let j = 0; j <= P; j++) {
      let best = cost[i - 1][j] + maxDev;
      let how = 'miss';
      if (j > 0 && cost[i][j - 1] < best) { best = cost[i][j - 1]; how = 'skip'; }
      if (j > 0) {
        const d = Math.abs(mid(pauses[j - 1]) - expected[i - 1]);
        if (d <= maxDev && cost[i - 1][j - 1] + d < best) { best = cost[i - 1][j - 1] + d; how = 'match'; }
      }
      cost[i][j] = best;
      pick[i][j] = how;
    }
  }
  const out = new Array(B).fill(null);
  let i = B;
  let j = P;
  while (i > 0) {
    const how = pick[i][j];
    if (how === 'match') { out[i - 1] = pauses[j - 1]; i--; j--; } else if (how === 'skip') j--; else i--;
  }
  return out;
}

// Spreads the words of a phrase over its time span by syllable weight.
export function timeWords(sentence) {
  const ws = sentence.text.split(/\s+/).filter(Boolean);
  const weights = ws.map(wordWeight);
  const total = weights.reduce((a, b) => a + b, 0);
  const span = sentence.end - sentence.start;
  let t = sentence.start;
  return ws.map((w, i) => {
    const d = (span * weights[i]) / total;
    const word = { text: w, start: round3(t), end: round3(t + d) };
    t += d;
    return word;
  });
}

// Groups timed words into caption cues. A cue ends at a sentence end. A full cue
// breaks after its last comma when it can, so a clause stays on one cue.
export function buildCues(words, opts = {}) {
  const maxChars = opts.maxChars ?? 42;
  const maxLines = opts.maxLines ?? 2;
  const maxWords = opts.maxWords ?? Infinity;
  const minDur = opts.minDuration ?? 0.8;
  const clause = /[,;:\u2013\u2014]["'\u201d\u2019)\]]*$/;
  const cues = [];
  let cur = [];
  const emit = (ws) => { if (ws.length) cues.push({ start: ws[0].start, end: ws[ws.length - 1].end, words: ws }); };
  const fits = (ws) => ws.length <= maxWords && wrap(ws.map((x) => x.text).join(' '), maxChars).length <= maxLines;
  for (const w of words) {
    if (cur.length && !fits([...cur, w])) {
      let k = -1;
      for (let i = cur.length - 2; i >= 1; i--) if (clause.test(cur[i].text)) { k = i; break; }
      if (k >= 1 && fits(cur.slice(k + 1).concat(w))) { emit(cur.slice(0, k + 1)); cur = cur.slice(k + 1); } else { emit(cur); cur = []; }
    }
    cur.push(w);
    const len = cur.map((x) => x.text).join(' ').length;
    if (/[.!?\u2026]["'\u201d\u2019)\]]*$/.test(w.text) || (maxLines > 1 && clause.test(w.text) && len >= maxChars)) { emit(cur); cur = []; }
  }
  emit(cur);
  for (let i = 0; i < cues.length; i++) {
    const c = cues[i];
    c.text = wrap(c.words.map((x) => x.text).join(' '), maxChars).join('\n');
    const limit = i + 1 < cues.length ? cues[i + 1].start : Infinity;
    c.end = Math.min(limit, Math.max(c.end, c.start + minDur));
    delete c.words;
  }
  return cues;
}

export function wrap(text, maxChars) {
  const lines = [];
  let line = '';
  for (const w of text.split(' ')) {
    if (line && (line + ' ' + w).length > maxChars) { lines.push(line); line = w; } else line = line ? `${line} ${w}` : w;
  }
  if (line) lines.push(line);
  if (lines.length === 2) {
    // Balance two lines so the top line is not much longer than the bottom line.
    const all = text.split(' ');
    let best = lines;
    let bestDiff = Math.abs(lines[0].length - lines[1].length);
    for (let k = 1; k < all.length; k++) {
      const a = all.slice(0, k).join(' ');
      const b = all.slice(k).join(' ');
      if (a.length <= maxChars && b.length <= maxChars && Math.abs(a.length - b.length) < bestDiff) {
        best = [a, b];
        bestDiff = Math.abs(a.length - b.length);
      }
    }
    return best;
  }
  return lines;
}

export const round3 = (x) => Math.round(x * 1000) / 1000;

export function srtTime(t) {
  const ms = Math.max(0, Math.round(t * 1000));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const pad = (v, n = 2) => String(v).padStart(n, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms % 1000, 3)}`;
}

export function toSrt(cues) {
  return cues.map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}\n`).join('\n');
}

// ---------------------------------------------------------------- misc

export function readJson(file, fallback) {
  if (!existsSync(file)) return fallback;
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function writeJson(file, value) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

export const slug = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'line';

export function main(fn) {
  try {
    const code = fn();
    process.exitCode = code ?? 0;
  } catch (e) {
    if (e instanceof VoisError) {
      log(`\nERROR: ${e.message}`);
      process.exitCode = e.code || 1;
    } else {
      throw e;
    }
  }
}
