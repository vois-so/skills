#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 vois-so
//
// Make the RSS <item> for one episode file: enclosure length (bytes), type,
// duration, GUID and publication date. It also writes an episodes.json entry
// in the format that `vois-cli rss generate --episodes-file` reads.
//
// Usage:
//   node rss-item.mjs --audio out/episode.mp3 --url https://example.com/ep1.mp3
//        --title "Fix a squeaky door" --description "Show notes text"
//        [--guid ID] [--pub-date "2026-11-10T09:00:00Z"] [--episode 1]
//        [--season 1] [--type full|trailer|bonus] [--explicit]
//        [--out out/rss-item.xml] [--episodes out/episodes.json]
//
// The URL is where the file will be on your host, after the upload.
// The size and the duration come from the file, so make the item from the
// same file that you upload.

import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { extname, resolve } from "node:path";
import { probe, fail, parseArgs, hms } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2), ["explicit"]);
for (const k of ["audio", "url", "title", "description"]) if (!args[k]) fail(`--${k} is necessary. Usage: see the top of this script.`, 3);
const audio = resolve(args.audio);
if (!existsSync(audio)) fail(`No file: ${audio}`, 4);

const bytes = statSync(audio).size;
const duration = Math.round(Number(probe(audio).format.duration));
const type = { ".mp3": "audio/mpeg", ".m4a": "audio/x-m4a", ".mp4": "audio/mp4", ".wav": "audio/wav" }[extname(audio).toLowerCase()] || "audio/mpeg";
const pub = args["pub-date"] ? new Date(args["pub-date"]) : new Date();
if (Number.isNaN(pub.getTime())) fail(`--pub-date is not a date: ${args["pub-date"]}`, 3);
const pubDate = pub.toUTCString().replace("GMT", "+0000"); // RFC 2822
const guid = args.guid || createHash("sha256").update(`${args.url}|${args.title}`).digest("hex").slice(0, 32);
const epType = args.type || "full";

const x = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const lines = [
  "<item>",
  `  <title>${x(args.title)}</title>`,
  `  <description>${x(args.description)}</description>`,
  `  <enclosure url="${x(args.url)}" length="${bytes}" type="${type}"/>`,
  `  <guid isPermaLink="false">${x(guid)}</guid>`,
  `  <pubDate>${pubDate}</pubDate>`,
  `  <itunes:duration>${hms(duration)}</itunes:duration>`,
  args.episode ? `  <itunes:episode>${Number(args.episode)}</itunes:episode>` : null,
  args.season ? `  <itunes:season>${Number(args.season)}</itunes:season>` : null,
  `  <itunes:episodeType>${epType}</itunes:episodeType>`,
  `  <itunes:explicit>${args.explicit ? "true" : "false"}</itunes:explicit>`,
  "</item>",
].filter(Boolean);
const xml = lines.join("\n") + "\n";
const outXml = resolve(args.out || "rss-item.xml");
writeFileSync(outXml, xml);

// Entry for `vois-cli rss generate --episodes-file`. That command ignores an
// entry with no title, description, audio_url or pub_date.
const entry = {
  title: args.title,
  description: args.description,
  guid,
  audio_url: args.url,
  audio_size: bytes,
  audio_type: type,
  duration_seconds: duration,
  pub_date: pubDate,
  episode_number: args.episode ? Number(args.episode) : null,
  season_number: args.season ? Number(args.season) : null,
  episode_type: epType,
  explicit: Boolean(args.explicit),
};
const epPath = resolve(args.episodes || "episodes.json");
const list = existsSync(epPath) ? JSON.parse(readFileSync(epPath, "utf8")) : [];
const i = list.findIndex((e) => e.guid === guid);
if (i >= 0) list[i] = entry;
else list.push(entry);
writeFileSync(epPath, JSON.stringify(list, null, 2) + "\n");

process.stdout.write(xml);
console.log(`Wrote ${outXml} and ${epPath} (${list.length} episodes).`);
