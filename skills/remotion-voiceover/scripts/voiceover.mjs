#!/usr/bin/env node
// voiceover.mjs: voices a Remotion composition with Vois Studio.
// Renders one WAV for each scene into public/voiceover/, measures each take, and writes
// a timing manifest (seconds and frames at the composition fps) that the composition imports.
//
//   node voiceover.mjs --scenes scenes.json [--project .] [--fps 30]
//        [--out public/voiceover] [--manifest src/voiceover.json]
//        [--voice ID] [--engine expressive] [--language English] [--speed 1]
//        [--lead 0.25] [--tail 0.5] [--tries 2] [--only a,b] [--force]
//        [--dry-run] [--use-credits] [--cli PATH]
//
// A scene can give "say" (what the voice reads) when it differs from "text" (the caption).
// A flag wins over the same key at the top of scenes.json, which wins over the default.
// A scene is rendered again only when its text, voice, engine, language, speed,
// direction or seed changes (or with --force). Exit codes follow vois-cli.
//
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Vois Studio. Released under the MIT License:
// https://opensource.org/license/mit

import { existsSync, renameSync, rmSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import {
  VoisError, analyseSpeech, countWords, creditGate, findCli, fingerprint, log, main, num, parseArgs,
  preflight, readJson, readWav, renderLine, round3, takeProblem, takesDirection, timePhrases, timeWords, writeJson,
} from './vois-voice.mjs';

const HELP = `Usage: node voiceover.mjs --scenes scenes.json [options]
  --project DIR      Remotion project root (default: current folder)
  --out DIR          WAV folder, inside public/ (default: public/voiceover)
  --manifest FILE    timing manifest (default: src/voiceover.json)
  --fps N            composition frame rate (default: 30)
  --voice ID         voice ID from: vois-cli voice list --source all --format json
  --engine ID        fast | expressive | multilingual | omni | sonic | craft (default: expressive)
  --language NAME    for example English (default: English)
  --speed N          0.5 to 2.0 (default: 1)
  --lead S           seconds of silence before each line (default: 0.25)
  --tail S           seconds of silence after each line (default: 0.5)
  --tries N          takes to try when a take looks wrong (default: 2)
  --only a,b         render only these scene ids
  --force            render again even when nothing changed
  --dry-run          show the plan, render nothing
  --use-credits      allow a run that uses export credits (Free plan)
  --cli PATH         path to vois-cli`;

main(() => {
  const a = parseArgs(process.argv.slice(2), ['force', 'dry-run', 'use-credits', 'help']);
  if (a.help || !a.scenes) { log(HELP); return a.help ? 0 : 64; }

  const project = resolve(a.project ?? '.');
  const doc = readJson(resolve(a.scenes));
  if (doc === undefined) throw new VoisError(`Scenes file not found: ${a.scenes}`, 4);
  const list = Array.isArray(doc) ? doc : doc.scenes;
  const top = Array.isArray(doc) ? {} : doc;
  if (!Array.isArray(list) || !list.length) throw new VoisError('The scenes file has no scenes. Give an array of { id, text }.', 3);

  const pick = (k, d) => a[k] ?? top[k] ?? d;
  const fps = num(pick('fps'), 30);
  const outDir = resolve(project, pick('out', join('public', 'voiceover')));
  const publicDir = resolve(project, 'public');
  const manifestPath = resolve(project, pick('manifest', join('src', 'voiceover.json')));
  const base = {
    voice: pick('voice'),
    engine: pick('engine', 'expressive'),
    language: pick('language', 'English'),
    speed: num(pick('speed'), 1),
    lead: num(pick('lead'), 0.25),
    tail: num(pick('tail'), 0.5),
  };
  const tries = Math.max(1, num(a.tries, 2));
  const only = a.only ? new Set(String(a.only).split(',')) : null;

  if (!outDir.startsWith(publicDir + sep)) log(`WARNING: ${outDir} is not inside ${publicDir}. staticFile() reads only from public/.`);

  // Check the scenes before any render.
  const seen = new Set();
  const scenes = list.map((s, i) => {
    if (!s || typeof s.text !== 'string' || !s.text.trim()) throw new VoisError(`Scene ${i + 1} has no text.`, 3);
    const id = String(s.id ?? `scene-${String(i + 1).padStart(2, '0')}`);
    if (!/^[a-z0-9][a-z0-9_-]*$/i.test(id)) throw new VoisError(`Scene id "${id}" must use only letters, digits, - and _.`, 3);
    if (seen.has(id)) throw new VoisError(`Scene id "${id}" is used two times.`, 3);
    seen.add(id);
    const sc = {
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
      minSeconds: num(s.minSeconds, 0),
    };
    if (sc.instruct && !takesDirection(sc.engine)) log(`NOTE: scene ${id}: ${sc.engine} ignores the direction. Use --engine omni or craft (Pro) to act on it.`);
    sc.spoken = sc.say ?? sc.text;
    if (/\[[^\]]+\]/.test(sc.spoken) && sc.engine !== 'expressive') log(`NOTE: scene ${id}: ${sc.engine} does not act on bracket tags. Remove them.`);
    sc.file = join(outDir, `${id}.wav`);
    sc.key = fingerprint({ t: sc.spoken, v: sc.voice, e: sc.engine, l: sc.language, s: sc.speed, i: sc.instruct, seed: sc.seed });
    return sc;
  });

  const old = readJson(manifestPath, { scenes: [] });
  const oldById = new Map((old.scenes || []).map((s) => [s.id, s]));
  const todo = scenes.filter((s) => {
    if (only && !only.has(s.id)) return false;
    const prev = oldById.get(s.id);
    return a.force || !existsSync(s.file) || !prev || prev.key !== s.key;
  });
  const missing = scenes.filter((s) => !todo.includes(s) && !existsSync(s.file));
  if (missing.length) throw new VoisError(`No WAV yet for: ${missing.map((s) => s.id).join(', ')}. Run without --only.`, 4);

  log(`${scenes.length} scenes, ${todo.length} to render, fps ${fps}, engine ${base.engine}, voice ${base.voice ?? '(engine default)'}`);
  if (a['dry-run']) {
    for (const s of scenes) log(`  ${todo.includes(s) ? 'render' : 'keep  '}  ${s.id}  ~${(countWords(s.spoken) / 2.5).toFixed(1)} s  "${s.spoken.slice(0, 60)}"`);
    return 0;
  }

  if (todo.length) {
    const cli = findCli(a.cli);
    const status = preflight(cli);
    creditGate(status, todo.length, a['use-credits']);
    for (const s of todo) {
      let kept = null;
      for (let t = 1; t <= tries && !kept; t++) {
        // A retake needs a new seed, or the same audio can come back.
        const seed = t === 1 ? s.seed : Math.floor(Math.random() * 2 ** 31);
        const tmp = join(outDir, `${s.id}.take${t}.wav`);
        log(`render ${s.id} (take ${t})`);
        const res = renderLine(cli, { ...s, text: s.spoken, out: tmp, seed });
        const an = analyseSpeech(readWav(tmp));
        const problem = takeProblem(s.spoken, an);
        if (problem && t < tries) { log(`  ${problem}: one more take`); rmSync(tmp, { force: true }); continue; }
        if (problem) log(`  WARNING: ${problem}. Listen to ${s.id}.wav before you use it.`);
        renameSync(tmp, s.file);
        s.seedUsed = seed;
        s.engineUsed = res.engine_used ?? s.engine;
        kept = true;
      }
    }
  }

  // Measure every scene and build the timeline.
  let frame = 0;
  const outScenes = scenes.map((s) => {
    const wav = readWav(s.file);
    const an = analyseSpeech(wav);
    const audioFrames = Math.ceil(wav.duration * fps);
    const leadFrames = Math.round(s.lead * fps);
    const tailFrames = Math.round(s.tail * fps);
    const sceneFrames = Math.max(leadFrames + audioFrames + tailFrames, Math.ceil(s.minSeconds * fps));
    const prev = oldById.get(s.id) || {};
    const lead = leadFrames / fps;
    const captions = timePhrases(s.text, an, lead).flatMap(timeWords).map((w) => ({
      text: ` ${w.text}`, startMs: Math.round(w.start * 1000), endMs: Math.round(w.end * 1000), timestampMs: null, confidence: null,
    }));
    const entry = {
      id: s.id,
      file: relative(publicDir, s.file).split(sep).join('/'),
      text: s.text,
      say: s.say,
      durationSeconds: round3(wav.duration),
      durationFrames: audioFrames,
      speechStartSeconds: round3(an.start),
      speechEndSeconds: round3(an.end),
      leadFrames,
      sceneFrames,
      sceneSeconds: round3(sceneFrames / fps),
      startFrame: frame,
      startSeconds: round3(frame / fps),
      voice: s.voice,
      engine: s.engineUsed ?? prev.engine ?? s.engine,
      language: s.language,
      speed: s.speed,
      instruct: s.instruct,
      seed: s.seedUsed !== undefined ? s.seedUsed : prev.seed ?? s.seed,
      key: s.key,
      captions,
    };
    frame += sceneFrames;
    return entry;
  });

  const manifest = {
    generator: 'vois-studio remotion-voiceover',
    fps,
    totalFrames: frame,
    totalSeconds: round3(frame / fps),
    captionsNote: 'Caption times are estimates from pauses and syllables, in ms from the scene start.',
    scenes: outScenes,
  };
  writeJson(manifestPath, manifest);

  log('');
  log('scene            audio s   frames   scene frames   starts at');
  for (const s of outScenes) {
    log(`${s.id.padEnd(16)} ${s.durationSeconds.toFixed(2).padStart(7)}   ${String(s.durationFrames).padStart(6)}   ${String(s.sceneFrames).padStart(12)}   ${String(s.startFrame).padStart(9)}`);
  }
  log(`total: ${manifest.totalFrames} frames = ${manifest.totalSeconds} s at ${fps} fps`);
  log(`manifest: ${manifestPath}`);
  process.stdout.write(JSON.stringify({ manifest: manifestPath, totalFrames: frame, totalSeconds: manifest.totalSeconds, scenes: outScenes.length }) + '\n');
  return 0;
});
