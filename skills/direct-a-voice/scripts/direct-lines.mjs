#!/usr/bin/env node
// direct-lines.mjs - renders each line of a direction plan with Vois Studio (Omni or Craft).
// MIT License. Copyright (c) 2026 Vois Studio. https://github.com/vois-so/skills
//
// Usage:
//   node direct-lines.mjs <plan.json> --out <dir> [--dry-run] [--takes N] [--only id1,id2] [--force] [--cli <path>]
//
// plan.json:
//   {
//     "engine": "omni",                       // omni or craft (the only engines that use --instruct)
//     "voice": "narrators_ai_voices/morgan_vale",
//     "language": "English",
//     "seed": 7,                              // optional, the first seed of each line
//     "speed": 1.0,                           // optional, 0.5 to 2.0
//     "lines": [
//       { "id": "intro-warm", "text": "Welcome back.", "instruct": "warm and relaxed, a smile in the voice" },
//       { "id": "intro-urgent", "text": "Welcome back.", "instruct": "brisk and urgent", "seed": 7 }
//     ]
//   }
//
// Each line becomes <out>/<id>.wav (or <id>.take2.wav and so on with --takes).
// The script writes <out>/directions.json with the result of each take.
// Exit codes: 0 all takes made, 1 one or more takes failed, 2 usage or plan error.
// No npm dependencies. Arguments go to vois-cli as an array, never through a shell.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const MAX_DIRECTION = 2000;
const STOP_CODES = new Map([
  [2, 'Vois Studio is not open. Open it, or start the service with `vois-cli service start`.'],
  [7, 'The plan does not include this engine or command. Omni and Craft need Pro.'],
  [8, 'The quota is empty.'],
  [11, 'Not sufficient free memory for this engine. Close other apps, or use Omni in place of Craft.'],
  [12, 'The engine download stopped. Try `vois-cli model download --model <engine>`.'],
  [13, 'The engine package is not available at this time.'],
]);

function usage(msg) {
  if (msg) console.error(`direct-lines: ${msg}`);
  console.error('Usage: node direct-lines.mjs <plan.json> --out <dir> [--dry-run] [--takes N] [--only a,b] [--force] [--cli <path>]');
  process.exit(2);
}

function defaultCli() {
  if (process.platform === 'darwin') return '/Applications/Vois.app/Contents/MacOS/vois-cli';
  if (process.platform === 'win32') return join(process.env.LOCALAPPDATA || '', 'Vois', 'vois-cli.exe');
  return null;
}

const args = process.argv.slice(2);
let planFile = null;
let out = null;
let dryRun = false;
let takes = 1;
let only = null;
let force = false;
let cli = defaultCli();
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--out') out = args[++i];
  else if (a === '--dry-run') dryRun = true;
  else if (a === '--takes') takes = Number(args[++i]);
  else if (a === '--only') only = new Set((args[++i] || '').split(',').filter(Boolean));
  else if (a === '--force') force = true;
  else if (a === '--cli') cli = args[++i];
  else if (a === '-h' || a === '--help') usage();
  else if (a.startsWith('-')) usage(`unknown option ${a}`);
  else planFile = a;
}
if (!planFile) usage('give a plan file');
if (!out) usage('give --out <dir>');
if (!Number.isInteger(takes) || takes < 1 || takes > 5) usage('--takes must be 1 to 5');
if (!cli) usage('give --cli <path to vois-cli> on this system');

let plan;
try {
  plan = JSON.parse(readFileSync(planFile, 'utf8'));
} catch (err) {
  usage(`cannot read ${planFile}: ${err.message}`);
}

// Validate the full plan before the first render.
const problems = [];
const engine = String(plan.engine || '').toLowerCase();
if (!['omni', 'craft'].includes(engine)) problems.push(`engine "${plan.engine}": only omni and craft use --instruct. For other engines, see the fallback section of the skill.`);
if (!plan.voice) problems.push('voice is missing. Get an ID from `vois-cli voice list --engine omni --format json`.');
if (!plan.language || String(plan.language).toLowerCase() === 'auto') problems.push('language is missing. Give a language name, for example English.');
if (!Array.isArray(plan.lines) || plan.lines.length === 0) problems.push('lines is empty.');
const ids = new Set();
for (const [n, line] of (plan.lines || []).entries()) {
  const where = `lines[${n}]${line.id ? ` (${line.id})` : ''}`;
  if (!line.id || !/^[A-Za-z0-9._-]+$/.test(line.id)) problems.push(`${where}: id must use only letters, digits, dot, hyphen and underscore.`);
  if (ids.has(line.id)) problems.push(`${where}: id is used two times.`);
  ids.add(line.id);
  if (!line.text || !String(line.text).trim()) problems.push(`${where}: text is empty.`);
  if (/\[[^\]]*\]/.test(line.text || '')) problems.push(`${where}: text has a bracket tag. Omni and Craft remove it. Put the emotion in the words and the direction.`);
  const d = line.instruct ?? plan.instruct;
  if (!d || !String(d).trim()) problems.push(`${where}: instruct is empty.`);
  else {
    if (String(d).length >= MAX_DIRECTION) problems.push(`${where}: instruct has ${String(d).length} characters. Keep it under ${MAX_DIRECTION}.`);
    if (/[()[\]]/.test(d)) problems.push(`${where}: instruct has a bracket or a parenthesis. Remove it.`);
  }
  const speed = line.speed ?? plan.speed;
  if (speed !== undefined && !(speed >= 0.5 && speed <= 2)) problems.push(`${where}: speed must be 0.5 to 2.0.`);
}
if (problems.length) {
  for (const p of problems) console.error(`PLAN ERROR ${p}`);
  process.exit(2);
}

if (!dryRun) {
  if (!existsSync(cli)) usage(`vois-cli is not at ${cli}. Give the path with --cli.`);
  mkdirSync(out, { recursive: true });
}

const results = [];
let failed = 0;
outer: for (const line of plan.lines) {
  if (only && !only.has(line.id)) continue;
  const baseSeed = Number(line.seed ?? plan.seed ?? 1);
  for (let t = 0; t < takes; t++) {
    const seed = baseSeed + t * 1000;
    const file = resolve(out, t === 0 ? `${line.id}.wav` : `${line.id}.take${t + 1}.wav`);
    const argv = ['tts', 'generate', '--format', 'json', '--text', String(line.text), '--engine', engine,
      '--voice', String(line.voice ?? plan.voice), '--language', String(line.language ?? plan.language),
      '--instruct', String(line.instruct ?? plan.instruct), '--seed', String(seed), '--output', file];
    const speed = line.speed ?? plan.speed;
    if (speed !== undefined) argv.push('--speed', String(speed));
    if (dryRun) {
      console.log([cli, ...argv.map((a) => (/[\s"'$`\\]/.test(a) ? JSON.stringify(a) : a))].join(' '));
      results.push({ id: line.id, take: t + 1, seed, file, instruct: line.instruct ?? plan.instruct, dry_run: true });
      continue;
    }
    if (existsSync(file) && !force) {
      console.log(`SKIP ${line.id} take ${t + 1}: ${file} is there. Use --force to make it again.`);
      results.push({ id: line.id, take: t + 1, seed, file, skipped: true });
      continue;
    }
    const started = Date.now();
    const run = spawnSync(cli, argv, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    let json = null;
    try { json = JSON.parse(run.stdout || 'null'); } catch { /* not JSON */ }
    const ok = run.status === 0 && json && !json.error && existsSync(file);
    const entry = {
      id: line.id, take: t + 1, seed, file, instruct: line.instruct ?? plan.instruct,
      ok, exit_code: run.status, seconds: Number(((Date.now() - started) / 1000).toFixed(1)),
      duration_secs: json?.duration_secs ?? null, engine_used: json?.engine_used ?? null,
      error: ok ? null : (json?.error?.message || (run.stderr || run.error?.message || '').trim() || 'no output file'),
    };
    results.push(entry);
    if (ok) {
      console.log(`OK   ${line.id} take ${entry.take} seed ${seed}: ${entry.duration_secs?.toFixed?.(2) ?? '?'} s, ${entry.engine_used} -> ${file}`);
    } else {
      failed++;
      console.log(`FAIL ${line.id} take ${entry.take} seed ${seed}: exit ${run.status}: ${entry.error}`);
      if (STOP_CODES.has(run.status)) {
        console.error(`STOP ${STOP_CODES.get(run.status)}`);
        break outer;
      }
    }
  }
}

if (!dryRun) {
  writeFileSync(join(out, 'directions.json'), JSON.stringify({ engine, voice: plan.voice, language: plan.language, results }, null, 2) + '\n');
  console.log(`\n${results.filter((r) => r.ok).length} take(s) made, ${failed} failed. Summary: ${join(out, 'directions.json')}`);
}
process.exit(failed ? 1 : 0);
