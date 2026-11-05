#!/usr/bin/env node
// short.mjs: voice and captions for a 30-60 second vertical Short, made with Vois Studio.
// Checks the script (110-160 words, a short hook), renders each line, removes the silence
// at the ends of each take, joins the lines with short gaps, and checks that the hook
// ends in the first 2 seconds and that the Short is 30-60 seconds long.
//
//   node short.mjs --script short.json [--out short] [--voice ID] [--engine expressive]
//        [--language English] [--speed 1] [--gap 0.25] [--caption-words 3]
//        [--master youtube_video] [--draft] [--tries 2] [--only a,b] [--force]
//        [--use-credits] [--cli PATH]
//
// Output (in --out):
//   lines/01-hook.wav    one take for each line (24 kHz mono)
//   short.wav            the voice track, tight, from time 0
//   short.srt            captions of 1-3 words, for the editor
//   short.words.json     word times, for animated captions
//   report.json          word count, hook end, length and the result of each check
//
// Exit 0: all checks pass. Exit 65: a check failed; the files are written.
//
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Vois Studio. Released under the MIT License:
// https://opensource.org/license/mit

import { existsSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  ADVICE, VoisError, analyseSpeech, countWords, creditGate, findCli, fingerprint, joinWavs, log, main,
  num, parseArgs, preflight, readJson, readWav, renderLine, round3, runCli, takeProblem, takesDirection,
  timePhrases, timeWords, toSrt, writeJson,
} from './vois-voice.mjs';

const HELP = `Usage: node short.mjs --script short.json [options]
  --out DIR            output folder (default: short)
  --voice ID           voice ID from: vois-cli voice list --source all --format json
  --engine ID          fast | expressive | multilingual | omni | sonic | craft (default: expressive)
  --language NAME      for example English (default: English)
  --speed N            0.5 to 2.0 (default: 1)
  --gap S              silence between lines (default: 0.25)
  --caption-words N    words in each caption cue (default: 3)
  --master PROFILE     also export short.wav with a Vois Studio export profile, for example youtube_video
  --draft              do not stop for the 110-160 word and 30-60 second checks
  --tries N            takes to try when a take looks wrong (default: 2)
  --only a,b           render only these line ids
  --force              render again even when nothing changed
  --use-credits        allow a run that uses export credits (Free plan)
  --cli PATH           path to vois-cli`;

// Short caption cues: each phrase is cut into groups of about the same size, so that a
// cue never holds one orphan word at the end of a sentence.
function shortCues(words, maxWords, maxChars) {
  const phrases = [];
  let cur = [];
  for (const w of words) {
    cur.push(w);
    if (/[,.!?;:\u2026\u2013\u2014]["'\u201d\u2019)\]]*$/.test(w.text)) { phrases.push(cur); cur = []; }
  }
  if (cur.length) phrases.push(cur);
  const cues = [];
  for (const ph of phrases) {
    let k = Math.ceil(ph.length / maxWords);
    const groups = () => Array.from({ length: k }, (_, i) => ph.slice(Math.round((i * ph.length) / k), Math.round(((i + 1) * ph.length) / k)));
    let g = groups();
    while (k < ph.length && g.some((x) => x.map((w) => w.text).join(' ').length > maxChars)) { k++; g = groups(); }
    for (const x of g) cues.push({ start: x[0].start, end: x[x.length - 1].end, text: x.map((w) => w.text).join(' ') });
  }
  cues.forEach((c, i) => { if (i + 1 < cues.length) c.end = Math.min(cues[i + 1].start, Math.max(c.end, c.start + 0.3)); });
  return cues;
}

// Words that promise views, followers or money. The skill does not write them.
const PROMISE = /\b(go(?:es|ing)? viral|guaranteed?|million views|views guaranteed|get rich|passive income|make \$?\d+[k]?|earn \$?\d+|\$\d+[k]? (?:a|per) (?:day|week|month))\b/i;

main(() => {
  const a = parseArgs(process.argv.slice(2), ['force', 'draft', 'use-credits', 'help']);
  if (a.help || !a.script) { log(HELP); return a.help ? 0 : 64; }

  const doc = readJson(resolve(a.script));
  if (doc === undefined) throw new VoisError(`Script file not found: ${a.script}`, 4);
  const list = Array.isArray(doc) ? doc : doc.lines;
  const top = Array.isArray(doc) ? {} : doc;
  if (!Array.isArray(list) || !list.length) throw new VoisError('The script has no lines. Give "lines": [{ "id", "text" }].', 3);

  const pick = (k, d) => a[k] ?? top[k] ?? d;
  const out = resolve(pick('out', 'short'));
  const gap = num(pick('gap'), 0.25);
  const capWords = Math.max(1, num(pick('caption-words', top.captionWords), 3));
  const base = {
    voice: pick('voice'),
    engine: pick('engine', 'expressive'),
    language: pick('language', 'English'),
    speed: num(pick('speed'), 1),
    instruct: top.instruct ?? null,
  };
  const tries = Math.max(1, num(a.tries, 2));
  const only = a.only ? new Set(String(a.only).split(',')) : null;

  const seen = new Set();
  const lines = list.map((l, i) => {
    if (!l || typeof l.text !== 'string' || !l.text.trim()) throw new VoisError(`Line ${i + 1} has no text.`, 3);
    const id = String(l.id ?? (i === 0 ? 'hook' : `line-${i + 1}`));
    if (!/^[a-z0-9][a-z0-9_-]*$/i.test(id)) throw new VoisError(`Line id "${id}" must use only letters, digits, - and _.`, 3);
    if (seen.has(id)) throw new VoisError(`Line id "${id}" is used two times.`, 3);
    seen.add(id);
    const ln = {
      n: i + 1,
      id,
      text: l.text.trim(),
      say: typeof l.say === 'string' && l.say.trim() ? l.say.trim() : null,
      instruct: l.instruct ?? base.instruct,
      voice: l.voice ?? base.voice ?? null,
      engine: l.engine ?? base.engine,
      language: l.language ?? base.language,
      speed: num(l.speed, base.speed),
      seed: l.seed ?? null,
    };
    ln.spoken = ln.say ?? ln.text;
    if (!takesDirection(ln.engine)) ln.instruct = null;
    if (PROMISE.test(ln.text)) log(`WARNING: line ${id} looks like a promise of views or money: "${ln.text.match(PROMISE)[0]}". Remove it.`);
    ln.file = join(out, 'lines', `${String(ln.n).padStart(2, '0')}-${id}.wav`);
    ln.key = fingerprint({ t: ln.spoken, v: ln.voice, e: ln.engine, l: ln.language, s: ln.speed, i: ln.instruct, seed: ln.seed });
    return ln;
  });

  // Script checks, before any render.
  const words = lines.reduce((n, l) => n + countWords(l.text), 0);
  const hookWords = countWords(lines[0].text);
  log(`${lines.length} lines, ${words} words, hook: ${hookWords} words ("${lines[0].text}")`);
  if (hookWords > 9) log(`WARNING: the hook has ${hookWords} words. Keep it to 9 words or less, so that it ends in 2 seconds.`);
  if ((words < 110 || words > 160) && !a.draft) {
    throw new VoisError(`The script has ${words} words. A 30-60 second Short needs 110-160 words. `
      + `${words < 110 ? 'Add' : 'Cut'} about ${words < 110 ? 110 - words : words - 160} words, or add --draft for a test.`, 65);
  }

  const reportPath = join(out, 'report.json');
  const old = readJson(reportPath, { lines: [] });
  const oldById = new Map((old.lines || []).map((l) => [l.id, l]));
  const todo = lines.filter((l) => {
    if (only && !only.has(l.id)) return false;
    const prev = oldById.get(l.id);
    return a.force || !existsSync(l.file) || !prev || prev.key !== l.key;
  });
  const missing = lines.filter((l) => !todo.includes(l) && !existsSync(l.file));
  if (missing.length) throw new VoisError(`No WAV yet for: ${missing.map((l) => l.id).join(', ')}. Run without --only.`, 4);

  let cli = null;
  if (todo.length || a.master) {
    cli = findCli(a.cli);
    const status = preflight(cli);
    creditGate(status, todo.length + (a.master ? 1 : 0), a['use-credits']);
  }
  for (const l of todo) {
    for (let t = 1; t <= tries; t++) {
      const seed = t === 1 ? l.seed : Math.floor(Math.random() * 2 ** 31);
      const tmp = l.file.replace(/\.wav$/, `.take${t}.wav`);
      log(`render ${l.id} (take ${t})`);
      const res = renderLine(cli, { ...l, text: l.spoken, out: tmp, seed });
      const problem = takeProblem(l.spoken, analyseSpeech(readWav(tmp)));
      if (problem && t < tries) { log(`  ${problem}: one more take`); rmSync(tmp, { force: true }); continue; }
      if (problem) log(`  WARNING: ${problem}. Listen to ${l.file} before you use it.`);
      renameSync(tmp, l.file);
      l.seedUsed = seed;
      l.engineUsed = res.engine_used ?? l.engine;
      break;
    }
  }

  // Join the lines tight: cut the silence at the two ends of each take, keep a short pad.
  const PAD = 0.04;
  const parts = [];
  const allWords = [];
  const rows = [];
  let at = 0;
  lines.forEach((l, i) => {
    const wav = readWav(l.file);
    const an = analyseSpeech(wav);
    const from = Math.max(0, an.start - PAD);
    const to = Math.min(wav.duration, an.end + PAD);
    const a0 = Math.floor(from * wav.sampleRate);
    const a1 = Math.ceil(to * wav.sampleRate);
    const piece = { ...wav, samples: wav.samples.subarray(a0, a1), frames: a1 - a0, duration: (a1 - a0) / wav.sampleRate };
    if (i > 0) { parts.push({ silence: gap }); at += Math.round(gap * wav.sampleRate) / wav.sampleRate; }
    parts.push({ wav: piece });
    const shifted = { ...an, start: an.start - a0 / wav.sampleRate, end: an.end - a0 / wav.sampleRate, pauses: an.pauses.map((p) => ({ start: p.start - a0 / wav.sampleRate, end: p.end - a0 / wav.sampleRate })) };
    allWords.push(...timePhrases(l.text, shifted, at).flatMap(timeWords));
    const prev = oldById.get(l.id) || {};
    rows.push({
      id: l.id,
      file: `lines/${l.file.split(/[\\/]/).pop()}`,
      text: l.text,
      say: l.say,
      start: round3(at + shifted.start),
      end: round3(at + shifted.end),
      words: countWords(l.text),
      voice: l.voice,
      engine: l.engineUsed ?? prev.engine ?? l.engine,
      speed: l.speed,
      instruct: l.instruct,
      seed: l.seedUsed !== undefined ? l.seedUsed : prev.seed ?? l.seed,
      key: l.key,
    });
    at += piece.duration;
  });
  const track = joinWavs(join(out, 'short.wav'), parts);

  writeFileSync(join(out, 'short.srt'), toSrt(shortCues(allWords, capWords, 22)));
  writeJson(join(out, 'short.words.json'), allWords.map((w, i) => ({ id: `w${i}`, text: w.text, start: w.start, end: w.end })));

  const length = round3(track.duration);
  const hookEnd = rows[0].end;
  const checks = {
    words: { value: words, pass: words >= 110 && words <= 160, rule: '110-160 words' },
    length: { value: length, pass: length >= 30 && length <= 60, rule: '30-60 seconds' },
    hook: { value: hookEnd, pass: hookEnd <= 2.0, rule: 'hook ends by 2.0 s' },
    voiceStart: { value: rows[0].start, pass: rows[0].start <= 0.2, rule: 'voice starts by 0.2 s' },
  };
  const wps = words / Math.max(1, length);

  let mastered = null;
  if (a.master) {
    const prof = runCli(cli, ['export', 'profile', '--id', String(a.master)]);
    if (prof.code !== 0) throw new VoisError(`Unknown profile ${a.master}. See: vois-cli export profiles`, prof.code);
    const ext = { aac: 'm4a', mp3: 'mp3', wav: 'wav', flac: 'flac' }[prof.json?.format] || 'm4a';
    mastered = join(out, `short-${a.master}.${ext}`);
    const r = runCli(cli, ['export', 'with-profile', '--input', track.file, '--output', mastered, '--profile', String(a.master)]);
    if (r.code !== 0) throw new VoisError(`export with-profile failed with exit ${r.code}: ${r.message}\n  What to do: ${ADVICE[r.code] || 'Read the message.'}`, r.code);
  }

  writeJson(reportPath, {
    generator: 'vois-studio faceless-short',
    lengthSeconds: length,
    words,
    wordsPerSecond: round3(wps),
    hookEndsAt: hookEnd,
    checks,
    draft: Boolean(a.draft),
    files: { voice: 'short.wav', captions: 'short.srt', words: 'short.words.json', mastered: mastered ? mastered.split(/[\\/]/).pop() : null },
    lines: rows,
  });

  log('');
  log('line          start    end     words');
  for (const r of rows) log(`${r.id.padEnd(12)} ${r.start.toFixed(2).padStart(6)}  ${r.end.toFixed(2).padStart(6)}  ${String(r.words).padStart(5)}`);
  for (const [k, c] of Object.entries(checks)) log(`${c.pass ? 'PASS' : (a.draft && (k === 'words' || k === 'length') ? 'SKIP' : 'FAIL')}  ${c.rule}: ${c.value}`);
  log(`pace: ${wps.toFixed(2)} words a second. Folder: ${out}`);
  const failed = Object.entries(checks).filter(([k, c]) => !c.pass && !(a.draft && (k === 'words' || k === 'length')));
  process.stdout.write(JSON.stringify({ out, lengthSeconds: length, words, hookEndsAt: hookEnd, failed: failed.map(([k]) => k), mastered }) + '\n');
  if (failed.length) {
    if (checks.hook.pass === false) log('Hook: cut it to 6 to 8 words, or set "speed": 1.1 on the hook line.');
    if (!checks.length.pass && !a.draft) log(`Length: ${length < 30 ? 'add' : 'cut'} about ${Math.ceil(Math.abs((length < 30 ? 30 : 60) - length) * wps)} words.`);
    return 65;
  }
  return 0;
});
