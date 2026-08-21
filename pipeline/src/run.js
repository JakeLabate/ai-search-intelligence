#!/usr/bin/env node
import path from "node:path";
import fs from "node:fs";
import { loadEnv, read, write, appendJsonl, readJsonl, pool, slug, clamp, weekOf, DATA } from "./util.js";
import { CHANNELS, SOURCE_TYPES, INTENTS } from "./taxonomy.js";
import { buildProfile, buildPrompts } from "./profile.js";
import { extractAnswer } from "./extract.js";
import { makeClassifier } from "./sources.js";

loadEnv();

const argv = process.argv.slice(2);
const cmd = argv[0] || "all";
const flag = (n, d = null) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? (argv[i + 1]?.startsWith("--") ? true : argv[i + 1]) : d; };
const has = (n) => argv.includes(`--${n}`);

const SITE      = flag("site");
const HINT      = flag("about", "");
const N_PROMPTS = +flag("prompts", 60);
const REPEATS   = +flag("repeats", 3);
const CONC      = +flag("concurrency", 4);
const TODAY     = flag("date", new Date().toISOString().slice(0, 10));
const LIMIT     = +flag("limit", 0);

const P_PROFILE = path.join(DATA, "profile.json");
const P_PROMPTS = path.join(DATA, "prompts.json");
const P_STATE   = path.join(DATA, "state.json");
const P_RAW     = (d) => path.join(DATA, "raw", `answers-${d}.jsonl`);
const P_EXT     = (d) => path.join(DATA, "raw", `extract-${d}.jsonl`);
const P_OUT     = path.join(DATA, "records.json");

const activeChannels = () => CHANNELS.filter((c) => process.env[c.env]);

/* ── 1. profile ─────────────────────────────────────────────────────── */
async function cmdProfile() {
  if (!SITE) die("need --site example.com");
  console.log(`▸ profiling ${SITE}`);
  const profile = await buildProfile(SITE, HINT);
  profile.site = SITE.replace(/^https?:\/\//, "").replace(/\/$/, "");
  profile.ownDomains = [profile.site, ...(profile.competitors || []).map((c) => c.domain).filter(Boolean)];
  write(P_PROFILE, profile);
  console.log(`  brand      ${profile.brand} — ${profile.product}`);
  console.log(`  competitors ${profile.competitors.map((c) => c.name).join(", ")}`);
  console.log(`  themes     ${profile.themes.map((t) => t.name).join(", ")}`);
  console.log(`✓ ${P_PROFILE}`);
  return profile;
}

/* ── 2. prompt set (frozen after first run) ─────────────────────────── */
async function cmdPrompts() {
  const profile = read(P_PROFILE) || await cmdProfile();
  const existing = read(P_PROMPTS);
  if (existing && !has("regenerate")) {
    console.log(`▸ reusing frozen prompt set (${existing.prompts.length}). --regenerate to rewrite.`);
    return existing;
  }
  if (existing) console.warn("⚠ regenerating prompts BREAKS week-over-week comparability. Old weeks stay in raw/.");
  console.log(`▸ writing ${N_PROMPTS} queries`);
  const { prompts } = await buildPrompts(profile, N_PROMPTS);
  const set = {
    version: (existing?.version || 0) + 1,
    created: TODAY,
    prompts: prompts.map((p, i) => ({ id: `q${i}`, ...p })),
  };
  write(P_PROMPTS, set);
  console.log(`✓ ${set.prompts.length} queries → ${P_PROMPTS}`);
  return set;
}

/* ── 3. collect one weekly snapshot ─────────────────────────────────── */
async function cmdCollect() {
  const profile = read(P_PROFILE) || die("run `profile` first");
  const set = read(P_PROMPTS) || die("run `prompts` first");
  const chans = activeChannels();
  if (!chans.length) die("no channel API keys set — see .env.example");

  const queries = LIMIT > 0 ? set.prompts.slice(0, LIMIT) : set.prompts;
  const jobs = [];
  for (const ch of chans)
    for (const p of queries)
      for (let r = 0; r < REPEATS; r++) jobs.push({ ch, p, r });

  console.log(`▸ ${jobs.length} calls  (${chans.length} channels × ${queries.length} queries × ${REPEATS} repeats)`);
  if (has("dry-run")) { console.log("  dry run — nothing sent."); return; }

  const mods = Object.fromEntries(await Promise.all(
    chans.map(async (c) => [c.id, await import(`./channels/${c.module}.js`)])
  ));
  let done = 0, failed = 0, absent = 0;
  await pool(jobs, CONC, async ({ ch, p, r }) => {
    try {
      const res = await mods[ch.id].ask(p.text);
      if (res.absent) absent++;
      appendJsonl(P_RAW(TODAY), {
        aid: `${TODAY}-${ch.id}-${p.id}-r${r}`,
        date: TODAY, channel: ch.id, channelName: ch.name,
        promptId: p.id, query: p.text, theme: p.theme, intent: p.intent,
        repeat: r, absent: !!res.absent,
        text: res.text,
        citations: res.citations.map((c, i) => ({ rank: i + 1, ...c })),
      });
    } catch (e) { failed++; console.warn(`  ✗ ${ch.id}/${p.id}: ${e.message.slice(0, 120)}`); }
    if (++done % 25 === 0) console.log(`  ${done}/${jobs.length}`);
  });
  console.log(`✓ ${done - failed} answers → ${P_RAW(TODAY)}  (${failed} failed, ${absent} with no AI Overview)`);
}

/* ── 4. read what was said ──────────────────────────────────────────── */
async function cmdExtract() {
  const profile = read(P_PROFILE) || die("run `profile` first");
  const answers = readJsonl(P_RAW(TODAY));
  if (!answers.length) die(`no answers for ${TODAY} — run collect`);
  const already = new Set(readJsonl(P_EXT(TODAY)).map((e) => e.aid));
  const todo = answers.filter((a) => !already.has(a.aid) && a.citations?.length);
  console.log(`▸ extracting ${todo.length} answers (${already.size} already done)`);
  if (has("dry-run")) return;

  let n = 0;
  await pool(todo, CONC, async (a) => {
    try {
      const out = await extractAnswer({
        profile, channelName: a.channelName, query: a.query, answer: a.text, citations: a.citations,
      });
      appendJsonl(P_EXT(TODAY), { aid: a.aid, ...out });
    } catch (e) { console.warn(`  ✗ ${a.aid}: ${e.message.slice(0, 120)}`); }
    if (++n % 25 === 0) console.log(`  ${n}/${todo.length}`);
  });
  console.log(`✓ ${P_EXT(TODAY)}`);
}

/* ── 5. join into the bundle the visualisation eats ─────────────────── */
function cmdBuild() {
  const profile = read(P_PROFILE) || die("run `profile` first");
  const set = read(P_PROMPTS) || die("run `prompts` first");
  const state = read(P_STATE, {}) || {};

  const dates = fs.readdirSync(path.join(DATA, "raw"))
    .filter((f) => f.startsWith("answers-")).map((f) => f.slice(8, 18)).sort();
  if (!dates.length) die("no snapshots in data/raw");
  const epoch = state.epoch || dates[0];
  write(P_STATE, { ...state, epoch });

  const classify = makeClassifier({
    ownDomains: profile.ownDomains || [profile.site],
    overrides: read(path.join(DATA, "source-overrides.json"), {}) || {},
  });

  const brandName = (bid) => bid === "client" ? profile.brand
    : bid?.startsWith("comp") ? (profile.competitors[+bid.slice(4)]?.name || bid) : null;

  const sources = new Map();
  const records = [];
  let rid = 0;

  for (const date of dates) {
    const answers = new Map(readJsonl(P_RAW(date)).map((a) => [a.aid, a]));
    const week = weekOf(date, epoch);
    for (const ex of readJsonl(P_EXT(date))) {
      const a = answers.get(ex.aid); if (!a) continue;
      for (const c of ex.citations || []) {
        const cit = a.citations[c.index - 1]; if (!cit) continue;
        const cls = classify(cit.host ? { host: cit.host } : cit.url); if (!cls) continue;
        if (!sources.has(cls.host)) sources.set(cls.host, { id: slug(cls.host), dom: cls.host, type: cls.type, auth: cls.auth });
        const sent = clamp(Number(c.sentiment) || 0, -1, 1);
        records.push({
          id: `r${rid++}`, aid: a.aid,
          platform: a.channel, prompt: a.promptId, theme: a.theme, intent: a.intent,
          source: slug(cls.host), stype: cls.type,
          brand: c.brand === "none" ? "none" : c.brand,
          sent: Math.round(sent * 100) / 100,
          bandId: sent >= 0.22 ? "pos" : sent <= -0.22 ? "neg" : "neu",
          rank: cit.rank, week, auth: cls.auth,
          tone: c.tone, text: c.evidence || c.claim, claim: c.claim,
          nuance: (c.nuance || []).slice(0, 3),
        });
      }
    }
  }

  const usedBrands = new Set(records.map((r) => r.brand));
  const brands = [
    { id: "client", name: profile.brand, client: true },
    ...profile.competitors.map((c, i) => ({ id: `comp${i}`, name: c.name })),
    { id: "none", name: "No brand (general)" },
  ].filter((b) => usedBrands.has(b.id));

  const bundle = {
    meta: {
      brand: profile.brand, product: profile.product, site: profile.site,
      generated: new Date().toISOString().slice(0, 10),
      weeks: Math.max(...records.map((r) => r.week), 1),
      promptSetVersion: set.version, snapshots: dates,
    },
    platforms: CHANNELS.filter((c) => records.some((r) => r.platform === c.id))
      .map((c) => ({ id: c.id, name: c.name })),
    sourceTypes: SOURCE_TYPES,
    intents: INTENTS,
    themes: profile.themes,
    brands,
    prompts: set.prompts.map((p) => ({ id: p.id, text: p.text, intent: p.intent, theme: p.theme })),
    sources: [...sources.values()],
    records,
  };
  write(P_OUT, bundle);
  console.log(`✓ ${records.length} citations · ${bundle.sources.length} sources · ${bundle.meta.weeks} week(s) → ${P_OUT}`);
  console.log(`  copy it next to the html, then: npm run serve`);
}

function die(msg) { console.error(`✗ ${msg}`); process.exit(1); }

const table = { profile: cmdProfile, prompts: cmdPrompts, collect: cmdCollect, extract: cmdExtract, build: cmdBuild };
if (cmd === "all") {
  if (!read(P_PROFILE)) await cmdProfile();
  await cmdPrompts(); await cmdCollect(); await cmdExtract(); cmdBuild();
} else if (table[cmd]) { await table[cmd](); }
else die(`unknown command "${cmd}". Use: profile | prompts | collect | extract | build | all`);
