import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run, emptyState } from '../src/run.js';
import { GAMES } from '../src/config.js';

const NOW = Date.UTC(2026, 10, 13, 15); // 15:00 UTC, después de la hora del resumen
const DAY = 86400000;
const quiet = () => {};
const item = (id, extra = {}) => ({ id, sourceKey: 's', game: 'iRacing', kind: 'official', source: 'x', title: id, url: `https://x/${id}`, date: NOW - 1000, ...extra });
const task = (sourceKey, items, extra = {}) => ({ label: sourceKey, run: async () => [{ sourceKey, items }], ...extra });
const seeded = (keys, extra = {}) => ({ ...emptyState(), seededSources: keys, lastDigest: '2026-11-13', ...extra });
const collector = () => { const sent = []; return { sent, send: async (t) => { sent.push(t); } }; };

test('fuente nueva: registra lo existente sin avisar', async () => {
  const { sent, send } = collector();
  const r = await run({ state: emptyState(), now: NOW, send, log: quiet, tasks: [task('a', [item('1'), item('2')])] });
  assert.equal(sent.length, 0);
  assert.deepEqual(r.state.seededSources, ['a']);
  assert.ok(r.state.seen['1'] && r.state.seen['2']);
  assert.equal(r.state.lastDigest, '2026-11-13'); // no manda resumen vacío en el primer arranque
});

test('avisa lo nuevo una sola vez, aunque venga de dos fuentes', async () => {
  const { sent, send } = collector();
  let r = await run({ state: seeded(['a', 'b']), now: NOW, send, log: quiet, tasks: [task('a', [item('1')]), task('b', [item('1')])] });
  assert.equal(sent.length, 1);
  r = await run({ state: r.state, now: NOW + 1, send, log: quiet, tasks: [task('a', [item('1')])] });
  assert.equal(sent.length, 1);
});

test('una fuente caída no frena a las demás', async () => {
  const { sent, send } = collector();
  const boom = { label: 'reddit', optional: true, run: async () => { throw new Error('HTTP 429'); } };
  const r = await run({ state: seeded(['a']), now: NOW, send, log: quiet, tasks: [boom, task('a', [item('1')])] });
  assert.equal(sent.length, 1);
  assert.equal(r.errors.length, 0); // las opcionales no cuentan como error
});

test('si Telegram falla, se reintenta en la próxima corrida', async () => {
  const failing = async () => { throw new Error('down'); };
  let r = await run({ state: seeded(['a']), now: NOW, send: failing, log: quiet, tasks: [task('a', [item('1')])] });
  assert.equal(r.state.seen['1'], undefined);
  const { sent, send } = collector();
  r = await run({ state: r.state, now: NOW + 1, send, log: quiet, tasks: [task('a', [item('1')])] });
  assert.equal(sent.length, 1);
});

test('no avisa cosas de más de 7 días', async () => {
  const { sent, send } = collector();
  await run({ state: seeded(['a']), now: NOW, send, log: quiet, tasks: [task('a', [item('old', { date: NOW - 8 * DAY })])] });
  assert.equal(sent.length, 0);
});

test('máximo 20 por corrida, el resto queda para la siguiente', async () => {
  const many = Array.from({ length: 25 }, (_, i) => item(`n${i}`, { date: NOW - 1000 + i }));
  const { sent, send } = collector();
  let r = await run({ state: seeded(['a']), now: NOW, send, log: quiet, tasks: [task('a', many)] });
  assert.equal(sent.length, 20);
  assert.match(sent[0], /n0/); // del más viejo al más nuevo
  r = await run({ state: r.state, now: NOW + 1, send, log: quiet, tasks: [task('a', many)] });
  assert.equal(sent.length, 25);
});

test('resumen diario: una vez por día, después de las 03:00 UTC, y vacía la lista', async () => {
  const { sent, send } = collector();
  const state = seeded(['a'], { lastDigest: '2026-11-12', today: [{ game: 'iRacing', kind: 'official', title: 'T', url: 'https://x' }] });
  const early = await run({ state, now: Date.UTC(2026, 10, 13, 2), send, log: quiet, tasks: [] });
  assert.equal(sent.length, 0);
  let r = await run({ state: early.state, now: NOW, send, log: quiet, tasks: [] });
  assert.equal(sent.length, 1);
  assert.match(sent[0], /Resumen del día/);
  assert.deepEqual(r.state.today, []);
  r = await run({ state: r.state, now: NOW + 3600000, send, log: quiet, tasks: [] });
  assert.equal(sent.length, 1);
});

test('olvida IDs vistos hace más de 60 días', async () => {
  const r = await run({ state: seeded([], { seen: { viejo: NOW - 61 * DAY, nuevo: NOW - DAY } }), now: NOW, send: async () => {}, log: quiet, tasks: [] });
  assert.deepEqual(Object.keys(r.state.seen), ['nuevo']);
});

test('DLC nuevo: avisa con nombre; si el envío falla, lo vuelve a intentar', async () => {
  const lmu = GAMES.find((g) => g.key === 'lmu');
  const dlcTask = (ids) => ({ label: 'dlc', run: async () => [{ sourceKey: 'dlc:lmu', dlcGame: lmu, dlcIds: ids }] });
  const fetchFn = async () => ({ ok: true, json: async () => ({ 7: { success: true, data: { name: 'LMU - 2027 Season Pass' } } }) });

  let r = await run({ state: emptyState(), now: NOW, send: async () => {}, fetchFn, log: quiet, tasks: [dlcTask([1, 2])] });
  assert.deepEqual(r.state.dlc.lmu, [1, 2]);

  r = await run({ state: r.state, now: NOW, send: async () => { throw new Error('down'); }, fetchFn, log: quiet, tasks: [dlcTask([1, 2, 7])] });
  assert.deepEqual(r.state.dlc.lmu, [1, 2]);

  const { sent, send } = collector();
  r = await run({ state: r.state, now: NOW, send, fetchFn, log: quiet, tasks: [dlcTask([1, 2, 7])] });
  assert.equal(sent.length, 1);
  assert.match(sent[0], /🟡 ADELANTO · Le Mans Ultimate/);
  assert.match(sent[0], /LMU - 2027 Season Pass/);
  assert.deepEqual(r.state.dlc.lmu, [1, 2, 7]);
});
