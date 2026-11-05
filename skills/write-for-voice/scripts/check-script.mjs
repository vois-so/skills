#!/usr/bin/env node
// check-script.mjs - checks a Vois Studio script for text that a voice reads badly.
// MIT License. Copyright (c) 2026 Vois Studio. https://github.com/vois-so/skills
//
// Usage:
//   node check-script.mjs <script.txt> [--engine fast|expressive|multilingual|omni|sonic|craft] [--json]
//   node check-script.mjs <script.txt> --engine fast --spoken   > spoken.txt
//
// --spoken prints the text for one direct `vois-cli tts generate` call: speaker tags and
// pause tokens removed, and reaction tags removed unless the engine is Expressive.
// Exit codes: 0 no errors, 1 one or more errors, 2 usage error. No npm dependencies.

import { readFileSync } from 'node:fs';

const ENGINES = ['fast', 'expressive', 'multilingual', 'omni', 'sonic', 'craft'];
const REACTIONS = ['laugh', 'chuckle', 'gasp', 'sigh', 'groan', 'cough', 'clear throat', 'sniff', 'shush'];
const MAX_WORDS = 20;
const WPM = 150;

function usage(msg) {
  if (msg) console.error(`check-script: ${msg}`);
  console.error('Usage: node check-script.mjs <script.txt> [--engine <id>] [--json] [--spoken]');
  process.exit(2);
}

const args = process.argv.slice(2);
let file = null;
let engine = null;
let json = false;
let spoken = false;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--engine') engine = (args[++i] || '').toLowerCase();
  else if (a.startsWith('--engine=')) engine = a.slice(9).toLowerCase();
  else if (a === '--json') json = true;
  else if (a === '--spoken') spoken = true;
  else if (a === '-h' || a === '--help') usage();
  else if (a.startsWith('-') && a !== '-') usage(`unknown option ${a}`);
  else file = a;
}
if (!file) usage('give a script file, or - for stdin');
if (engine && !ENGINES.includes(engine)) usage(`unknown engine "${engine}" (use ${ENGINES.join(', ')})`);

let text;
try {
  text = readFileSync(file === '-' ? 0 : file, 'utf8');
} catch (err) {
  usage(`cannot read ${file}: ${err.message}`);
}

const lines = text.replace(/\r\n?/g, '\n').split('\n');
const findings = [];
const add = (line, level, rule, detail) => findings.push({ line, level, rule, detail });

const SPEAKER = /^\s*\[([^\]=]+)\]:\s*/;
const BARE_SPEAKER = /^\s*([A-Z][A-Za-z .'-]{0,30}):\s+\S/;
const TAG = /\[([^\]]+)\]/g;

let lastSpeaker = null;
let sawSpeaker = false;
let words = 0;
const spokenOut = [];

lines.forEach((raw, idx) => {
  const n = idx + 1;
  if (!raw.trim()) { spokenOut.push(''); return; }
  let body = raw;

  const sp = body.match(SPEAKER);
  if (sp) {
    const name = sp[1].trim();
    if (REACTIONS.includes(name.toLowerCase())) {
      // A reaction tag at the start of a line, not a speaker.
    } else {
      if (name === lastSpeaker) add(n, 'warning', 'repeat-speaker', `[${name}] speaks on the line before also. Remove the second tag.`);
      lastSpeaker = name;
      sawSpeaker = true;
      body = body.slice(sp[0].length);
    }
  } else if (BARE_SPEAKER.test(body) && !/^\s*(Note|Tip|Warning|Step \d+)\b/.test(body)) {
    add(n, 'error', 'speaker-format', `"${body.match(BARE_SPEAKER)[1]}:" is not a speaker tag. Write [${body.match(BARE_SPEAKER)[1]}]: instead.`);
  }
  if (!sawSpeaker && n === lines.findIndex((l) => l.trim()) + 1) {
    add(n, 'warning', 'no-speaker', 'The script does not start with a speaker tag. Add [Narrator]: or the name of the speaker.');
  }

  // Tags inside the line.
  for (const m of body.matchAll(TAG)) {
    const inner = m[1].trim();
    const pause = inner.match(/^pause=(\d+)$/i);
    if (pause) {
      const ms = Number(pause[1]);
      if (ms < 300 || ms > 3000) add(n, 'error', 'pause-range', `[pause=${ms}] is outside 300 to 3000 ms.`);
      continue;
    }
    if (REACTIONS.includes(inner.toLowerCase())) {
      if (engine && engine !== 'expressive') add(n, 'warning', 'reaction-tag', `[${inner}] has no effect on ${engine}. Only Expressive uses it. Put the emotion in the words.`);
      continue;
    }
    if (body[m.index + m[0].length] === ':') {
      // A second speaker in the same line: [Host]: Hi. [Guest]: Hello.
      if (inner === lastSpeaker) add(n, 'warning', 'repeat-speaker', `[${inner}] already speaks here. Remove the second tag.`);
      lastSpeaker = inner;
      continue;
    }
    add(n, 'error', 'unknown-tag', `[${inner}] is not a tag that any engine uses. Remove it and put the meaning in the words.`);
  }

  // Remove tags for the text checks.
  const plain = body.replace(TAG, ' ').replace(/\s+/g, ' ').trim();

  if (/^\s*(#{1,6}\s|[-*+]\s|\d+[.)]\s|>\s)/.test(body)) add(n, 'error', 'markdown', 'The line starts with a Markdown mark (heading, bullet, number or quote). Change it into a sentence.');
  if (/\*\*|__|`|\|.*\|/.test(plain)) add(n, 'error', 'markdown', 'The line has Markdown marks (bold, code or a table). Remove them.');
  if (/https?:\/\/|www\.|\b[\w.-]+@[\w-]+\.\w+/i.test(plain)) add(n, 'error', 'url', 'The line has a URL or an email address. Say what the listener needs, in words.');
  if (/(^|\s)(\/|~\/|\.\/)[\w./-]+|\b\w+\.(js|ts|py|json|md|txt|csv|wav|mp3|exe|sh)\b/i.test(plain)) add(n, 'warning', 'path', 'The line has a file name or a path. Say it in words, or remove it.');
  if (/\d/.test(plain)) add(n, 'error', 'digits', `Digits: "${plain.match(/[^\s]*\d[^\s]*/g).join('", "')}". Write each number as the speaker says it.`);
  const sym = plain.match(/[%&@#$€£¥+=<>*_~^\\{}]|->|=>|\//g);
  if (sym) add(n, 'error', 'symbols', `Symbols: ${[...new Set(sym)].join(' ')}. Write them as words.`);
  if (/\b(e\.g|i\.e|etc|approx|vs|cf|incl)\./i.test(plain)) add(n, 'error', 'abbreviation', 'Written abbreviation (e.g., i.e., etc., approx., vs.). Write the full words.');
  if (/[()]/.test(plain)) add(n, 'warning', 'parentheses', 'Parentheses. A listener cannot hear them. Make a separate sentence, or use commas.');
  const caps = plain.match(/\b[A-Z]{2,}[a-z]?\b/g);
  if (caps) add(n, 'warning', 'acronym', `Acronyms: ${[...new Set(caps)].join(', ')}. Decide: letters with spaces ("A P I") or a word ("NASA"). Expand at first use.`);
  if (/;/.test(plain)) add(n, 'warning', 'semicolon', 'Semicolon. Use a full stop and make two sentences.');

  for (const sentence of plain.split(/(?<=[.!?])\s+/)) {
    const count = sentence.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
    if (count > MAX_WORDS) add(n, 'warning', 'long-sentence', `A sentence has ${count} words. Divide sentences of more than ${MAX_WORDS} words.`);
  }
  words += plain.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

  // Text for a single direct tts generate call.
  let say = body.replace(/\[pause=\d+\]/gi, ' ').replace(/\[[^\]=]+\]:\s*/g, ' ');
  if (engine !== 'expressive') say = say.replace(TAG, (m, inner) => (REACTIONS.includes(inner.trim().toLowerCase()) ? ' ' : m));
  spokenOut.push(say.replace(/\s+/g, ' ').trim());
});

if (spoken) {
  process.stdout.write(spokenOut.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n');
  process.exit(findings.some((f) => f.level === 'error') ? 1 : 0);
}

const errors = findings.filter((f) => f.level === 'error').length;
const warnings = findings.length - errors;
const minutes = words / WPM;
if (json) {
  console.log(JSON.stringify({ file, engine, words, estimated_minutes: Number(minutes.toFixed(2)), errors, warnings, findings }, null, 2));
} else {
  for (const f of findings) console.log(`${file}:${f.line}: ${f.level.toUpperCase()} ${f.rule}: ${f.detail}`);
  console.log(`\n${words} words, about ${minutes.toFixed(1)} min at ${WPM} words a minute (English estimate).`);
  console.log(`${errors} error(s), ${warnings} warning(s).${engine ? ` Engine: ${engine}.` : ' No engine given: reaction tags not checked.'}`);
}
process.exit(errors ? 1 : 0);
