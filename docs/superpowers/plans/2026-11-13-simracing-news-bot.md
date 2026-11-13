# Simracing News Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Telegram bot, run every 15 min by GitHub Actions, that notifies official (✅) and early-signal (🟡) sim racing news.

**Architecture:** Pure source adapters return normalized items; `run.js` dedups against `state.json`, sends via Telegram, persists state. Network access injected (`fetchFn`) so everything is testable offline with fixtures.

**Tech Stack:** Node 24 ESM, `fast-xml-parser`, `node:test`, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-13-simracing-news-bot-design.md`

## Global Constraints
- Node >= 22, ESM, single runtime dependency `fast-xml-parser`.
- Messages never rewritten: original title, source, date, link only. HTML-escaped.
- Official only for: Steam `steam_community_announcements`, iracing.com, official YouTube channels. Everything else is advance.
- First sighting of a source seeds state without notifying. Items older than 7 days never notified.
- Max 20 notifications per run. Digest at 03:00 UTC run. Seen IDs pruned after 60 days.
- Env: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `DRY_RUN=1`, `FORCE_DIGEST=1`.

## Review Focus
1. One source throws/429s → others still notify (test in Task 4).
2. Telegram send fails → item not marked seen, retried next run (Task 4).
3. Title with `<`, `&` → valid Telegram HTML (Task 3).
4. Brand-new game added to config → no flood of old news (Task 4, seeding per source key).
5. Reddit/media item not about a tracked game → dropped (Task 2).

---

### Task 1: Scaffold, config, Steam adapters
**Files:** `package.json`, `src/config.js`, `src/sources/steam.js`, `test/steam.test.js`, `test/fixtures/steam-news.json`, `test/fixtures/steam-appdetails.json`
**Interfaces — Produces:**
- `GAMES: {key, name, steamId, keywords: string[]}[]`, `FEEDS: {key, url, type:'official'|'advance', game?:string, filter?:'game'|'game+news'|'news'}[]`
- Item: `{id:string, sourceKey:string, game:string, kind:'official'|'advance', source:string, title:string, url:string, date:number(ms)}`
- `fetchSteamNews(game, fetchFn) -> Item[]` (official iff `feedname==='steam_community_announcements'`, id `steam:<gid>`, sourceKey `steamnews:<key>`)
- `fetchSteamDlc(game, fetchFn) -> {sourceKey:'dlc:<key>', dlcIds:number[]}`
- `dlcToItems(game, newIds, nameLookup) -> Item[]` (title `Nuevo DLC detectado en Steam: "<name>"`, url store page, kind advance)
- [ ] Tests: news classification official vs press; dlc id list parsing; empty `dlc` → `[]`.
- [ ] Implement, run `node --test`, PASS.

### Task 2: RSS/Atom adapter + filters
**Files:** `src/sources/rss.js`, `src/filter.js`, tests + fixtures (RSS 2.0, YouTube Atom, Reddit Atom)
**Produces:** `parseFeed(xml) -> {id,title,url,date}[]`; `fetchFeed(feed, fetchFn) -> Item[]`; `detectGame(text) -> gameKey|null`; `isNewsy(text) -> boolean` (words: patch, update, dlc, leak, roadmap, season, announce, release, new car, new track, build, hotfix, confirmed, coming, beta, preview, devlog)
- [ ] Tests: parses both formats; `filter:'game'` drops untracked-game items; `'game+news'` requires both; feed.game preset skips detection.
- [ ] Implement, PASS.

### Task 3: Telegram + formatting
**Files:** `src/telegram.js`, `src/format.js`, `test/format.test.js`
**Produces:** `formatItem(item) -> string(HTML)`; `formatDigest(items) -> string`; `sendMessage(text, {token, chatId, fetchFn}) -> Promise<void>` (throws on !ok)
- [ ] Tests: escapes `<&>`; header `✅ OFICIAL · <game>` / `🟡 ADELANTO · <game>`; advance includes `Todavía sin confirmación oficial`; digest groups by kind with count.
- [ ] Implement, PASS.

### Task 4: Run orchestration + state
**Files:** `src/state.js`, `src/run.js`, `src/index.js`, `test/run.test.js`
**Produces:** `loadState(path)`, `saveState(path,state)`; `run({state, now, fetchFn, send, isDigestTime}) -> {state, sent:number}`
- State: `{seen:{[id]:ts}, seededSources:string[], dlc:{[gameKey]:number[]}, today:Item[]}`
- [ ] Tests: unseeded source seeds silently; failing source isolated; send failure keeps item unseen; 7-day cutoff; cap 20; digest sends + clears `today`; prune > 60 days.
- [ ] Implement, PASS.

### Task 5: Workflow, README, live dry run
**Files:** `.github/workflows/news.yml` (cron `*/15 * * * *`, `workflow_dispatch`, commit `state.json` if changed, `permissions: contents: write`, concurrency group), `README.md` (Spanish setup guide: BotFather, chat id, GitHub repo + secrets)
- [ ] `DRY_RUN=1 node src/index.js` twice against live sources: first run seeds (0 sent), second sends 0 new; then delete one seen id → it prints that one.
