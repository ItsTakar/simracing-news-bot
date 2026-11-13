// Comandos que se le pueden escribir al bot. Se responden en la siguiente corrida (cada ~15 min).
import { GAMES } from './config.js';
import { esc, splitMessage } from './format.js';

const DAY = 24 * 60 * 60 * 1000;
const ART_OFFSET = 3 * 60 * 60 * 1000; // Argentina = UTC-3, sin horario de verano

export const COMMAND_MENU = [
  { command: 'novedades', description: 'Lo que salió hoy' },
  { command: 'semana', description: 'Lo de los últimos 7 días' },
  { command: 'juego', description: 'Lo de la semana de un juego (ej: /juego lmu)' },
  { command: 'ayuda', description: 'Cómo usar el bot' },
];

const LABEL = { official: '✅ OFICIAL', advance: '🟡 ADELANTO' };

export function startOfTodayArgentina(now) {
  return Math.floor((now - ART_OFFSET) / DAY) * DAY + ART_OFFSET;
}

const fmtDay = (ms) => new Date(ms).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit' });

function listing(title, items, withDate) {
  if (!items.length) return `${title}\nNo hay novedades en este período.`;
  const parts = [`${title} — ${items.length} novedad${items.length === 1 ? '' : 'es'}`];
  for (const kind of ['official', 'advance']) {
    const group = items.filter((i) => i.kind === kind).sort((a, b) => b.sentAt - a.sentAt);
    if (!group.length) continue;
    parts.push('', `<b>${LABEL[kind]} (${group.length})</b>`);
    for (const i of group) parts.push(`• ${withDate ? `${fmtDay(i.sentAt)} ` : ''}<b>${esc(i.game)}</b>: <a href="${esc(i.url)}">${esc(i.title)}</a>`);
  }
  return parts.join('\n');
}

const gameList = () => GAMES.map((g) => `<code>${g.key}</code> = ${esc(g.name)}`).join('\n');

const HELP = () =>
  [
    '🏁 <b>Comandos</b>',
    '/novedades — lo que salió hoy',
    '/semana — lo de los últimos 7 días',
    '/juego <i>clave</i> — lo de la semana de un juego, por ejemplo <code>/juego lmu</code>',
    '',
    '<b>Claves de juegos:</b>',
    gameList(),
    '',
    '⏱ El bot revisa cada ~15 minutos, así que la respuesta puede tardar un rato.',
  ].join('\n');

// Devuelve el texto de respuesta para un mensaje, o null si no es un comando.
export function replyFor(text, recent, now) {
  const [rawCmd, ...args] = text.trim().split(/\s+/);
  if (!rawCmd?.startsWith('/')) return null;
  const cmd = rawCmd.slice(1).split('@')[0].toLowerCase();
  const week = recent.filter((r) => now - r.sentAt <= 7 * DAY);

  switch (cmd) {
    case 'novedades':
    case 'hoy':
      return listing('📰 <b>Novedades de hoy</b>', recent.filter((r) => r.sentAt >= startOfTodayArgentina(now)), false);
    case 'semana':
      return listing('📅 <b>Últimos 7 días</b>', week, true);
    case 'juego': {
      const key = (args[0] ?? '').toLowerCase();
      const game = GAMES.find((g) => g.key === key);
      if (!game) return `Decime qué juego, por ejemplo <code>/juego lmu</code>.\n\n<b>Claves de juegos:</b>\n${gameList()}`;
      return listing(`🎮 <b>${esc(game.name)}</b> — últimos 7 días`, week.filter((r) => r.game === game.name), true);
    }
    case 'start':
    case 'ayuda':
    case 'help':
      return HELP();
    default:
      return `No conozco ese comando.\n\n${HELP()}`;
  }
}

// Procesa los mensajes recibidos. Solo responde a tu chat (ignora a cualquier otra persona).
// Devuelve el nuevo offset para no volver a leer los mismos mensajes.
export async function handleCommands({ updates, chatId, recent, now, send, log = console.log, offset = 0 }) {
  let next = offset;
  for (const u of updates) {
    const msg = u.message;
    if (msg?.text && String(msg.chat?.id) !== String(chatId)) {
      log(`Ignorado mensaje de un chat desconocido (${msg.chat?.id})`);
    } else if (msg?.text) {
      const reply = replyFor(msg.text, recent, now);
      if (reply) {
        try {
          for (const chunk of splitMessage(reply)) await send(chunk);
          log(`💬 Respondido: ${msg.text}`);
        } catch (err) {
          log(`⚠️ No se pudo responder "${msg.text}": ${err.message} (se reintenta en la próxima corrida)`);
          return next; // no avanzar: este mensaje se vuelve a leer la próxima vez
        }
      }
    }
    next = Math.max(next, u.update_id + 1);
  }
  return next;
}
