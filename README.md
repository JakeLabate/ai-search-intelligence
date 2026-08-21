# Answer Space

A hosted dashboard that measures how AI assistants answer questions about your brand —
which sources they cite, and what those answers actually **say** about you — then draws
it as a 3D citation map.

Static site. Runs on GitHub Pages. No server to operate.

---

## Deploy it (no terminal needed)

1. On GitHub, **New repository** → name it whatever you like → **Create**.
2. **Add file → Upload files**, drag in *everything* from this folder (including the
   `.github` and `pipeline` folders), commit.

   > macOS hides dotfiles, so `.github` sometimes fails to drag. If the Actions tab shows no
   > workflow afterwards, use **Add file → Create new file**, type `.github/workflows/collect.yml`
   > as the filename (GitHub creates the folders as you type the slashes), and paste the contents
   > of that file in. You only need this for the five-channel path — the browser engine works
   > without it.
3. **Settings → Pages →** Source: *Deploy from a branch*, Branch: `main`, folder: `/ (root)` → **Save**.
4. Wait a minute, then open `https://<you>.github.io/<repo>/`.

That's the whole deployment. Everything else happens inside the dashboard.

---

## First run — demo mode, no keys, no spend

Open the site, hit **Enable demo mode**, then walk the six steps. It fabricates a profile,
a query set and answers locally so you can see the entire flow — including the 3D explorer
— before deciding whether it's worth paying for. Nothing is called. Nothing is charged.

Press **Reset** in the header to wipe it and start for real.

---

## Going live in the browser

The dashboard can drive two assistants directly:

| Channel | Where the key comes from |
|---|---|
| **Claude** | console.anthropic.com |
| **Gemini** | aistudio.google.com |

Paste them into step 1. They're stored in your browser's `localStorage` and sent only to
the vendor's own API. There is no backend to leak them to.

The other three — **ChatGPT**, **Perplexity**, **Google AI Overviews** — cannot be reached
from a browser at all. Those endpoints refuse cross-origin requests; SerpApi documents the
refusal explicitly. They run on Actions instead. See below.

---

## All five channels, via GitHub Actions

Actions is the backend. It runs the same pipeline, with the keys held as repo secrets, and
commits `records.json` back to the repo — where Pages serves it and the dashboard picks it up.

**One-time setup**

1. **Settings → Secrets and variables → Actions → New repository secret.** Add whichever of
   these you have. Any you skip are silently skipped at run time.

   ```
   ANTHROPIC_API_KEY     worker model + Claude channel   (required — the worker does the extraction)
   OPENAI_API_KEY        ChatGPT
   PERPLEXITY_API_KEY    Perplexity
   GEMINI_API_KEY        Gemini
   SERPAPI_KEY           Google AI Overviews
   ```

2. Create a fine-grained personal access token (**Settings → Developer settings → Personal
   access tokens**) scoped to this repo with **Contents: read and write** and
   **Actions: read and write**.

3. In the dashboard's **Collect** step, enter `owner/repo` and paste the token, then press
   **Trigger workflow**. It pushes your profile and frozen query set into the repo first, so
   the Action measures exactly what you configured — then starts the run.

4. When the run finishes, press **Pull latest records.json**.

The workflow also runs on a **Monday 06:00 UTC cron**. Delete the `schedule:` block in
`.github/workflows/collect.yml` if you don't want that.

---

## The six steps

**1 · Connect** — keys, or demo mode.

**2 · Target** — type a domain. The assistant researches it with its own web search and
derives brand, product, category, competitors and topics.

**3 · Refine** — *the screen that matters most.* Everything downstream inherits it. Two
things to check every time:

- **Competitors it invented or got wrong.** Remove them.
- **Brands you own.** Toggle them to **◆ we own this**. A subsidiary is not a rival — but
  keep it in the list, because assistants routinely conflate a parent brand with a brand it
  owns, and that conflation shows up as a finding rather than as noise.

**4 · Queries** — ~60 questions, about 60% of which deliberately don't name you. That's
where you learn whether you get surfaced at all rather than just how you're described when
someone already asked about you. Edit them now: once you start collecting, changing them
breaks week-over-week comparison.

**5 · Collect** — one run is one snapshot. Start small (20 queries × 1 repeat) and read the
output before scaling. Repeats matter: these models are stochastic, so one run is a spot
check and three is a measurement.

**6 · Explore** — five views over the same citation table: constellation, orbits, sentiment
space, landscape crosstab, timeline helix.

---

## What is stored, and where

| Thing | Lives in |
|---|---|
| API keys, profile, query set | your browser's `localStorage` |
| Raw answers + extractions | your browser's IndexedDB |
| `records.json` | the repo, if you run via Actions; otherwise download it from step 6 |

Nothing is transmitted anywhere except directly to the model vendors you keyed. **Reset** in
the header deletes all of it.

Because browser storage is per-browser, a run started on your laptop is not visible on your
phone. Use the Actions path if you want the dataset to live somewhere shared — and note that
a public repo means a public `records.json`. Use a private repo if the data is sensitive;
Pages on a private repo requires a paid GitHub plan.

---

## Things worth being honest about

**An API answer is not the consumer product.** API ChatGPT and Claude have different
retrieval, no memory, no personalization, no A/B bucket. This measures a *representative
probe* of each surface — directionally right, consistent week over week, which is what you
need for a trend. It is not a recording of what a specific customer saw, and it should never
be quoted as "here is what ChatGPT told users."

**Sentiment is a model's judgement, not a fact.** The extractor is constrained to a fixed
vocabulary and told to score the brand the citation *serves*, but it is still one model
reading another. Spot-check twenty records before you trust a number in a deck.

**Source authority is a proxy.** Domains are bucketed by rule (`pipeline/src/sources.js`,
mirrored in `app.js`). Wire in your own DR/DA feed if you have one.

**Costs scale as channels × queries × repeats.** The default browser run is 20 queries × 1
repeat × 2 channels = 40 answers plus 40 extraction calls. Full config is 5 × 60 × 3 = 900
answers a week plus 900 extractions. Cut repeats first if you need to save money; cut queries
last.

---

## Files

```
index.html                     the dashboard
app.js / app.css               wizard, browser engine, storage, Actions dispatch
viz.js / viz.css               the 3D explorer
records.json                   written by the Action; absent until the first run
.github/workflows/collect.yml  the backend
pipeline/                      the Node CLI the Action runs (also usable standalone)
```

Controlled vocabularies — source types, intents, tones, nuance tags — are defined twice on
purpose: `pipeline/src/taxonomy.js` for the Action, and the top of `app.js` for the browser.
**Change them in both places or not at all**, or the two engines will disagree about what a
citation is.
