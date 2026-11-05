#!/usr/bin/env node
// ads.mjs: ad reads for 15, 30 and 60 second slots, in three directions each, made with
// Vois Studio. Renders each read in each direction, measures the spoken length, makes a
// new take at a corrected speed when the read is outside its slot, and writes a copy of
// each good read that is exactly as long as its slot.
//
//   node ads.mjs --ad ad.json [--out ads] [--tolerance 0.5] [--tries 3] [--only 15,30]
//        [--directions warm,calm] [--force] [--dry-run] [--use-credits] [--cli PATH]
//
// Output (in --out):
//   takes/<slot>s-<direction>.wav   the last take of each read (24 kHz mono)
//   fit/<slot>s-<direction>.wav     the read, 0.05 s of silence before it, padded to the slot length
//   report.json, report.csv         spoken length, speed, result and advice for each read
//
// A read passes when its spoken length is within the tolerance of the slot (default 0.5 s)
// and it fits in the slot with its lead. Exit 0: all reads pass. Exit 65: one or more do not.
//
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Vois Studio. Released under the MIT License:
// https://opensource.org/license/mit

import { existsSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  VoisError, analyseSpeech, countWords, creditGate, findCli, fingerprint, log, main, num, parseArgs,
  preflight, readJson, readWav, renderLine, round3, slug, takesDirection, writeJson, writeWav,
} from './vois-voice.mjs';

const HELP = `Usage: node ads.mjs --ad ad.json [options]
  --out DIR          output folder (default: ads)
  --tolerance S      allowed distance from the slot, in seconds (default: 0.5)
  --tries N          takes for each read, with speed corrections (default: 3)
  --only 15,30       render only these slots
  --directions a,b   render only these directions
  --force            render again even when nothing changed
  --dry-run          show the word budget of each read, render nothing
  --use-credits      allow a run that uses export credits (Free plan; not for commercial use)
  --cli PATH         path to vois-cli`;

const PRE = 0.05; // silence before the voice in the fit file
const EDGE = 0.05; // audio kept before and after the measured speech
const MIN_FACTOR = 0.85; // the script changes the speed by 15 percent at most
const MAX_FACTOR = 1.15;
const WPS = 2.5; // words a second for a usual ad read

main(() => {
  const a = parseArgs(process.argv.slice(2), ['force', 'dry-run', 'use-credits', 'help']);
  if (a.help || !a.ad) { log(HELP); return a.help ? 0 : 64; }

  const doc = readJson(resolve(a.ad));
  if (doc === undefined) throw new VoisError(`Ad file not found: ${a.ad}`, 4);
  const out = resolve(a.out ?? doc.out ?? 'ads');
  const tol = num(a.tolerance ?? doc.tolerance, 0.5);
  const tries = Math.max(1, num(a.tries, 3));
  const onlySlots = a.only ? new Set(String(a.only).split(',').map(Number)) : null;
  const onlyDirs = a.directions ? new Set(String(a.directions).split(',')) : null;

  const reads = (doc.reads || []).map((r) => ({ slot: Number(r.slot), text: String(r.text || '').trim(), say: r.say ? String(r.say).trim() : null, byDirection: r.byDirection || {} }));
  if (!reads.length) throw new VoisError('ad.json has no "reads". Give [{ "slot": 30, "text": "..." }].', 3);
  for (const r of reads) {
    if (!(r.slot > 0) || !r.text) throw new VoisError('Each read needs a "slot" in seconds and a "text".', 3);
  }
  const dirs = (doc.directions || [{ id: 'default' }]).map((d, i) => ({
    id: slug(d.id ?? d.name ?? `direction-${i + 1}`),
    instruct: d.instruct ?? null,
    voice: d.voice ?? doc.voice ?? null,
    engine: d.engine ?? doc.engine ?? 'expressive',
    language: d.language ?? doc.language ?? 'English',
    speed: num(d.speed, 1),
  }));
  for (const d of dirs) {
    if (d.instruct && !takesDirection(d.engine)) {
      log(`NOTE: direction ${d.id}: ${d.engine} ignores "instruct". On a plan without Omni, make the directions different with "voice" and "speed".`);
      d.instruct = null;
    }
  }

  const jobs = [];
  for (const r of reads) {
    if (onlySlots && !onlySlots.has(r.slot)) continue;
    for (const d of dirs) {
      if (onlyDirs && !onlyDirs.has(d.id)) continue;
      // A direction can have its own words for a slot, because each direction has its own pace.
      const own = r.byDirection[d.id];
      const text = typeof own === 'string' && own.trim() ? own.trim() : r.say ?? r.text;
      jobs.push({ read: r, dir: d, text, own: Boolean(own), name: `${r.slot}s-${d.id}` });
    }
  }

  log(`${reads.length} reads x ${dirs.length} directions, tolerance ±${tol} s`);
  for (const r of reads) {
    const w = countWords(r.say ?? r.text);
    const est = w / WPS;
    const lo = Math.round((r.slot - 0.6) * WPS * 0.88);
    const hi = Math.round((r.slot - 0.4) * WPS * 1.08);
    log(`  ${String(r.slot).padStart(3)} s read: ${w} words, about ${est.toFixed(1)} s at a usual pace (budget about ${lo}-${hi} words)`);
  }
  if (a['dry-run']) return 0;

  const reportPath = join(out, 'report.json');
  const old = readJson(reportPath, { reads: [] });
  const oldByName = new Map((old.reads || []).map((r) => [r.name, r]));

  let cli = null;
  const fresh = jobs.filter((j) => {
    j.key = fingerprint({ t: j.text, slot: j.read.slot, tol, v: j.dir.voice, e: j.dir.engine, l: j.dir.language, s: j.dir.speed, i: j.dir.instruct });
    const prev = oldByName.get(j.name);
    return a.force || !prev || prev.key !== j.key || !existsSync(join(out, 'takes', `${j.name}.wav`));
  });
  if (fresh.length) {
    cli = findCli(a.cli);
    const status = preflight(cli);
    creditGate(status, fresh.length * tries, a['use-credits']);
    if (status.metered) log('NOTE: export credits are on the Free plan. Free is for non-commercial use. An ad is commercial use.');
  }

  const results = [];
  for (const j of jobs) {
    const prev = oldByName.get(j.name);
    if (!fresh.includes(j)) { results.push(prev); continue; }
    const spoken = j.text;
    const target = j.read.slot - PRE - 2 * EDGE - 0.1;
    let speed = j.dir.speed;
    let best = null;
    const takeFile = join(out, 'takes', `${j.name}.wav`);
    for (let t = 1; t <= tries; t++) {
      const tmp = join(out, 'takes', `${j.name}.take${t}.wav`);
      log(`render ${j.name} (take ${t}, speed ${speed.toFixed(3)})`);
      const res = renderLine(cli, { text: spoken, out: tmp, voice: j.dir.voice, engine: j.dir.engine, language: j.dir.language, speed: round3(speed), instruct: j.dir.instruct });
      const wav = readWav(tmp);
      const an = analyseSpeech(wav);
      const len = an.speech;
      const within = Math.abs(len - j.read.slot) <= tol;
      const fits = len + PRE + 2 * EDGE <= j.read.slot;
      const take = { t, tmp, wav, an, len, speed: round3(speed), within, fits, engine: res.engine_used ?? j.dir.engine };
      if (!best || (take.within && take.fits) || Math.abs(len - target) < Math.abs(best.len - target)) best = take;
      log(`  spoken ${len.toFixed(2)} s for a ${j.read.slot} s slot: ${within && fits ? 'PASS' : within ? 'too close to the slot end' : len > j.read.slot ? 'too long' : 'too short'}`);
      if (within && fits) break;
      const factor = (len / target);
      const next = speed * factor;
      if (factor < MIN_FACTOR || factor > MAX_FACTOR || next < 0.5 || next > 2) {
        log(`  a speed change of ${((factor - 1) * 100).toFixed(0)} percent is too large. Change the words.`);
        break;
      }
      speed = next;
    }
    renameSync(best.tmp, takeFile);
    for (let t = 1; t <= tries; t++) rmSync(join(out, 'takes', `${j.name}.take${t}.wav`), { force: true });
    const words = countWords(spoken);
    const delta = best.len - (j.read.slot - 0.3);
    const wordsToChange = Math.round(Math.abs(delta) * (words / Math.max(0.5, best.len)));
    let advice = '';
    let fit = null;
    if (best.within && best.fits) {
      const w = best.wav;
      const from = Math.max(0, Math.floor((best.an.start - EDGE) * w.sampleRate));
      const to = Math.min(w.frames, Math.ceil((best.an.end + EDGE) * w.sampleRate));
      const total = Math.round(j.read.slot * w.sampleRate);
      const pcm = new Float32Array(total);
      const pre = Math.round(PRE * w.sampleRate);
      pcm.set(w.samples.subarray(from, Math.min(to, from + total - pre)), pre);
      fit = join(out, 'fit', `${j.name}.wav`);
      writeWav(fit, pcm, w.sampleRate);
    } else if (best.len > j.read.slot - PRE - 2 * EDGE) {
      advice = `cut about ${Math.max(1, wordsToChange)} word(s) in reads[].byDirection.${j.dir.id}`;
    } else {
      advice = `add about ${Math.max(1, wordsToChange)} word(s) in reads[].byDirection.${j.dir.id}`;
    }
    results.push({
      name: j.name,
      slot: j.read.slot,
      direction: j.dir.id,
      voice: j.dir.voice,
      engine: best.engine,
      instruct: j.dir.instruct,
      speed: best.speed,
      words,
      text: spoken,
      spokenSeconds: round3(best.len),
      fileSeconds: round3(best.wav.duration),
      takes: best.t,
      pass: best.within && best.fits,
      take: `takes/${j.name}.wav`,
      fit: fit ? `fit/${j.name}.wav` : null,
      advice,
      key: j.key,
    });
  }

  writeJson(reportPath, { generator: 'vois-studio ad-voiceover', tolerance: tol, reads: results });
  const csv = ['read,slot,direction,spoken_seconds,speed,takes,pass,fit,advice',
    ...results.map((r) => [r.name, r.slot, r.direction, r.spokenSeconds, r.speed, r.takes, r.pass ? 'yes' : 'no', r.fit ?? '', r.advice].join(','))];
  writeFileSync(join(out, 'report.csv'), csv.join('\n') + '\n');

  log('');
  log('read                     slot   spoken   speed   result');
  for (const r of results) log(`${r.name.padEnd(24)} ${String(r.slot).padStart(4)}   ${r.spokenSeconds.toFixed(2).padStart(6)}   ${r.speed.toFixed(2).padStart(5)}   ${r.pass ? 'PASS' : `FAIL: ${r.advice}`}`);
  log(`folder: ${out}`);
  const failed = results.filter((r) => !r.pass);
  process.stdout.write(JSON.stringify({ out, reads: results.length, failed: failed.map((r) => r.name) }) + '\n');
  return failed.length ? 65 : 0;
});
