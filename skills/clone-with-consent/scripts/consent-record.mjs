#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 vois-so
//
// Make, check and keep the consent record of a voice owner, before and after
// a voice clone in Vois Studio. This is a record template, not legal advice.
// Read the Vois Studio voice cloning terms:
// https://vois.so/legal/voice-cloning-terms
//
// Usage:
//   node consent-record.mjs new <dir> --owner "Full Name" [--contact email]
//        [--adult] [--date YYYY-MM-DD] [--collector "Your name or company"]
//        [--collector-contact email] [--voice-name "Name in Vois Studio"]
//        [--uses "audiobook narration; course videos"] [--commercial yes|no]
//        [--languages "English, Spanish"] [--expires YYYY-MM-DD|none]
//        [--method signed|recorded] [--payment "text"] [--force]
//   node consent-record.mjs check <dir> [--evidence <signed form or statement recording>]
//        [--reference <reference audio>] [--transcript "exact words"]
//   node consent-record.mjs link <dir> --slug <clone-slug> --voice-id <cloned_id>
//   node consent-record.mjs revoke <dir> [--date YYYY-MM-DD]
//
// Files in <dir>: consent.json (the record), consent.md (the form to sign),
// statement.txt (the text that the owner reads for a recorded statement).
// "check" exits 0 and sets status "ready" only when every required field is
// complete, the evidence file exists, and the consent did not expire.

import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const TERMS = "https://vois.so/legal/voice-cloning-terms";

function fail(msg, code = 1) {
  console.error(`ERROR: ${msg}`);
  process.exit(code);
}

const argv = process.argv.slice(2);
const [cmd, dirArg] = argv;
const opt = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith("--") ? argv[i + 1] : undefined;
};
if (!cmd || !dirArg) fail("Usage: node consent-record.mjs new|check|link|revoke <dir> [options]. See the top of this file.", 3);
const dir = resolve(dirArg);
const jsonPath = join(dir, "consent.json");
const now = new Date();
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; // local date
const sha256 = (f) => createHash("sha256").update(readFileSync(f)).digest("hex");

const DEFAULT_PROHIBITED = [
  "speech that makes listeners think that the owner said it live, when the owner did not",
  "political or election content",
  "sexual content",
  "content that defames, harasses or threatens a person",
  "fraud, and access to accounts or systems that use voice checks",
];

function statementText(r) {
  const uses = r.scope.uses.length ? r.scope.uses.join(", ") : "[uses]";
  return [
    `My name is ${r.owner.name || "[full name]"}. Today is ${r.date || "[date]"}.`,
    `I give ${r.collector || "[collector]"} permission to make a copy of my voice with Vois Studio.`,
    `They can use my voice for: ${uses}.`,
    r.scope.commercial === true ? "Commercial use is permitted." : r.scope.commercial === false ? "Commercial use is not permitted." : "Commercial use: [yes or no].",
    `Languages: ${r.scope.languages.join(", ") || "[languages]"}.`,
    r.scope.expires && r.scope.expires !== "none" ? `This permission ends on ${r.scope.expires}.` : "This permission continues until I take it back.",
    `I can take back this permission at any time. To do this, I contact ${r.collector_contact || r.collector || "[collector contact]"}.`,
  ].join("\n");
}

function form(r) {
  const line = (label, v) => `| ${label} | ${v === undefined || v === null || v === "" ? "______________________" : v} |`;
  return `# Voice cloning consent record

Record ID: ${r.record_id || "(set by the check)"}
Status: ${r.status}

This record shows that the owner of a voice gives permission to make and use a copy of that voice with Vois Studio. It is a template, not legal advice. Read the Vois Studio voice cloning terms: ${TERMS}

## 1. Voice owner

${["| Field | Value |", "| --- | --- |", line("Full name", r.owner.name), line("Contact (email or phone)", r.owner.contact), line("18 years or older", r.owner.adult === true ? "yes" : r.owner.adult === false ? "no: a parent or guardian signs below" : undefined)].join("\n")}

## 2. Person or company that makes the clone

${["| Field | Value |", "| --- | --- |", line("Name", r.collector), line("Contact for questions and withdrawal", r.collector_contact), line("Name of the voice in Vois Studio", r.voice_name)].join("\n")}

## 3. Scope of use

${["| Field | Value |", "| --- | --- |", line("Permitted uses", r.scope.uses.join("; ")), line("Commercial use", r.scope.commercial === true ? "yes" : r.scope.commercial === false ? "no" : undefined), line("Languages", r.scope.languages.join(", ")), line("New text that the owner did not read", r.scope.new_text === false ? "no" : "yes"), line("Disclosure that the voice is AI-generated", r.scope.disclosure || "yes, where the platform or the law asks for it"), line("Payment", r.scope.payment || "none"), line("End date", r.scope.expires || "none (until withdrawal)")].join("\n")}

Uses that are not permitted:

${r.scope.prohibited.map((p) => `- ${p}`).join("\n")}

## 4. Withdrawal

The owner can withdraw this consent at any time with a message to the contact in section 2. After a withdrawal, the collector removes the clone from Vois Studio (\`vois-cli voice clone-delete --slug <slug> --force\`) and makes no new audio with it. ${r.scope.after_withdrawal || "Audio that was published before the withdrawal can stay published."}

## 5. Reference recording

${["| Field | Value |", "| --- | --- |", line("File", r.reference.file && basename(r.reference.file)), line("SHA-256", r.reference.sha256), line("Exact transcript", r.reference.transcript)].join("\n")}

## 6. Evidence of consent

Method: ${r.method === "recorded" ? "recorded statement (the owner reads statement.txt)" : r.method === "signed" ? "signed form (this document)" : "______________________"}

${["| Field | Value |", "| --- | --- |", line("Evidence file", r.evidence.file && basename(r.evidence.file)), line("Evidence SHA-256", r.evidence.sha256), line("Date of consent", r.date)].join("\n")}

Signature of the voice owner: ______________________  Date: __________

Signature of the parent or guardian (only if the owner is younger than 18): ______________________

Signature of the collector: ______________________  Date: __________
`;
}

function save(r) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(jsonPath, JSON.stringify(r, null, 2) + "\n");
  writeFileSync(join(dir, "consent.md"), form(r));
  writeFileSync(join(dir, "statement.txt"), statementText(r) + "\n");
}

const list = (s) => (s ? String(s).split(/[;,]/).map((x) => x.trim()).filter(Boolean) : []);

if (cmd === "new") {
  if (existsSync(jsonPath) && !argv.includes("--force")) fail(`${jsonPath} exists. Use "check", or add --force to start a new record.`, 3);
  const c = opt("commercial");
  const r = {
    template: "vois-voice-consent/1",
    terms: TERMS,
    record_id: null,
    status: "draft",
    created: today,
    date: opt("date") || today,
    owner: { name: opt("owner") || "", contact: opt("contact") || "", adult: argv.includes("--adult") ? true : null },
    collector: opt("collector") || "",
    collector_contact: opt("collector-contact") || "",
    voice_name: opt("voice-name") || "",
    scope: {
      uses: list(opt("uses")),
      commercial: c === undefined ? null : /^(y|yes|true)$/i.test(c),
      languages: list(opt("languages")),
      new_text: true,
      disclosure: "",
      payment: opt("payment") || "",
      expires: opt("expires") || "",
      prohibited: DEFAULT_PROHIBITED,
      after_withdrawal: "",
    },
    method: opt("method") || "",
    evidence: { file: "", sha256: "" },
    reference: { file: "", sha256: "", transcript: "" },
    clone: { slug: "", voice_id: "", created: "" },
    history: [{ date: today, event: "record made" }],
  };
  save(r);
  console.log(`Wrote ${jsonPath}, consent.md and statement.txt in ${dir}.`);
  console.log(`Complete the empty fields in consent.json, get the evidence, then: node consent-record.mjs check ${dirArg} --evidence <file>`);
  process.exit(0);
}

if (!existsSync(jsonPath)) fail(`No record at ${jsonPath}. Start with: node consent-record.mjs new ${dirArg} --owner "Full Name"`, 4);
const r = JSON.parse(readFileSync(jsonPath, "utf8"));

if (cmd === "check") {
  const ev = opt("evidence");
  if (ev) r.evidence = { file: resolve(ev), sha256: "" };
  const ref = opt("reference");
  if (ref) r.reference.file = resolve(ref);
  if (opt("transcript")) r.reference.transcript = opt("transcript");
  const missing = [];
  if (!r.owner.name) missing.push("owner.name");
  if (!r.owner.contact) missing.push("owner.contact");
  if (r.owner.adult === null || r.owner.adult === undefined) missing.push("owner.adult (true, or false with a guardian signature)");
  if (!r.collector) missing.push("collector");
  if (!r.collector_contact) missing.push("collector_contact");
  if (!r.voice_name) missing.push("voice_name");
  if (!r.scope.uses.length) missing.push("scope.uses");
  if (r.scope.commercial === null || r.scope.commercial === undefined) missing.push("scope.commercial (true or false)");
  if (!r.scope.languages.length) missing.push("scope.languages");
  if (!r.scope.expires) missing.push('scope.expires (a date, or "none")');
  if (!["signed", "recorded"].includes(r.method)) missing.push('method ("signed" or "recorded")');
  if (!r.date) missing.push("date");
  if (!r.evidence.file) missing.push("evidence file (--evidence)");
  else if (!existsSync(r.evidence.file)) missing.push(`evidence file not found: ${r.evidence.file}`);
  else r.evidence.sha256 = sha256(r.evidence.file);
  if (r.reference.file) {
    if (!existsSync(r.reference.file)) missing.push(`reference file not found: ${r.reference.file}`);
    else r.reference.sha256 = sha256(r.reference.file);
  }
  const expired = r.scope.expires && r.scope.expires !== "none" && r.scope.expires < today;
  if (expired) missing.push(`the consent expired on ${r.scope.expires}`);
  if (r.status === "revoked") missing.push("the owner withdrew this consent");
  if (!r.record_id) r.record_id = `CR-${r.date.replace(/-/g, "")}-${randomBytes(4).toString("hex")}`;
  r.status = missing.length ? "draft" : "ready";
  r.history.push({ date: today, event: missing.length ? `check: ${missing.length} missing` : "check: ready" });
  save(r);
  console.log(`Record ${r.record_id}: ${r.status.toUpperCase()}`);
  for (const m of missing) console.log(`  missing: ${m}`);
  if (!missing.length) {
    console.log(`  owner: ${r.owner.name}; uses: ${r.scope.uses.join("; ")}; commercial: ${r.scope.commercial ? "yes" : "no"}; languages: ${r.scope.languages.join(", ")}; ends: ${r.scope.expires}`);
    console.log(`  evidence: ${basename(r.evidence.file)} sha256 ${r.evidence.sha256.slice(0, 16)}...`);
    if (r.reference.sha256) console.log(`  reference: ${basename(r.reference.file)} sha256 ${r.reference.sha256.slice(0, 16)}...`);
    console.log(`  notes for vois-cli voice clone --notes: "Consent ${r.record_id}; ${r.scope.commercial ? "commercial" : "non-commercial"}; ends ${r.scope.expires}"`);
  }
  process.exit(missing.length ? 1 : 0);
}

if (cmd === "link") {
  if (r.status !== "ready") fail(`The record is "${r.status}", not "ready". Do the check first.`, 3);
  const slug = opt("slug");
  const id = opt("voice-id");
  if (!slug || !id) fail("Give --slug <clone-slug> and --voice-id <cloned_id> from vois-cli voice list --source cloned --format json", 3);
  r.clone = { slug, voice_id: id, created: today };
  r.history.push({ date: today, event: `clone made: ${id}` });
  save(r);
  console.log(`Record ${r.record_id} now names the clone ${id} (slug ${slug}).`);
  process.exit(0);
}

if (cmd === "revoke") {
  r.status = "revoked";
  r.revoked = opt("date") || today;
  r.history.push({ date: r.revoked, event: "owner withdrew consent" });
  save(r);
  console.log(`Record ${r.record_id || "(no ID)"}: REVOKED on ${r.revoked}.`);
  if (r.clone.slug) console.log(`Remove the clone now: vois-cli voice clone-delete --slug ${r.clone.slug} --force`);
  process.exit(0);
}

fail(`Unknown command "${cmd}". Use new, check, link or revoke.`, 3);
