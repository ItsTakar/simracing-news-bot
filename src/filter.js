import { GAMES, NEWS_WORDS } from './config.js';

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordRe = (w) => new RegExp(`(^|[^a-z0-9])${escapeRe(w)}($|[^a-z0-9])`, 'i');

const GAME_MATCHERS = GAMES.map((g) => ({ game: g, res: g.keywords.map(wordRe) }));
const NEWS_MATCHERS = NEWS_WORDS.map((w) => (w.endsWith('.') ? new RegExp(escapeRe(w), 'i') : wordRe(w)));

// Devuelve el juego que menciona el texto (el primero de la lista que coincida), o null.
export function detectGame(text) {
  const hit = GAME_MATCHERS.find(({ res }) => res.some((re) => re.test(text)));
  return hit ? hit.game : null;
}

export function isNewsy(text) {
  return NEWS_MATCHERS.some((re) => re.test(text));
}

export function gameByKey(key) {
  return GAMES.find((g) => g.key === key) ?? null;
}
