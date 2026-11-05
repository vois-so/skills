#!/usr/bin/env node
// explainer.mjs: scene-timed narration for any video editor, made with Vois Studio.
// Renders one WAV for each scene, puts all scenes on one narration track with the
// right silences, and writes SRT captions and a timing sheet. Premiere Pro,
// DaVinci Resolve, Final Cut Pro and CapCut import all of these files.
//
//   node explainer.mjs --scenes scenes.json [--out voiceover] [--fps 30]
//        [--voice ID] [--engine expressive] [--language English] [--speed 1]
//        [--lead 0.3] [--tail 0.7] [--offset 0] [--joiner auto|ffmpeg|node]
//        [--master youtube_video] [--tries 2] [--only a,b] [--force]
//        [--dry-run] [--use-credits] [--cli PATH] [--ffmpeg PATH]
//
// Output (in --out):
//   scenes/01-<id>.wav   one take for each scene (24 kHz mono)
//   narration.wav        all scenes on one track (48 kHz with ffmpeg, 24 kHz without)
//   narration.srt        captions at narration time
//   timing.csv           scene, start, end and length, for markers in the editor
//   timing.json          the same data with the take details
//
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Vois Studio. Released under the MIT License:
// https://opensource.org/license/mit

import { spawnSync } from 'node:child_process';
import { existsSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  ADVICE, VoisError, analyseSpeech, buildCues, countWords, creditGate, findCli, fingerprint, joinWavs, log, main,
  num, parseArgs, preflight, readJson, readWav, renderLine, round3, runCli, takeProblem, takesDirection,
  timePhrases, timeWords, toSrt, writeJson,
} from './vois-voice.mjs';

const HELP = `Usage: node explainer.mjs --scenes scenes.json [options]
  --out DIR          output folder (default: voiceover)
  --fps N            editor frame rate; scene starts snap to frames (default: 30)
  --voice ID         voice ID from: vois-cli voice list --source all --format json
  --engine ID        fast | expressive | multilingual | omni | sonic | craft (default: expressive)
  --language NAME    for example English (default: English)
  --speed N          0.5 to 2.0 (default: 1)
  --lead S           silence before each line in its scene (default: 0.3)
  --tail S           silence after each line in its scene (default: 0.7)
  --offset S         silence before the first scene (default: 0)
  --joiner MODE      auto (ffmpeg if installed), ffmpeg, or node (default: auto)
  --master PROFILE   also export narration.wav with a Vois Studio output profile,
                     for example youtube_video (see: vois-cli export profiles)
  --tries N          takes to try when a take looks wrong (default: 2)
  --only a,b         render only these scene ids
  --force            render again even when nothing changed
  --dry-run          show the plan, render nothing
  --use-credits      allow a run that uses export credits (Free plan)
  --cli PATH         path to vois-cli
  --ffmpeg PATH      path to ffmpeg`;

function findFfmpeg(explicit) {
  const bin = explicit || 'ffmpeg';
  const r = spawnSync(bin, ['-hide_banner', '-version'], { encoding: 'utf8', windowsHide: true });
  return r.status === 0 ? bin : null;
}

// Joins and pads the scene takes with ffmpeg, at 48 kHz (the rate of video projects).
function ffmpegJoin(ffmpeg, file, offset, rows) {
  const rate = 48000;
  const args = ['-hide_banner', '-loglevel', 'error', '-y'];
  rows.forEach((r) => args.push('-i', r.file));
  const chains = [];
  const labels = [];
  if (offset > 0) {
    chains.push(`anullsrc=r=${rate}:cl=mono,atrim=end=${offset.toFixed(6)},asetpts=N/SR/TB[pre]`);
    labels.push('[pre]');
  }
  rows.forEach((r, i) => {
    const delay = Math.round(r.lead * rate);
    chains.push(`[${i}:a]aresample=${rate},aformat=sample_fmts=s16:channel_layouts=mono,adelay=delays=${delay}S:all=1,`
      + `apad=whole_dur=${r.sceneSeconds.toFixed(6)},atrim=end=${r.sceneSeconds.toFixed(6)},asetpts=N/SR/TB[s${i}]`);
    labels.push(`[s${i}]`);
  });
  chains.push(`${labels.join('')}concat=n=${labels.length}:v=0:a=1[out]`);
  args.push('-filter_complex', chains.join(';'), '-map', '[out]', '-ar', String(rate), '-ac', '1', '-c:a', 'pcm_s16le', file);
  const r = spawnSync(ffmpeg, args, { encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) throw new VoisError(`ffmpeg could not join the scenes: ${(r.stderr || '').trim().slice(-400)}\n  Start the script again with --joiner node.`, 6);
}

const csvCell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const clock = (t) => {
  const ms = Math.round(t * 1000);
  const pad = (v, n = 2) => String(v).padStart(n, '0');
  return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)}.${pad(ms % 1000, 3)}`;
};

main(() => {
  const a = parseArgs(process.argv.slice(2), ['force', 'dry-run', 'use-credits', 'help']);
  if (a.help || !a.scenes) { log(HELP); return a.help ? 0 : 64; }

  const doc = readJson(resolve(a.scenes));
  if (doc === undefined) throw new VoisError(`Scenes file not found: ${a.scenes}`, 4);
  const list = Array.isArray(doc) ? doc : doc.scenes;
  const top = Array.isArray(doc) ? {} : doc;
  if (!Array.isArray(list) || !list.length) throw new VoisError('The scenes file has no scenes. Give an array of { id, text }.', 3);

  const pick = (k, d) => a[k] ?? top[k] ?? d;
  const out = resolve(pick('out', 'voiceover'));
  const fps = num(pick('fps'), 30);
  const base = {
    voice: pick('voice'),
    engine: pick('engine', 'expressive'),
    language: pick('language', 'English'),
    speed: num(pick('speed'), 1),
    lead: num(pick('lead'), 0.3),
    tail: num(pick('tail'), 0.7),
  };
  const offset = num(pick('offset'), 0);
  const tries = Math.max(1, num(a.tries, 2));
  const only = a.only ? new Set(String(a.only).split(',')) : null;
  const snapUp = (t) => Math.ceil(t * fps - 1e-6) / fps;
  const snap = (t) => Math.round(t * fps) / fps;

  const seen = new Set();
  const scenes = list.map((s, i) => {
    if (!s || typeof s.text !== 'string' || !s.text.trim()) throw new VoisError(`Scene ${i + 1} has no text.`, 3);
    const id = String(s.id ?? `scene-${i + 1}`);
    if (!/^[a-z0-9][a-z0-9_-]*$/i.test(id)) throw new VoisError(`Scene id "${id}" must use only letters, digits, - and _.`, 3);
    if (seen.has(id)) throw new VoisError(`Scene id "${id}" is used two times.`, 3);
    seen.add(id);
    const sc = {
      n: i + 1,
      id,
      text: s.text.trim(),
      say: typeof s.say === 'string' && s.say.trim() ? s.say.trim() : null,
      instruct: s.instruct ?? s.direction ?? null,
      voice: s.voice ?? base.voice ?? null,
      engine: s.engine ?? base.engine,
      language: s.language ?? base.language,
      speed: num(s.speed, base.speed),
      seed: s.seed ?? null,
      lead: num(s.lead, base.lead),
      tail: num(s.tail, base.tail),
      seconds: s.seconds === undefined ? null : Number(s.seconds),
    };
    sc.spoken = sc.say ?? sc.text;
    if (!takesDirection(sc.engine)) {
      if (sc.instruct) log(`NOTE: scene ${id}: ${sc.engine} ignores the direction. Use --engine omni or craft (Pro) to act on it.`);
      sc.instruct = null;
    }
    if (/\[[^\]]+\]/.test(sc.spoken) && sc.engine !== 'expressive') log(`NOTE: scene ${id}: ${sc.engine} does not act on bracket tags. Remove them.`);
    sc.file = join(out, 'scenes', `${String(sc.n).padStart(2, '0')}-${id}.wav`);
    sc.key = fingerprint({ t: sc.spoken, v: sc.voice, e: sc.engine, l: sc.language, s: sc.speed, i: sc.instruct, seed: sc.seed });
    return sc;
  });

  const timingPath = join(out, 'timing.json');
  const old = readJson(timingPath, { scenes: [] });
  const oldById = new Map((old.scenes || []).map((s) => [s.id, s]));
  const todo = scenes.filter((s) => {
    if (only && !only.has(s.id)) return false;
    const prev = oldById.get(s.id);
    return a.force || !existsSync(s.file) || !prev || prev.key !== s.key;
  });
  const missing = scenes.filter((s) => !todo.includes(s) && !existsSync(s.file));
  if (missing.length) throw new VoisError(`No WAV yet for: ${missing.map((s) => s.id).join(', ')}. Run without --only.`, 4);

  const words = scenes.reduce((n, s) => n + countWords(s.spoken), 0);
  log(`${scenes.length} scenes, ${words} words (about ${(words / 2.5).toFixed(0)} s of speech), ${todo.length} to render`);
  if (a['dry-run']) {
    for (const s of scenes) {
      const est = countWords(s.spoken) / 2.5;
      const slot = s.seconds ? `  slot ${s.seconds} s${est + s.lead > s.seconds ? '  (probably too long)' : ''}` : '';
      log(`  ${todo.includes(s) ? 'render' : 'keep  '}  ${s.id}  ~${est.toFixed(1)} s${slot}`);
    }
    return 0;
  }

  let cli = null;
  let status = null;
  if (todo.length || a.master) {
    cli = findCli(a.cli);
    status = preflight(cli);
    creditGate(status, todo.length + (a.master ? 1 : 0), a['use-credits']);
  }
  for (const s of todo) {
    for (let t = 1; t <= tries; t++) {
      const seed = t === 1 ? s.seed : Math.floor(Math.random() * 2 ** 31);
      const tmp = s.file.replace(/\.wav$/, `.take${t}.wav`);
      log(`render ${s.id} (take ${t})`);
      const res = renderLine(cli, { ...s, text: s.spoken, out: tmp, seed });
      const problem = takeProblem(s.spoken, analyseSpeech(readWav(tmp)));
      if (problem && t < tries) { log(`  ${problem}: one more take`); rmSync(tmp, { force: true }); continue; }
      if (problem) log(`  WARNING: ${problem}. Listen to ${s.file} before you use it.`);
      renameSync(tmp, s.file);
      s.seedUsed = seed;
      s.engineUsed = res.engine_used ?? s.engine;
      break;
    }
  }

  // Build the timeline. Scene starts sit on frames of the editor.
  let at = snap(offset);
  const rows = [];
  const allWords = [];
  for (const s of scenes) {
    const wav = readWav(s.file);
    const an = analyseSpeech(wav);
    const lead = snap(s.lead);
    const needed = snapUp(lead + wav.duration + s.tail);
    let sceneSeconds = needed;
    let note = '';
    if (s.seconds) {
      const slot = snapUp(s.seconds);
      const voiceEnd = lead + an.end;
      if (voiceEnd > slot) {
        const over = voiceEnd - slot;
        const cut = Math.ceil((over * countWords(s.spoken)) / Math.max(0.5, an.speech));
        note = `over the ${s.seconds} s slot by ${over.toFixed(2)} s: cut about ${cut} word(s), or raise the speed`;
        sceneSeconds = snapUp(lead + wav.duration);
      } else {
        sceneSeconds = slot;
      }
    }
    const start = round3(at);
    allWords.push(...timePhrases(s.text, an, start + lead).flatMap(timeWords));
    const prev = oldById.get(s.id) || {};
    rows.push({
      n: s.n,
      id: s.id,
      file: s.file,
      text: s.text,
      say: s.say,
      start,
      end: round3(at + sceneSeconds),
      sceneSeconds: round3(sceneSeconds),
      voiceStart: round3(start + lead + an.start),
      voiceEnd: round3(start + lead + an.end),
      clipSeconds: round3(wav.duration),
      lead,
      slot: s.seconds,
      note,
      wav,
      voice: s.voice,
      engine: s.engineUsed ?? prev.engine ?? s.engine,
      language: s.language,
      speed: s.speed,
      instruct: s.instruct,
      seed: s.seedUsed !== undefined ? s.seedUsed : prev.seed ?? s.seed,
      key: s.key,
    });
    at += sceneSeconds;
  }
  const total = round3(at);

  // One narration track: ffmpeg when it is installed, else the built-in joiner.
  const mode = String(pick('joiner', 'auto'));
  const ffmpeg = mode === 'node' ? null : findFfmpeg(a.ffmpeg);
  if (mode === 'ffmpeg' && !ffmpeg) throw new VoisError('ffmpeg was not found. Install it, give --ffmpeg PATH, or use --joiner node.', 4);
  const narration = join(out, 'narration.wav');
  if (ffmpeg) {
    ffmpegJoin(ffmpeg, narration, snap(offset), rows);
  } else {
    const parts = offset > 0 ? [{ silence: snap(offset) }] : [];
    for (const r of rows) parts.push({ silence: r.lead }, { wav: r.wav }, { silence: r.sceneSeconds - r.lead - r.wav.duration });
    joinWavs(narration, parts);
  }
  const joined = readWav(narration);
  if (Math.abs(joined.duration - total) > 0.005 + rows.length / joined.sampleRate) {
    throw new VoisError(`narration.wav is ${joined.duration.toFixed(3)} s, the timeline is ${total} s. Start again with --joiner node.`, 6);
  }

  writeFileSync(join(out, 'narration.srt'), toSrt(buildCues(allWords, { maxChars: 42, maxLines: 2 })));
  const csv = ['scene,id,start,end,length,voice_start,voice_end,file,note',
    ...rows.map((r) => [r.n, r.id, clock(r.start), clock(r.end), r.sceneSeconds.toFixed(3), clock(r.voiceStart), clock(r.voiceEnd), `scenes/${r.file.split(/[\\/]/).pop()}`, r.note].map(csvCell).join(','))];
  writeFileSync(join(out, 'timing.csv'), csv.join('\n') + '\n');
  writeJson(timingPath, {
    generator: 'vois-studio explainer-voiceover',
    fps,
    offset: snap(offset),
    totalSeconds: total,
    narration: { file: 'narration.wav', sampleRate: joined.sampleRate, joiner: ffmpeg ? 'ffmpeg' : 'node' },
    captions: 'narration.srt',
    scenes: rows.map(({ wav, ...r }) => ({ ...r, file: `scenes/${r.file.split(/[\\/]/).pop()}` })),
  });

  let mastered = null;
  if (a.master) {
    const prof = runCli(cli, ['export', 'profile', '--id', String(a.master)]);
    if (prof.code !== 0) throw new VoisError(`Unknown profile ${a.master}. See: vois-cli export profiles`, prof.code);
    const ext = { aac: 'm4a', mp3: 'mp3', wav: 'wav', flac: 'flac' }[prof.json?.format] || 'm4a';
    mastered = join(out, `narration-${a.master}.${ext}`);
    const r = runCli(cli, ['export', 'with-profile', '--input', narration, '--output', mastered, '--profile', String(a.master)]);
    if (r.code !== 0) throw new VoisError(`export with-profile failed with exit ${r.code}: ${r.message}\n  What to do: ${ADVICE[r.code] || 'Read the message.'}`, r.code);
  }

  log('');
  log('#   scene             start          length   voice ends     note');
  for (const r of rows) log(`${String(r.n).padStart(2)}  ${r.id.padEnd(16)}  ${clock(r.start)}   ${r.sceneSeconds.toFixed(2).padStart(6)}   ${clock(r.voiceEnd)}   ${r.note}`);
  log(`total ${clock(total)} (${total} s), narration.wav at ${joined.sampleRate} Hz, joined with ${ffmpeg ? 'ffmpeg' : 'the built-in joiner (no ffmpeg)'}`);
  log(`folder: ${out}`);
  if (mastered) log(`mastered: ${mastered}`);
  const over = rows.filter((r) => r.note);
  process.stdout.write(JSON.stringify({ out, totalSeconds: total, scenes: rows.length, overSlot: over.map((r) => r.id), mastered }) + '\n');
  if (over.length) {
    log(`WARNING: ${over.length} scene(s) are longer than their slot: ${over.map((r) => r.id).join(', ')}. The files are written. Exit 65.`);
    return 65;
  }
  return 0;
});
