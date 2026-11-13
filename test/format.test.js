import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatItem, formatDigest, splitMessage } from '../src/format.js';

const base = { game: 'iRacing', source: 'iracing.com', title: 'A <b> & C', url: 'https://x/?a=1&b=2', date: Date.UTC(2026, 10, 13, 15) };

test('aviso oficial: encabezado y texto escapado', () => {
  const t = formatItem({ ...base, kind: 'official' });
  assert.match(t, /^<b>✅ OFICIAL · iRacing<\/b>/);
  assert.match(t, /A &lt;b&gt; &amp; C/);
  assert.match(t, /href="https:\/\/x\/\?a=1&amp;b=2"/);
  assert.doesNotMatch(t, /sin confirmación/);
  assert.match(t, /13\/11.*12:00/); // hora Argentina
});

test('aviso de adelanto: lleva la advertencia', () => {
  const t = formatItem({ ...base, kind: 'advance' });
  assert.match(t, /🟡 ADELANTO/);
  assert.match(t, /Todavía sin confirmación oficial/);
});

test('resumen agrupa por tipo', () => {
  const t = formatDigest([{ ...base, kind: 'advance' }, { ...base, kind: 'official' }, { ...base, kind: 'official' }]);
  assert.match(t, /2 novedades|3 novedades/);
  assert.match(t, /✅ OFICIAL \(2\)/);
  assert.match(t, /🟡 ADELANTO \(1\)/);
  assert.ok(t.indexOf('OFICIAL') < t.indexOf('ADELANTO'));
  assert.match(formatDigest([]), /no hubo novedades/);
});

test('mensajes largos se parten', () => {
  const parts = splitMessage(Array(300).fill('x'.repeat(50)).join('\n'));
  assert.ok(parts.length > 1 && parts.every((p) => p.length <= 4000));
});
