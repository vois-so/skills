#!/usr/bin/env node
// audio-qa.mjs - checks generated speech before delivery: transcript, word error rate, clipping,
// silence, length and loudness. Optionally makes retakes with a new seed and normalizes loudness.
// MIT License. Copyright (c) 2026 Vois Studio. https://github.com/vois-so/skills
//
// Usage:
//   node audio-qa.mjs <manifest.json> [options]
//   node audio-qa.mjs <file.wav> [<file.wav> ...] [options]        (signal checks only, no text)
//
// manifest.json (paths are relative to the manifest):
//   { "language": "English", "engine": "fast", "voice": "narrators_ai_voices/morgan_vale", "seed": 1,
//     "lines": [ { "id": "l1", "file": "l1.wav", "text": "The spoken text of the line." } ] }
//   A line can override engine, voice, language, seed, speed and instruct.
//
// Options:
//   --report <file.json>        write the full report as JSON
//   --asr auto|whisper|whisper-cli|none   speech-to-text tool (default auto: the first one found)
//   --asr-model <name>          model for `whisper` (default base.en for English, base for others)
//   --whisper-cpp-model <path>  model file for whisper-cli (or env WHISPER_CPP_MODEL). Without it, the
//                               script looks in ~/.cache/whisper for a base, small or tiny model file
//   --max-wer <0..1>            highest word error rate that passes (default 0.15)
//   --retake                    make a new take with a new seed when a line fails (needs vois-cli)
//   --tries <n>                 takes per line in total, the first take included (default 3, max 5)
//   --keep-best                 with --retake: copy the best take over the line file (the first take
//                               stays as <name>.take1.wav)
//   --target-lufs <n>           loudness target in LUFS (default -16)
//   --true-peak <n>             true-peak ceiling in dBTP (default -1)
//   --normalize-dir <dir>       write a loudness-normalized copy of each file there (needs ffmpeg)
//   --cli <path>                path to vois-cli (default: the standard path for this system)
//
// Exit codes: 0 all lines pass, 1 one or more lines fail, 2 usage error. No npm dependencies.

import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, join, resolve } from 'node:path';

// ---------- arguments ----------
function usage(msg) {
  if (msg) console.error(`audio-qa: ${msg}`);
  console.error('Usage: node audio-qa.mjs <manifest.json | file.wav ...> [--report r.json] [--asr auto|whisper|whisper-cli|none]');
  console.error('       [--max-wer 0.15] [--retake [--tries 3] [--keep-best]] [--target-lufs -16] [--true-peak -1] [--normalize-dir dir]');
  process.exit(2);
}
const opt = { asr: 'auto', maxWer: 0.15, tries: 3, targetLufs: -16, truePeak: -1, retake: false, keepBest: false };
const inputs = [];
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  const next = () => { if (i + 1 >= argv.length) usage(`${a} needs a value`); return argv[++i]; };
  if (a === '--report') opt.report = next();
  else if (a === '--asr') opt.asr = next();
  else if (a === '--asr-model') opt.asrModel = next();
  else if (a === '--whisper-cpp-model') opt.cppModel = next();
  else if (a === '--max-wer') opt.maxWer = Number(next());
  else if (a === '--retake') opt.retake = true;
  else if (a === '--tries') opt.tries = Number(next());
  else if (a === '--keep-best') opt.keepBest = true;
  else if (a === '--target-lufs') opt.targetLufs = Number(next());
  else if (a === '--true-peak') opt.truePeak = Number(next());
  else if (a === '--normalize-dir') opt.normalizeDir = next();
  else if (a === '--cli') opt.cli = next();
  else if (a === '-h' || a === '--help') usage();
  else if (a.startsWith('--')) usage(`unknown option ${a}`);
  else inputs.push(a);
}
if (!inputs.length) usage('give a manifest or WAV files');
if (!['auto', 'whisper', 'whisper-cli', 'none'].includes(opt.asr)) usage('--asr must be auto, whisper, whisper-cli or none');
if (!(opt.maxWer >= 0 && opt.maxWer <= 1)) usage('--max-wer must be 0 to 1');
if (!Number.isInteger(opt.tries) || opt.tries < 1 || opt.tries > 5) usage('--tries must be 1 to 5');
if (!Number.isFinite(opt.targetLufs) || opt.targetLufs > -5 || opt.targetLufs < -40) usage('--target-lufs must be -40 to -5');
if (!Number.isFinite(opt.truePeak) || opt.truePeak > 0 || opt.truePeak < -9) usage('--true-peak must be -9 to 0');

// ---------- manifest ----------
let manifest = { lines: [] };
let baseDir = process.cwd();
if (inputs.length === 1 && extname(inputs[0]).toLowerCase() === '.json') {
  try { manifest = JSON.parse(readFileSync(inputs[0], 'utf8')); } catch (err) { usage(`cannot read ${inputs[0]}: ${err.message}`); }
  baseDir = dirname(resolve(inputs[0]));
  if (!Array.isArray(manifest.lines) || !manifest.lines.length) usage('the manifest has no lines');
} else {
  manifest.lines = inputs.map((f) => ({ id: basename(f, extname(f)), file: resolve(f) }));
}
const lines = manifest.lines.map((l, i) => ({
  ...l,
  id: l.id || `line${i + 1}`,
  file: resolve(baseDir, l.file || `${l.id}.wav`),
  engine: l.engine ?? manifest.engine,
  voice: l.voice ?? manifest.voice,
  language: l.language ?? manifest.language ?? 'English',
  seed: Number(l.seed ?? manifest.seed ?? 1),
  speed: l.speed ?? manifest.speed,
  instruct: l.instruct ?? manifest.instruct,
}));

// ---------- tools ----------
function which(cmd) {
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.split(/\r?\n/)[0].trim() : null;
}
function defaultCli() {
  if (process.platform === 'darwin') return '/Applications/Vois.app/Contents/MacOS/vois-cli';
  if (process.platform === 'win32') return join(process.env.LOCALAPPDATA || '', 'Vois', 'vois-cli.exe');
  return null;
}
// A whisper.cpp model file in a usual folder: the English base model first, then base, small, tiny.
function findCppModel() {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const dirs = [join(home, '.cache', 'whisper'), '/opt/homebrew/share/whisper-cpp/models', '/usr/local/share/whisper-cpp/models'];
  const rank = ['base.en', 'base', 'small.en', 'small', 'tiny.en', 'tiny'];
  let best = null;
  for (const d of dirs) {
    let names = [];
    try { names = readdirSync(d); } catch { continue; }
    for (const n of names) {
      const m = n.match(/^[a-z]+-(base|small|tiny)(\.en)?\.bin$/);
      if (!m) continue;
      const r = rank.indexOf(m[1] + (m[2] || ''));
      if (!best || r < best.r) best = { r, file: join(d, n) };
    }
  }
  return best?.file || null;
}
const ffmpeg = which('ffmpeg');
const tools = { ffmpeg, asr: null, asrPath: null, cppModel: null };
if (opt.asr !== 'none') {
  const want = opt.asr === 'auto' ? ['whisper', 'whisper-cli'] : [opt.asr];
  for (const kind of want) {
    if (kind === 'whisper' && which('whisper')) { tools.asr = 'whisper'; tools.asrPath = which('whisper'); break; }
    if (kind === 'whisper-cli') {
      const bin = which('whisper-cli') || which('whisper-cpp');
      const model = [opt.cppModel, process.env.WHISPER_CPP_MODEL].find((m) => m && existsSync(m)) || findCppModel();
      if (bin && model && ffmpeg) { tools.asr = 'whisper-cli'; tools.asrPath = bin; tools.cppModel = model; break; }
      if (bin && opt.asr === 'whisper-cli') usage(model ? 'whisper-cli needs ffmpeg to make 16 kHz input' : 'give the whisper.cpp model file with --whisper-cpp-model <path>');
    }
  }
  if (!tools.asr && opt.asr !== 'auto') usage(`${opt.asr} is not installed`);
}
const cli = opt.cli || defaultCli();
if (opt.retake && (!cli || !existsSync(cli))) usage(`--retake needs vois-cli. It is not at ${cli}. Give --cli <path>.`);
if (opt.normalizeDir && !ffmpeg) usage('--normalize-dir needs ffmpeg');

// ---------- WAV reading and signal checks ----------
function readWav(file) {
  const b = readFileSync(file);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') throw new Error('not a RIFF WAVE file');
  let pos = 12; let fmt = null; let data = null;
  while (pos + 8 <= b.length) {
    const id = b.toString('ascii', pos, pos + 4);
    let size = b.readUInt32LE(pos + 4);
    const body = pos + 8;
    if (id === 'data' && (size === 0xffffffff || body + size > b.length)) size = b.length - body;
    if (id === 'fmt ') {
      let format = b.readUInt16LE(body);
      if (format === 0xfffe && size >= 26) format = b.readUInt16LE(body + 24);
      fmt = { format, channels: b.readUInt16LE(body + 2), rate: b.readUInt32LE(body + 4), bits: b.readUInt16LE(body + 14) };
    } else if (id === 'data') data = { start: body, size };
    pos = body + size + (size % 2);
  }
  if (!fmt || !data) throw new Error('no fmt or data chunk');
  const { format, channels, rate, bits } = fmt;
  const bytes = bits / 8;
  const frames = Math.floor(data.size / (bytes * channels));
  const read = format === 3 && bits === 32 ? (o) => b.readFloatLE(o)
    : format === 3 && bits === 64 ? (o) => b.readDoubleLE(o)
    : format === 1 && bits === 16 ? (o) => b.readInt16LE(o) / 32768
    : format === 1 && bits === 24 ? (o) => b.readIntLE(o, 3) / 8388608
    : format === 1 && bits === 32 ? (o) => b.readInt32LE(o) / 2147483648
    : format === 1 && bits === 8 ? (o) => (b.readUInt8(o) - 128) / 128
    : null;
  if (!read) throw new Error(`unsupported WAV format ${format} with ${bits} bits`);
  const mono = new Float32Array(frames);
  let peak = 0; let clipped = 0; let clipRun = 0; let longestClipRun = 0; let bad = 0;
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) {
      const v = read(data.start + (f * channels + c) * bytes);
      if (!Number.isFinite(v)) { bad++; continue; }
      const a = Math.abs(v);
      if (a > peak) peak = a;
      if (a >= 0.999) { clipped++; clipRun++; if (clipRun > longestClipRun) longestClipRun = clipRun; } else clipRun = 0;
      sum += v;
    }
    mono[f] = sum / channels;
  }
  return { rate, channels, bits, format: format === 3 ? 'float' : 'pcm', frames, duration: frames / rate, mono, peak, clipped, longestClipRun, bad };
}

const db = (x) => (x > 0 ? 20 * Math.log10(x) : -Infinity);
function signal(w) {
  const win = Math.max(1, Math.round(w.rate * 0.02)); // 20 ms windows
  const levels = [];
  let total = 0;
  for (let s = 0; s < w.frames; s += win) {
    let e = 0; const end = Math.min(w.frames, s + win);
    for (let i = s; i < end; i++) e += w.mono[i] * w.mono[i];
    total += e;
    levels.push(db(Math.sqrt(e / (end - s))));
  }
  const rms = db(Math.sqrt(total / Math.max(1, w.frames)));
  const SILENT = -50; const SPEECH = -40;
  const active = levels.filter((l) => l > SPEECH).length * 0.02;
  let lead = 0; while (lead < levels.length && levels[lead] <= SILENT) lead++;
  let trail = 0; while (trail < levels.length - lead && levels[levels.length - 1 - trail] <= SILENT) trail++;
  let gap = 0; let run = 0;
  for (let i = lead; i < levels.length - trail; i++) { if (levels[i] <= SILENT) { run++; if (run > gap) gap = run; } else run = 0; }
  return { rms_dbfs: round(rms, 1), peak_dbfs: round(db(w.peak), 2), speech_secs: round(active, 2), lead_silence_secs: round(lead * 0.02, 2), trail_silence_secs: round(trail * 0.02, 2), longest_gap_secs: round(gap * 0.02, 2) };
}
const round = (x, d) => (Number.isFinite(x) ? Number(x.toFixed(d)) : x === -Infinity ? null : x);

// ---------- loudness (ffmpeg) ----------
function measureLoudness(file) {
  if (!ffmpeg) return null;
  const r = spawnSync(ffmpeg, ['-hide_banner', '-nostats', '-i', file, '-af', `loudnorm=I=${opt.targetLufs}:TP=${opt.truePeak}:LRA=11:print_format=json`, '-f', 'null', '-'], { encoding: 'utf8' });
  const m = (r.stderr || '').match(/\{[\s\S]*?"target_offset"[\s\S]*?\}/);
  if (!m) return null;
  const j = JSON.parse(m[0]);
  return { lufs: Number(j.input_i), true_peak_dbtp: Number(j.input_tp), lra: Number(j.input_lra), thresh: Number(j.input_thresh), offset: Number(j.target_offset) };
}
function normalize(file, outFile, meas, rate, channels) {
  const filter = `loudnorm=I=${opt.targetLufs}:TP=${opt.truePeak}:LRA=11:measured_I=${meas.lufs}:measured_TP=${meas.true_peak_dbtp}:measured_LRA=${meas.lra}:measured_thresh=${meas.thresh}:offset=${meas.offset}:linear=true:print_format=json`;
  const r = spawnSync(ffmpeg, ['-hide_banner', '-nostats', '-y', '-i', file, '-af', filter, '-ar', String(rate), '-ac', String(channels), '-c:a', 'pcm_s16le', outFile], { encoding: 'utf8' });
  const m = (r.stderr || '').match(/\{[\s\S]*?"normalization_type"[\s\S]*?\}/);
  if (r.status !== 0) return { error: (r.stderr || '').split('\n').slice(-3).join(' ') };
  return { file: outFile, type: m ? JSON.parse(m[0]).normalization_type : null, after: measureLoudness(outFile) };
}

// ---------- transcript and word error rate ----------
const LANG = { english: 'en', german: 'de', spanish: 'es', french: 'fr', italian: 'it', portuguese: 'pt', dutch: 'nl', japanese: 'ja', chinese: 'zh', korean: 'ko', hindi: 'hi', arabic: 'ar', russian: 'ru', polish: 'pl', turkish: 'tr', swedish: 'sv', danish: 'da', norwegian: 'no', finnish: 'fi', greek: 'el', hebrew: 'he', malay: 'ms', swahili: 'sw', indonesian: 'id', vietnamese: 'vi', thai: 'th', tagalog: 'tl', burmese: 'my', khmer: 'km', lao: 'lo', czech: 'cs', ukrainian: 'uk', romanian: 'ro', hungarian: 'hu', bulgarian: 'bg', croatian: 'hr', slovak: 'sk', slovenian: 'sl', estonian: 'et', latvian: 'lv', lithuanian: 'lt' };
const langCode = (l) => LANG[String(l || '').toLowerCase()] || (String(l || '').length <= 3 ? String(l).toLowerCase() : null);

function transcribe(file, language) {
  if (!tools.asr) return null;
  const code = langCode(language);
  const tmp = mkdtempSync(join(tmpdir(), 'audio-qa-'));
  try {
    if (tools.asr === 'whisper') {
      const model = opt.asrModel || (code === 'en' ? 'base.en' : 'base');
      const args = [file, '--model', model, '--output_format', 'txt', '--output_dir', tmp, '--fp16', 'False', '--verbose', 'False', '--condition_on_previous_text', 'False'];
      if (code) args.push('--language', code);
      const r = spawnSync(tools.asrPath, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
      const out = join(tmp, `${basename(file, extname(file))}.txt`);
      if (r.status !== 0 || !existsSync(out)) return { error: (r.stderr || 'whisper failed').trim().split('\n').slice(-2).join(' ') };
      return { text: readFileSync(out, 'utf8').replace(/\s+/g, ' ').trim() };
    }
    // whisper.cpp wants 16 kHz mono 16-bit input.
    const wav16 = join(tmp, 'in16k.wav');
    const c = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', file, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', wav16]);
    if (c.status !== 0) return { error: 'ffmpeg could not make 16 kHz input' };
    const r = spawnSync(tools.asrPath, ['-m', tools.cppModel, '-f', wav16, '-l', code || 'auto', '-otxt', '-of', join(tmp, 'out'), '-nt', '-np'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const out = join(tmp, 'out.txt');
    if (r.status !== 0 || !existsSync(out)) return { error: (r.stderr || 'whisper-cli failed').trim().split('\n').slice(-2).join(' ') };
    return { text: readFileSync(out, 'utf8').replace(/\s+/g, ' ').trim() };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
function under1000(n) {
  const out = [];
  if (n >= 100) { out.push(ONES[Math.floor(n / 100)], 'hundred'); n %= 100; }
  if (n >= 20) { out.push(TENS[Math.floor(n / 10)]); n %= 10; if (n) out.push(ONES[n]); } else if (n || !out.length) out.push(ONES[n]);
  return out;
}
function cardinal(n) {
  if (n === 0) return ['zero'];
  const out = [];
  for (const [v, w] of [[1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']]) {
    if (n >= v) { out.push(...under1000(Math.floor(n / v)), w); n %= v; }
  }
  if (n) out.push(...under1000(n));
  return out;
}
function numberWords(tok) {
  // English spoken forms for digits that a transcript writes: 2024, 15, 10,000, 9.99, 3:30.
  const t = tok.replace(/,/g, '');
  let m;
  if ((m = t.match(/^(\d{1,2}):(\d{2})$/))) return [...cardinal(+m[1]), ...(m[2] === '00' ? [] : +m[2] < 10 ? ['oh', ONES[+m[2]]] : cardinal(+m[2]))];
  if ((m = t.match(/^(\d+)\.(\d+)$/))) return [...cardinal(+m[1]), 'point', ...[...m[2]].map((d) => ONES[+d])];
  if (/^\d{4}$/.test(t) && +t >= 1100 && +t < 2100 && !(+t >= 2000 && +t < 2010) && +t % 100 !== 0) return [...cardinal(Math.floor(+t / 100)), ...(+t % 100 < 10 ? ['oh', ONES[+t % 100]] : cardinal(+t % 100))];
  if (/^\d{1,12}$/.test(t)) return cardinal(+t);
  return [tok];
}
function words(s, english) {
  let t = s.normalize('NFKC').toLowerCase()
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/[$€£](\d[\d,.]*)/g, (x, n) => `${n} ${x[0] === '$' ? 'dollars' : x[0] === '€' ? 'euros' : 'pounds'}`)
    .replace(/(\d)%/g, '$1 percent')
    .replace(/[‐-―-]/g, ' ')
    .replace(/[^\p{L}\p{M}\p{N}':.,\s]/gu, ' ')
    .replace(/(?<!\d)[.,:]|[.,:](?!\d)/g, ' ')
    .replace(/(^|\s)'+|'+(\s|$)/g, ' ');
  let list = t.split(/\s+/).filter(Boolean);
  if (english) list = list.flatMap((w) => (/\d/.test(w) ? numberWords(w) : [w]));
  return list;
}
function cjk(s) { return /[぀-ヿ㐀-鿿가-힯฀-๿က-႟ក-៿຀-໿]/.test(s); }
function wer(ref, hyp) {
  const d = Array.from({ length: ref.length + 1 }, (_, i) => [i, ...Array(hyp.length).fill(0)]);
  for (let j = 1; j <= hyp.length; j++) d[0][j] = j;
  for (let i = 1; i <= ref.length; i++) for (let j = 1; j <= hyp.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (ref[i - 1] === hyp[j - 1] ? 0 : 1));
  }
  return ref.length ? d[ref.length][hyp.length] / ref.length : hyp.length ? 1 : 0;
}
function scoreText(text, heard, language) {
  const english = langCode(language) === 'en';
  if (cjk(text)) {
    const strip = (s) => [...s.replace(/[\s\p{P}]/gu, '')];
    return round(wer(strip(text), strip(heard)), 3);
  }
  return round(wer(words(text, english), words(heard, english)), 3);
}

// ---------- one take ----------
function check(line, file) {
  const r = { file, problems: [], warnings: [] };
  let w;
  try { w = readWav(file); } catch (err) { r.problems.push(`cannot read the WAV: ${err.message}`); return r; }
  Object.assign(r, { duration_secs: round(w.duration, 2), sample_rate: w.rate, channels: w.channels }, signal(w));
  r.clipped_samples = w.clipped;
  if (w.bad) r.problems.push(`${w.bad} samples are not numbers`);
  if (w.longestClipRun >= 3) r.problems.push(`clipping: ${w.clipped} samples at full scale, the longest run is ${w.longestClipRun}`);
  else if (w.clipped) r.warnings.push(`${w.clipped} samples touch full scale`);
  const silent = w.duration < 0.3 || r.speech_secs < 0.3 || (r.rms_dbfs ?? -999) < -45;
  if (silent) r.problems.push(`near silence: ${r.speech_secs} s of speech, level ${r.rms_dbfs === null ? 'no signal' : `${r.rms_dbfs} dBFS`}`);
  else {
    if (r.lead_silence_secs > 1) r.warnings.push(`${r.lead_silence_secs} s of silence at the start`);
    if (r.trail_silence_secs > 1.5) r.warnings.push(`${r.trail_silence_secs} s of silence at the end`);
    if (r.longest_gap_secs > 2) r.warnings.push(`a gap of ${r.longest_gap_secs} s in the speech`);
  }
  if (line.text) {
    const isCjk = cjk(line.text);
    const units = isCjk ? [...line.text.replace(/[\s\p{P}]/gu, '')].length : words(line.text, false).length;
    r.expected_secs = round(isCjk ? units / 4 : (units / 150) * 60, 1);
    const ratio = w.duration / Math.max(0.5, r.expected_secs);
    r.length_ratio = round(ratio, 2);
    if (units >= 4 && (ratio < 0.5 || ratio > 2)) r.warnings.push(`length is ${r.length_ratio} times the estimate: words can be missing or repeated`);
    const asr = transcribe(file, line.language);
    if (asr?.error) r.warnings.push(`transcript: ${asr.error}`);
    else if (asr) {
      r.heard = asr.text;
      r.wer = scoreText(line.text, asr.text, line.language);
      if (r.wer > opt.maxWer) r.problems.push(`word error rate ${r.wer} is more than ${opt.maxWer}`);
    }
  }
  r.loudness = measureLoudness(file);
  r.status = r.problems.length ? 'FAIL' : r.warnings.length ? 'WARN' : 'PASS';
  r.score = (r.wer ?? 0) + r.problems.length;
  return r;
}

function render(line, seed, outFile) {
  const args = ['tts', 'generate', '--format', 'json', '--text', line.text, '--engine', line.engine, '--language', line.language, '--seed', String(seed), '--output', outFile];
  if (line.voice) args.push('--voice', line.voice);
  if (line.speed !== undefined) args.push('--speed', String(line.speed));
  if (line.instruct) args.push('--instruct', line.instruct);
  const r = spawnSync(cli, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  let j = null; try { j = JSON.parse(r.stdout || 'null'); } catch { /* not JSON */ }
  if (r.status === 0 && j && !j.error && existsSync(outFile)) return { ok: true };
  return { ok: false, exit: r.status, error: j?.error?.message || (r.stderr || '').trim() || 'no output file' };
}

// ---------- main ----------
console.log(`audio-qa: ${lines.length} line(s). Transcript tool: ${tools.asr ? `${tools.asr}${tools.cppModel ? ` (model ${basename(tools.cppModel).replace(/^[a-z]+-/, '')})` : ''}` : 'none (length and silence checks only)'}. Loudness: ${ffmpeg ? 'ffmpeg' : 'not measured (no ffmpeg)'}.`);
if (!tools.asr && opt.asr !== 'none') console.log('audio-qa: install whisper or whisper.cpp for the transcript check. See the audio-qa skill.');
const report = { created: new Date().toISOString(), tools: { asr: tools.asr, ffmpeg: Boolean(ffmpeg) }, settings: { max_wer: opt.maxWer, target_lufs: opt.targetLufs, true_peak_dbtp: opt.truePeak }, lines: [] };
if (opt.normalizeDir) mkdirSync(opt.normalizeDir, { recursive: true });

for (const line of lines) {
  if (!existsSync(line.file)) { report.lines.push({ id: line.id, file: line.file, status: 'FAIL', problems: ['the file is not there'], warnings: [] }); continue; }
  const takes = [{ ...check(line, line.file), take: 1, seed: line.seed }];
  const canRetake = opt.retake && line.text && line.engine;
  if (opt.retake && !canRetake) takes[0].warnings.push('no retake: the line has no text or no engine in the manifest');
  for (let t = 2; canRetake && t <= opt.tries && takes.every((k) => k.status === 'FAIL'); t++) {
    const seed = line.seed + (t - 1) * 1000;
    const out = join(dirname(line.file), `${basename(line.file, extname(line.file))}.retake${t}.wav`);
    process.stdout.write(`  ${line.id}: retake ${t} with seed ${seed} ... `);
    const r = render(line, seed, out);
    if (!r.ok) {
      console.log(`stopped, exit ${r.exit}: ${r.error}`);
      takes[takes.length - 1].warnings.push(`retake ${t} stopped: exit ${r.exit}: ${r.error}`);
      if ([2, 7, 8, 11, 12, 13].includes(r.exit)) break;
      continue;
    }
    const k = { ...check(line, out), take: t, seed };
    console.log(`${k.status}${k.wer !== undefined ? `, WER ${k.wer}` : ''}`);
    takes.push(k);
  }
  const best = takes.reduce((a, b) => (b.score < a.score ? b : a));
  const entry = { id: line.id, text: line.text, ...best, best_take: best.take, takes: takes.map(({ take, seed, file, status, wer, heard }) => ({ take, seed, file, status, wer, heard })) };
  if (opt.keepBest && best.take > 1) {
    const first = join(dirname(line.file), `${basename(line.file, extname(line.file))}.take1.wav`);
    copyFileSync(line.file, first);
    copyFileSync(best.file, line.file);
    entry.kept = { file: line.file, from: best.file, first_take_saved_as: first };
  }
  if (opt.normalizeDir && entry.loudness && Number.isFinite(entry.loudness.lufs)) {
    const src = entry.kept ? line.file : best.file;
    entry.normalized = normalize(src, join(opt.normalizeDir, basename(line.file)), entry.loudness, entry.sample_rate, entry.channels);
  }
  report.lines.push(entry);
}

// ---------- output ----------
const pad = (s, n) => String(s ?? '-').padEnd(n);
const num = (x, d = 1) => (typeof x === 'number' && Number.isFinite(x) ? x.toFixed(d) : '-');
console.log('');
console.log(`${pad('LINE', 14)} ${pad('STATUS', 6)} ${pad('TAKE', 4)} ${pad('SECS', 6)} ${pad('PEAK', 6)} ${pad('CLIP', 5)} ${pad('LUFS', 6)} ${pad('dBTP', 6)} ${pad('WER', 5)} NOTES`);
for (const l of report.lines) {
  const notes = [...(l.problems || []), ...(l.warnings || [])].join('; ');
  console.log(`${pad(l.id, 14)} ${pad(l.status, 6)} ${pad(l.best_take, 4)} ${pad(num(l.duration_secs, 2), 6)} ${pad(num(l.peak_dbfs), 6)} ${pad(l.clipped_samples, 5)} ${pad(num(l.loudness?.lufs), 6)} ${pad(num(l.loudness?.true_peak_dbtp), 6)} ${pad(num(l.wer, 2), 5)} ${notes}`);
  if (l.takes?.length > 1) console.log(`${' '.repeat(15)}takes: ${l.takes.map((k) => `${k.take} seed ${k.seed} ${k.status}${k.wer !== undefined ? ` WER ${k.wer}` : ''}`).join(', ')}`);
  if (l.heard !== undefined && (l.wer ?? 0) > 0) console.log(`${' '.repeat(15)}expected: ${l.text}\n${' '.repeat(15)}heard:    ${l.heard}`);
  if (l.normalized) console.log(`${' '.repeat(15)}normalized: ${l.normalized.error ? `error: ${l.normalized.error}` : `${l.normalized.file} -> ${num(l.normalized.after?.lufs)} LUFS, ${num(l.normalized.after?.true_peak_dbtp)} dBTP (${l.normalized.type})`}`);
}
const failed = report.lines.filter((l) => l.status === 'FAIL').length;
const warned = report.lines.filter((l) => l.status === 'WARN').length;
console.log(`\n${report.lines.length - failed - warned} pass, ${warned} warn, ${failed} fail. Loudness target ${opt.targetLufs} LUFS, ${opt.truePeak} dBTP.`);
if (opt.report) { writeFileSync(opt.report, JSON.stringify(report, null, 2) + '\n'); console.log(`Report: ${resolve(opt.report)}`); }
process.exit(failed ? 1 : 0);
