#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 vois-so
//
// Split a manuscript (plain text or Markdown) into chapters and blocks, and
// write the batch plan <workdir>/plan.json.
//
// Usage:
//   node split-manuscript.mjs <manuscript> <workdir> --voice <voice-id>
//        [--title "Book"] [--author "Name"] [--engine expressive]
//        [--language English] [--heading "<regex>"] [--max-chars 900]
//        [--no-titles] [--force]
//
// The narrator reads each chapter title first, then a scene-break pause.
// --no-titles turns this off.
//
// Chapter headings: Markdown "# " or "## " lines, or lines that start with
// Chapter, Part, Prologue, Epilogue, Introduction, Afterword (any case),
// 80 characters or shorter.
// --heading replaces this rule with your own regular expression.
// A line "[Name]: text" is a character line for speaker Name.
// A line "***", "* * *" or "---" is a scene break (a longer pause).

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fail, parseArgs } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2), ["no-titles", "force"]);
const [src, workdir] = args._;
if (!src || !workdir) fail("Usage: node split-manuscript.mjs <manuscript> <workdir> --voice <voice-id> [--title ...] [--author ...]", 3);
if (!args.voice) fail("Give the narrator voice with --voice <voice-id> (see: vois-cli voice list --format json).", 3);

const maxChars = Number(args["max-chars"] || 900);
const headingRe = args.heading
  ? new RegExp(args.heading)
  : /^(#{1,2}\s+.+|(chapter|part|prologue|epilogue|introduction|afterword)\b.*)$/i;

const raw = readFileSync(src, "utf8").replace(/\r\n?/g, "\n");

// Remove simple Markdown so that the voice does not read the marks.
function clean(text) {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(^|[^*\w])[*_]([^*_\n]+)[*_](?=[^*\w]|$)/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

// Split a long paragraph at sentence ends so that each block is short.
function splitLong(text) {
  if (text.length <= maxChars) return [text];
  const sentences = text.match(/[^.!?…]+[.!?…]+["'”’)\]]*\s*|[^.!?…]+$/g) || [text];
  const out = [];
  let cur = "";
  for (const s of sentences) {
    if (cur && (cur + s).length > maxChars) {
      out.push(cur.trim());
      cur = "";
    }
    cur += s;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const lines = raw.split("\n");
const chapters = [];
let current = null;
let para = [];

function flushPara() {
  if (!current) {
    // Text before the first heading becomes an opening chapter.
    if (para.join("").trim() === "") {
      para = [];
      return;
    }
    current = { title: args.title || "Opening", body: [] };
    chapters.push(current);
  }
  const text = para.join(" ").trim();
  para = [];
  if (!text) return;
  current.body.push(text);
}

for (const line of lines) {
  const t = line.trim();
  if (t.length <= 80 && headingRe.test(t)) {
    flushPara();
    current = { title: clean(t.replace(/^#+\s*/, "")), body: [] };
    chapters.push(current);
  } else if (/^(\*\s*\*\s*\*|-{3,}|_{3,}|#)$/.test(t)) {
    flushPara();
    if (current) current.body.push("\u0000BREAK");
  } else if (t === "") {
    flushPara();
  } else if (/^\[[^\]]+\]:/.test(t)) {
    // A character line is always its own block.
    flushPara();
    para.push(t);
    flushPara();
  } else {
    para.push(t);
  }
}
flushPara();

// A heading with no text under it (for example the book title) is not a chapter.
const emptyTitles = chapters.filter((c) => !c.body.some((p) => p !== "\u0000BREAK")).map((c) => c.title);
chapters.splice(0, chapters.length, ...chapters.filter((c) => c.body.some((p) => p !== "\u0000BREAK")));
if (chapters.length === 0) fail("No text found in the manuscript.");

const plan = {
  title: args.title || emptyTitles[0] || chapters[0].title,
  author: args.author || "",
  language: args.language || "English",
  engine: args.engine || "expressive",
  speed: 1.0,
  instruct: "",
  voices: { Narrator: args.voice },
  pause_ms: 600,
  break_ms: 1600,
  head_ms: 500,
  tail_ms: 2000,
  target_lufs: -20,
  crest_db: 15,
  chapters: [],
};

const speakers = new Set(["Narrator"]);
chapters.forEach((ch, i) => {
  const id = String(i + 1).padStart(2, "0");
  const blocks = [];
  // Retail rules usually ask that the narrator reads each chapter title.
  if (!args["no-titles"]) blocks.push({ type: "speech", speaker: "Narrator", text: /[.!?]$/.test(ch.title) ? ch.title : `${ch.title}.` }, { type: "break" });
  for (const p of ch.body) {
    if (p === "\u0000BREAK") {
      blocks.push({ type: "break" });
      continue;
    }
    let speaker = "Narrator";
    let text = p;
    const m = p.match(/^\[([^\]]+)\]:\s*(.*)$/);
    if (m) {
      speaker = m[1].trim();
      text = m[2];
    }
    speakers.add(speaker);
    for (const part of splitLong(clean(text))) blocks.push({ type: "speech", speaker, text: part });
  }
  const words = blocks.filter((b) => b.type === "speech").reduce((n, b) => n + b.text.split(/\s+/).length, 0);
  plan.chapters.push({ id, title: ch.title, words, est_minutes: +(words / 150).toFixed(1), status: "draft", blocks });
});

for (const s of speakers) if (!plan.voices[s]) plan.voices[s] = "";

mkdirSync(workdir, { recursive: true });
const planPath = join(workdir, "plan.json");
if (existsSync(planPath) && !args.force) fail(`${planPath} exists. Add --force to write a new plan (this replaces your edits).`, 3);
writeFileSync(planPath, JSON.stringify(plan, null, 2) + "\n");

console.log(`Plan: ${planPath}`);
console.log("ID  Words  Min   Blocks  Title");
for (const c of plan.chapters) {
  console.log(`${c.id}  ${String(c.words).padStart(5)}  ${String(c.est_minutes).padStart(4)}  ${String(c.blocks.length).padStart(6)}  ${c.title}`);
}
const total = plan.chapters.reduce((n, c) => n + c.words, 0);
console.log(`Total: ${plan.chapters.length} chapters, ${total} words, about ${(total / 150 / 60).toFixed(1)} hours at 150 words a minute.`);
const missing = Object.entries(plan.voices).filter(([, v]) => !v).map(([k]) => k);
if (missing.length) console.log(`Speakers with no voice yet (set them in plan.json "voices"): ${missing.join(", ")}`);
