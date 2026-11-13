// Lector de RSS 2.0 (sitios web) y Atom (YouTube, Reddit).
import { XMLParser } from 'fast-xml-parser';
import { detectGame, isNewsy, gameByKey } from '../filter.js';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@' });
const asArray = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);
const text = (x) => (x == null ? '' : typeof x === 'object' ? String(x['#text'] ?? '') : String(x)).trim();

function atomLink(link) {
  const links = asArray(link);
  const alt = links.find((l) => typeof l === 'object' && (l['@rel'] ?? 'alternate') === 'alternate') ?? links[0];
  return typeof alt === 'object' ? alt['@href'] : text(alt);
}

// Devuelve [{id, title, url, date(ms), summary}]
export function parseFeed(xml) {
  const doc = parser.parse(xml);
  if (doc.rss) {
    return asArray(doc.rss.channel?.item).map((it) => ({
      id: text(it.guid) || text(it.link),
      title: text(it.title),
      url: text(it.link),
      date: Date.parse(text(it.pubDate)) || 0,
      summary: text(it.description).replace(/<[^>]+>/g, ' ').slice(0, 500),
    }));
  }
  if (doc.feed) {
    return asArray(doc.feed.entry).map((e) => ({
      id: text(e.id) || atomLink(e.link),
      title: text(e.title),
      url: atomLink(e.link),
      date: Date.parse(text(e.published) || text(e.updated)) || 0,
      summary: '',
    }));
  }
  throw new Error('Formato de feed desconocido');
}

const decode = (s) =>
  s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

// Aplica el filtro de la fuente y normaliza al formato común de avisos.
export function feedEntriesToItems(feed, entries) {
  const out = [];
  for (const e of entries) {
    const title = decode(e.title);
    const haystack = `${title} ${decode(e.summary ?? '')}`;
    const game = feed.game ? gameByKey(feed.game) : detectGame(haystack);
    if (!game) continue;
    if ((feed.filter === 'game+news' || feed.filter === 'news') && !isNewsy(title)) continue;
    out.push({
      id: `${feed.key}:${e.id}`,
      sourceKey: `feed:${feed.key}`,
      game: game.name,
      kind: feed.type,
      source: feed.name,
      title,
      url: e.url,
      date: e.date,
    });
  }
  return out;
}

export async function fetchFeed(feed, fetchFn) {
  const res = await fetchFn(feed.url);
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${feed.url}`);
  return feedEntriesToItems(feed, parseFeed(await res.text()));
}
