import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchSteamNews, fetchSteamDlcIds, dlcToItem } from '../src/sources/steam.js';
import { parseFeed, feedEntriesToItems } from '../src/sources/rss.js';
import { detectGame, isNewsy } from '../src/filter.js';
import { GAMES } from '../src/config.js';

const lmu = GAMES.find((g) => g.key === 'lmu');
const jsonRes = (body) => async () => ({ ok: true, json: async () => body });

test('Steam: solo los anuncios del estudio, como oficiales', async () => {
  const items = await fetchSteamNews(lmu, jsonRes({ appnews: { newsitems: [
    { gid: '1', title: 'V1.4.3 Patch', url: 'https://x/1', date: 1700000000, feedname: 'steam_community_announcements' },
    { gid: '2', title: 'Обзор', url: 'https://x/2', date: 1700000000, feedname: 'PlayGround.ru' },
  ] } }));
  assert.deepEqual(items.map((i) => [i.id, i.kind, i.game, i.date]), [['steam:1', 'official', 'Le Mans Ultimate', 1700000000000]]);
});

test('Steam: lista de DLC, vacía si no hay', async () => {
  assert.deepEqual(await fetchSteamDlcIds(lmu, jsonRes({ 2399420: { success: true, data: { dlc: [5, 6] } } })), [5, 6]);
  assert.deepEqual(await fetchSteamDlcIds(lmu, jsonRes({ 2399420: { success: true, data: {} } })), []);
});

test('Steam: un DLC sin nombre público igual se avisa como adelanto', () => {
  const it = dlcToItem(lmu, 99, null, 1);
  assert.equal(it.kind, 'advance');
  assert.match(it.title, /DLC #99/);
  assert.equal(it.url, 'https://store.steampowered.com/app/99/');
});

test('Detección de juego: el más específico gana y respeta palabras completas', () => {
  assert.equal(detectGame('Assetto Corsa EVO free roam date').key, 'acevo');
  assert.equal(detectGame('New Assetto Corsa mod pack').key, 'ac');
  assert.equal(detectGame('ACC 1.10 hotfix').key, 'acc');
  assert.equal(detectGame('Forza Horizon 6 accolades'), null); // "acc" dentro de otra palabra no cuenta
  assert.equal(isNewsy('LMU v1.5 is out'), true);
  assert.equal(isNewsy('My new rig, thoughts?'), false);
});

const RSS = `<?xml version="1.0"?><rss version="2.0"><channel><title>T</title>
<item><title>Le Mans Ultimate &amp; the &lt;new&gt; career</title><link>https://t/1</link><guid>g1</guid><pubDate>Fri, 13 Nov 2026 18:00:00 +0000</pubDate><description>x</description></item>
<item><title>Forza Horizon 6 playlists</title><link>https://t/2</link><guid>g2</guid><pubDate>Fri, 13 Nov 2026 17:00:00 +0000</pubDate></item>
</channel></rss>`;

const ATOM = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>r</title>
<entry><id>t3_a</id><title>iRacing 2027 S1 new car leaked?</title><link href="https://r/a"/><updated>2026-11-13T10:00:00+00:00</updated></entry>
<entry><id>t3_b</id><title>Look at my rig</title><link href="https://r/b"/><updated>2026-11-13T09:00:00+00:00</updated></entry>
</feed>`;

test('RSS: parsea, decodifica y descarta juegos que no seguimos', () => {
  const items = feedEntriesToItems({ key: 'traxion', name: 'Traxion', type: 'advance', filter: 'game' }, parseFeed(RSS));
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Le Mans Ultimate & the <new> career');
  assert.equal(items[0].game, 'Le Mans Ultimate');
  assert.equal(items[0].date, Date.parse('2026-11-13T18:00:00Z'));
});

test('Atom (Reddit/YouTube): juego fijo + filtro de novedad', () => {
  const items = feedEntriesToItems({ key: 'r-iracing', name: 'r/iRacing', type: 'advance', game: 'iracing', filter: 'news' }, parseFeed(ATOM));
  assert.deepEqual(items.map((i) => [i.id, i.url, i.game]), [['r-iracing:t3_a', 'https://r/a', 'iRacing']]);
});
