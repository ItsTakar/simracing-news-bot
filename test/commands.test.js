import { test } from 'node:test';
import assert from 'node:assert/strict';
import { replyFor, handleCommands, startOfTodayArgentina } from '../src/commands.js';
import { run, emptyState } from '../src/run.js';

const HOUR = 3600000;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 10, 13, 20); // 17:00 en Argentina
const r = (title, game, kind, sentAt) => ({ title, game, kind, url: `https://x/${title}`, sentAt });
const RECENT = [
  r('Hoy LMU', 'Le Mans Ultimate', 'official', NOW - 2 * HOUR),
  r('Hoy rumor iRacing', 'iRacing', 'advance', NOW - HOUR),
  r('Ayer iRacing', 'iRacing', 'official', NOW - 20 * HOUR), // 21:00 del día anterior en Argentina
  r('Hace 5 días LMU', 'Le Mans Ultimate', 'advance', NOW - 5 * DAY),
];

test('el "hoy" es el día de Argentina, no el de UTC', () => {
  assert.equal(startOfTodayArgentina(NOW), Date.UTC(2026, 10, 13, 3));
  assert.equal(startOfTodayArgentina(Date.UTC(2026, 10, 14, 1)), Date.UTC(2026, 10, 13, 3)); // 22:00 ART del 13
});

test('/novedades: solo lo de hoy, separado por tipo', () => {
  const t = replyFor('/novedades', RECENT, NOW);
  assert.match(t, /2 novedades/);
  assert.match(t, /Hoy LMU/);
  assert.match(t, /Hoy rumor iRacing/);
  assert.doesNotMatch(t, /Ayer/);
  assert.ok(t.indexOf('OFICIAL') < t.indexOf('ADELANTO'));
});

test('/semana: los 7 días con fecha', () => {
  const t = replyFor('/semana', RECENT, NOW);
  assert.match(t, /4 novedades/);
  assert.match(t, /\b0?8\/11 <b>Le Mans Ultimate<\/b>/);
});

test('/juego lmu filtra por juego; sin clave o clave mala muestra la lista', () => {
  const t = replyFor('/juego LMU', RECENT, NOW);
  assert.match(t, /Le Mans Ultimate.*últimos 7 días/);
  assert.match(t, /2 novedades/);
  assert.doesNotMatch(t, /iRacing:/);
  assert.match(replyFor('/juego', RECENT, NOW), /<code>iracing<\/code> = iRacing/);
  assert.match(replyFor('/juego forza', RECENT, NOW), /Claves de juegos/);
});

test('sin novedades, otros comandos y texto común', () => {
  assert.match(replyFor('/novedades', [], NOW), /No hay novedades/);
  assert.match(replyFor('/novedades@mi_bot', [], NOW), /Novedades de hoy/);
  assert.match(replyFor('/start', [], NOW), /Comandos/);
  assert.match(replyFor('/cualquiera', [], NOW), /No conozco ese comando/);
  assert.equal(replyFor('hola', [], NOW), null);
});

const upd = (id, text, chat = 42) => ({ update_id: id, message: { text, chat: { id: chat } } });

test('responde solo a tu chat y avanza el offset', async () => {
  const sent = [];
  const next = await handleCommands({
    updates: [upd(10, '/novedades'), upd(11, '/semana', 999), upd(12, 'hola')],
    chatId: '42', recent: RECENT, now: NOW, send: async (t) => sent.push(t), log: () => {}, offset: 5,
  });
  assert.equal(next, 13);
  assert.equal(sent.length, 1);
  assert.match(sent[0], /Novedades de hoy/);
});

test('si la respuesta falla, el comando se vuelve a leer la próxima vez', async () => {
  const next = await handleCommands({
    updates: [upd(10, 'hola'), upd(11, '/novedades'), upd(12, '/semana')],
    chatId: 42, recent: [], now: NOW, send: async () => { throw new Error('down'); }, log: () => {}, offset: 0,
  });
  assert.equal(next, 11);
});

test('el historial guarda lo enviado y olvida lo de más de 7 días', async () => {
  const state = { ...emptyState(), seededSources: ['a'], lastDigest: '2026-11-13', recent: [r('viejo', 'iRacing', 'official', NOW - 8 * DAY)] };
  const item = { id: 'n1', sourceKey: 'a', game: 'iRacing', kind: 'official', source: 's', title: 'Nuevo', url: 'https://x/n1', date: NOW - 1000 };
  const res = await run({ state, now: NOW, send: async () => {}, log: () => {}, tasks: [{ label: 'a', run: async () => [{ sourceKey: 'a', items: [item] }] }] });
  assert.deepEqual(res.state.recent.map((x) => [x.title, x.sentAt]), [['Nuevo', NOW]]);
});
