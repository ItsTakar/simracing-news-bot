// Formato de los mensajes de Telegram (HTML). Nunca se reescribe el contenido:
// solo título, fuente, fecha y link originales.

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const LABEL = { official: '✅ OFICIAL', advance: '🟡 ADELANTO' };

const fmtDate = (ms) =>
  new Date(ms).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });

export function formatItem(item) {
  const lines = [
    `<b>${LABEL[item.kind]} · ${esc(item.game)}</b>`,
    esc(item.title),
    `<i>${esc(item.source)} · ${fmtDate(item.date)}</i>`,
  ];
  if (item.kind === 'advance') lines.push('⚠️ Todavía sin confirmación oficial');
  lines.push(`🔗 <a href="${esc(item.url)}">Ver fuente original</a>`);
  return lines.join('\n');
}

export function formatDigest(items) {
  if (!items.length) return '🌙 <b>Resumen del día</b>\nHoy no hubo novedades.';
  const parts = [`🌙 <b>Resumen del día</b> — ${items.length} novedad${items.length === 1 ? '' : 'es'}`];
  for (const kind of ['official', 'advance']) {
    const group = items.filter((i) => i.kind === kind);
    if (!group.length) continue;
    parts.push('', `<b>${LABEL[kind]} (${group.length})</b>`);
    for (const i of group) parts.push(`• <b>${esc(i.game)}</b>: <a href="${esc(i.url)}">${esc(i.title)}</a>`);
  }
  return parts.join('\n');
}

// Telegram acepta hasta 4096 caracteres por mensaje: se corta por líneas.
export function splitMessage(text, max = 4000) {
  const chunks = [];
  let cur = '';
  for (const line of text.split('\n')) {
    if (cur && cur.length + line.length + 1 > max) { chunks.push(cur); cur = ''; }
    cur = cur ? `${cur}\n${line}` : line;
  }
  if (cur) chunks.push(cur);
  return chunks;
}
