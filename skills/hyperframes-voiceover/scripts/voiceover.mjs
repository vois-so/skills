#!/usr/bin/env node
// voiceover.mjs: voices a HyperFrames composition with Vois Studio.
// Reads the narration from SCRIPT.md (the HyperFrames locked-narration file) or from
// scenes.json, renders one WAV for each line into assets/voiceover/, measures each take,
// and writes:
//   assets/voiceover/voiceover.json   timing manifest (seconds, snapped to frames)
//   assets/voiceover/voiceover.html   <audio> clips to paste into index.html
//   assets/voiceover/narration.wav    all lines on one track, for `hyperframes transcribe`
//   assets/voiceover/narration.words.json  estimated word times in the HyperFrames transcript shape
//   assets/voiceover/narration.srt    estimated captions as a sidecar file
//
//   node voiceover.mjs (--script SCRIPT.md | --scenes scenes.json) [--project .] [--fps 30]
//        [--out assets/voiceover] [--voice ID] [--engine expressive] [--language English]
//        [--speed 1] [--lead 0.25] [--tail 0.5] [--offset 0] [--track 3] [--tries 2]
//        [--only a,b] [--force] [--dry-run] [--use-credits] [--cli PATH]
//
// A line is rendered again only when its words, voice, engine, language, speed,
// direction or seed change (or with --force). Exit codes follow vois-cli.
//
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Vois Studio. Released under the MIT License:
// https://opensource.org/license/mit

import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import {
  VoisError, analyseSpeech, buildCues, countWords, creditGate, findCli, fingerprint, joinWavs, log, main, num,
  parseArgs, preflight, readJson, readWav, renderLine, round3, slug, takeProblem, takesDirection, timePhrases,
  timeWords, toSrt, writeJson,
} from './vois-voice.mjs';

const HELP = `Usage: node voiceover.mjs (--script SCRIPT.md | --scenes scenes.json) [options]
  --project DIR      HyperFrames project root (default: current folder)
  --out DIR          output folder in the project (default: assets/voiceover)
  --fps N            frame rate to snap the times to (default: 30)
  --voice ID         voice ID from: vois-cli voice list --source all --format json
  --engine ID        fast | expressive | multilingual | omni | sonic | craft (default: expressive)
  --language NAME    for example English (default: English)
  --speed N          0.5 to 2.0 (default: 1)
  --lead S           silence before each line in its scene (default: 0.25)
  --tail S           silence after each line in its scene (default: 0.5)
  --offset S         composition time of the first scene (default: 0)
  --track N          data-track-index of the voice clips (default: 3)
  --tries N          takes to try when a take looks wrong (default: 2)
  --only a,b         render only these line ids
  --force            render again even when nothing changed
  --dry-run          show the plan, render nothing
  --use-credits      allow a run that uses export credits (Free plan)
  --cli PATH         path to vois-cli`;

const VOICE_ID = /\b((?:[a-z0-9_]+\/[a-z0-9_]+)|(?:sonic_[a-z]+)|(?:cloned_[a-z0-9_]+)|(?:designed_[a-z0-9_]+))\b/;
const ENGINE = /\b(fast|expressive|multilingual|omni|sonic|craft)\b/i;

// Reads the HyperFrames SCRIPT.md shape: a header with **Voice:** and **Voice direction:**,
// then "## Line N — <label> (Frame N)" sections with **Delivery:** and an indented spoken block.
function readScriptMd(file) {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  const top = {};
  const scenes = [];
  let cur = null;
  for (const line of lines) {
    const h = line.match(/^##\s+Line\s+(\d+)\s*[—–-]?\s*(.*?)\s*(?:\(Frame\s+([^)]+)\))?\s*$/i);
    if (h) {
      cur = { n: Number(h[1]), label: h[2] || '', frame: h[3] || null, spoken: [] };
      scenes.push(cur);
      continue;
    }
    const field = line.match(/^\*\*(Voice|Voice direction|Delivery|Time):\*\*\s*(.*)$/i);
    if (field) {
      const [, key, value] = field;
      const k = key.toLowerCase();
      if (!cur && k === 'voice') {
        const id = value.match(VOICE_ID);
        const engine = value.match(ENGINE);
        if (id) top.voice = id[1];
        else log(`NOTE: **Voice:** "${value}" has no Vois Studio voice ID. Give --voice, or write the ID in SCRIPT.md.`);
        if (engine) top.engine = engine[1].toLowerCase();
      } else if (!cur && k === 'voice direction') top.instruct = value.trim();
      else if (cur && k === 'delivery') cur.instruct = value.trim();
      else if (cur && k === 'time') {
        const t = value.match(/([\d.]+)\s*[–-]\s*([\d.]+)/);
        if (t) cur.guideSeconds = round3(Number(t[2]) - Number(t[1]));
      }
      continue;
    }
    if (cur && /^( {4}|\t)\S/.test(line)) cur.spoken.push(line.trim());
  }
  const out = scenes.filter((s) => s.spoken.length).map((s) => ({
    id: `l${String(s.n).padStart(2, '0')}${s.label ? `-${slug(s.label).slice(0, 24)}` : ''}`,
    text: s.spoken.join(' '),
    instruct: s.instruct ?? null,
    frame: s.frame,
    guideSeconds: s.guideSeconds ?? null,
  }));
  return { ...top, scenes: out };
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

main(() => {
  const a = parseArgs(process.argv.slice(2), ['force', 'dry-run', 'use-credits', 'help']);
  if (a.help || (!a.scenes && !a.script)) { log(HELP); return a.help ? 0 : 64; }

  const project = resolve(a.project ?? '.');
  let doc;
  if (a.script) {
    const p = resolve(project, a.script);
    if (!existsSync(p)) throw new VoisError(`SCRIPT.md not found: ${p}`, 4);
    doc = readScriptMd(p);
  } else {
    doc = readJson(resolve(a.scenes));
    if (doc === undefined) throw new VoisError(`Scenes file not found: ${a.scenes}`, 4);
  }
  const list = Array.isArray(doc) ? doc : doc.scenes;
  const top = Array.isArray(doc) ? {} : doc;
  if (!Array.isArray(list) || !list.length) throw new VoisError('No lines found. SCRIPT.md needs "## Line N" sections with an indented spoken block.', 3);

  const pick = (k, d) => a[k] ?? top[k] ?? d;
  const fps = num(pick('fps'), 30);
  const outDir = resolve(project, pick('out', join('assets', 'voiceover')));
  const base = {
    voice: pick('voice'),
    engine: pick('engine', 'expressive'),
    language: pick('language', 'English'),
    speed: num(pick('speed'), 1),
    lead: num(pick('lead'), 0.25),
    tail: num(pick('tail'), 0.5),
    instruct: top.instruct ?? null,
  };
  const offset = num(pick('offset'), 0);
  const track = num(pick('track'), 3);
  const tries = Math.max(1, num(a.tries, 2));
  const only = a.only ? new Set(String(a.only).split(',')) : null;
  const snap = (t) => Math.round(t * fps) / fps;
  const ceilFrame = (t) => Math.ceil(t * fps - 1e-6) / fps;

  const seen = new Set();
  const scenes = list.map((s, i) => {
    if (!s || typeof s.text !== 'string' || !s.text.trim()) throw new VoisError(`Line ${i + 1} has no text.`, 3);
    const id = String(s.id ?? `l${String(i + 1).padStart(2, '0')}`);
    if (!/^[a-z0-9][a-z0-9_-]*$/i.test(id)) throw new VoisError(`Line id "${id}" must use only letters, digits, - and _.`, 3);
    if (seen.has(id)) throw new VoisError(`Line id "${id}" is used two times.`, 3);
    seen.add(id);
    const sc = {
      id,
      text: s.text.trim(),
      say: typeof s.say === 'string' && s.say.trim() ? s.say.trim() : null,
      instruct: s.instruct ?? s.direction ?? base.instruct ?? null,
      voice: s.voice ?? base.voice ?? null,
      engine: s.engine ?? base.engine,
      language: s.language ?? base.language,
      speed: num(s.speed, base.speed),
      seed: s.seed ?? null,
      lead: num(s.lead, base.lead),
      tail: num(s.tail, base.tail),
      minSeconds: num(s.minSeconds, 0),
      frame: s.frame ?? null,
      guideSeconds: s.guideSeconds ?? null,
    };
    sc.spoken = sc.say ?? sc.text;
    // Only Omni and Craft act on a direction. Leave it out of the key for the others.
    if (!takesDirection(sc.engine)) {
      if (s.instruct || s.direction) log(`NOTE: line ${id}: ${sc.engine} ignores the direction. Use --engine omni or craft (Pro) to act on it.`);
      sc.instruct = null;
    }
    if (/\[[^\]]+\]/.test(sc.spoken) && sc.engine !== 'expressive') log(`NOTE: line ${id}: ${sc.engine} does not act on bracket tags. Remove them.`);
    sc.file = join(outDir, `${id}.wav`);
    sc.key = fingerprint({ t: sc.spoken, v: sc.voice, e: sc.engine, l: sc.language, s: sc.speed, i: sc.instruct, seed: sc.seed });
    return sc;
  });

  const manifestPath = join(outDir, 'voiceover.json');
  const old = readJson(manifestPath, { lines: [] });
  const oldById = new Map((old.lines || []).map((s) => [s.id, s]));
  const todo = scenes.filter((s) => {
    if (only && !only.has(s.id)) return false;
    const prev = oldById.get(s.id);
    return a.force || !existsSync(s.file) || !prev || prev.key !== s.key;
  });
  const missing = scenes.filter((s) => !todo.includes(s) && !existsSync(s.file));
  if (missing.length) throw new VoisError(`No WAV yet for: ${missing.map((s) => s.id).join(', ')}. Run without --only.`, 4);

  log(`${scenes.length} lines, ${todo.length} to render, engine ${base.engine}, voice ${base.voice ?? '(engine default)'}`);
  if (a['dry-run']) {
    for (const s of scenes) log(`  ${todo.includes(s) ? 'render' : 'keep  '}  ${s.id}  ~${(countWords(s.spoken) / 2.5).toFixed(1)} s  "${s.spoken.slice(0, 60)}"`);
    return 0;
  }

  if (todo.length) {
    const cli = findCli(a.cli);
    const status = preflight(cli);
    creditGate(status, todo.length, a['use-credits']);
    for (const s of todo) {
      for (let t = 1; t <= tries; t++) {
        // A retake needs a new seed, or the same audio can come back.
        const seed = t === 1 ? s.seed : Math.floor(Math.random() * 2 ** 31);
        const tmp = join(outDir, `${s.id}.take${t}.wav`);
        log(`render ${s.id} (take ${t})`);
        const res = renderLine(cli, { ...s, text: s.spoken, out: tmp, seed });
        const problem = takeProblem(s.spoken, analyseSpeech(readWav(tmp)));
        if (problem && t < tries) { log(`  ${problem}: one more take`); rmSync(tmp, { force: true }); continue; }
        if (problem) log(`  WARNING: ${problem}. Listen to ${s.id}.wav before you use it.`);
        renameSync(tmp, s.file);
        s.seedUsed = seed;
        s.engineUsed = res.engine_used ?? s.engine;
        break;
      }
    }
  }

  // Build the timeline in seconds. Scene edges sit on whole frames.
  let at = snap(offset);
  const parts = offset > 0 ? [{ silence: snap(offset) }] : [];
  const words = [];
  const outLines = scenes.map((s) => {
    const wav = readWav(s.file);
    const an = analyseSpeech(wav);
    const lead = snap(s.lead);
    const clip = ceilFrame(wav.duration);
    const sceneDuration = Math.max(ceilFrame(lead + clip + s.tail), ceilFrame(s.minSeconds));
    const start = round3(at + lead);
    parts.push({ silence: lead }, { wav }, { silence: sceneDuration - lead - wav.duration });
    words.push(...timePhrases(s.text, an, start).flatMap(timeWords));
    const prev = oldById.get(s.id) || {};
    const entry = {
      id: s.id,
      src: relative(project, s.file).split(sep).join('/'),
      text: s.text,
      say: s.say,
      frame: s.frame,
      sceneStart: round3(at),
      sceneDuration: round3(sceneDuration),
      start,
      duration: round3(clip),
      fileSeconds: round3(wav.duration),
      speechStart: round3(an.start),
      speechEnd: round3(an.end),
      guideSeconds: s.guideSeconds,
      voice: s.voice,
      engine: s.engineUsed ?? prev.engine ?? s.engine,
      language: s.language,
      speed: s.speed,
      instruct: s.instruct,
      seed: s.seedUsed !== undefined ? s.seedUsed : prev.seed ?? s.seed,
      key: s.key,
    };
    at = round3(at + sceneDuration);
    return entry;
  });

  const total = round3(at);
  const narration = joinWavs(join(outDir, 'narration.wav'), parts);
  const srtPath = join(outDir, 'narration.srt');
  writeFileSync(srtPath, toSrt(buildCues(words, { maxChars: 42, maxLines: 2 })));
  const wordsPath = join(outDir, 'narration.words.json');
  writeJson(wordsPath, words.map((w, i) => ({ id: `w${i}`, text: w.text, start: w.start, end: w.end })));

  const html = [
    '<!-- Vois Studio voiceover: one clip for each line. Paste inside the root composition. -->',
    ...outLines.map((l) => `<audio id="vo-${l.id}" src="${esc(l.src)}" data-start="${l.start}" data-duration="${l.duration}" data-track-index="${track}" data-volume="1" data-audio-group="voiceover"></audio>`),
  ].join('\n') + '\n';
  writeFileSync(join(outDir, 'voiceover.html'), html);

  writeJson(manifestPath, {
    generator: 'vois-studio hyperframes-voiceover',
    fps,
    offset: snap(offset),
    totalSeconds: total,
    narration: relative(project, narration.file).split(sep).join('/'),
    words: relative(project, wordsPath).split(sep).join('/'),
    captions: relative(project, srtPath).split(sep).join('/'),
    captionsNote: 'narration.words.json and narration.srt are estimates from pauses and syllables. For measured word times, run hyperframes transcribe on narration.wav.',
    lines: outLines,
  });

  if (Math.abs(narration.duration - total) > 0.01) log(`WARNING: narration.wav is ${narration.duration.toFixed(3)} s, the timeline is ${total} s.`);
  log('');
  log('line                     start   clip s   scene start   scene s   guide s');
  for (const l of outLines) {
    log(`${l.id.padEnd(24)} ${l.start.toFixed(3).padStart(6)}   ${l.duration.toFixed(3).padStart(6)}   ${l.sceneStart.toFixed(3).padStart(11)}   ${l.sceneDuration.toFixed(3).padStart(7)}   ${l.guideSeconds === null ? '      -' : String(l.guideSeconds).padStart(7)}`);
  }
  log(`root data-duration: ${total}`);
  log(`clips:     ${join(outDir, 'voiceover.html')}`);
  log(`manifest:  ${manifestPath}`);
  log(`narration: ${narration.file}`);
  log(`words:     ${wordsPath}`);
  log(`captions:  ${srtPath}`);
  process.stdout.write(JSON.stringify({ manifest: manifestPath, totalSeconds: total, lines: outLines.length }) + '\n');
  return 0;
});
