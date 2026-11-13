// Punto de entrada: lo ejecuta GitHub Actions cada 15 minutos.
//   DRY_RUN=1  -> imprime los mensajes en vez de mandarlos a Telegram
//   STATE_FILE -> ruta del archivo de estado (por defecto state.json)
import { readFile, writeFile } from 'node:fs/promises';
import { run, emptyState } from './run.js';
import { sendMessage, getUpdates, setMyCommands } from './telegram.js';
import { handleCommands, COMMAND_MENU } from './commands.js';
import { SETTINGS } from './config.js';

const STATE_FILE = process.env.STATE_FILE ?? 'state.json';
const dryRun = process.env.DRY_RUN === '1';
const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

if (!dryRun && (!token || !chatId)) {
  console.error('Faltan TELEGRAM_BOT_TOKEN y/o TELEGRAM_CHAT_ID (o usá DRY_RUN=1 para probar).');
  process.exit(1);
}

const fetchFn = (url, opts = {}) =>
  fetch(url, { ...opts, headers: { 'user-agent': SETTINGS.userAgent, ...opts.headers }, signal: AbortSignal.timeout(SETTINGS.timeoutMs) });

let state;
try {
  state = JSON.parse(await readFile(STATE_FILE, 'utf8'));
} catch {
  console.log('No hay estado previo: primer arranque.');
  state = emptyState();
}

const send = dryRun
  ? async (text) => console.log(`\n----- MENSAJE -----\n${text}\n-------------------`)
  : (text) => sendMessage(text, { token, chatId, fetchFn });

const result = await run({ state, fetchFn, send });

// Comandos (/novedades, /semana, /juego): se leen los mensajes que le escribiste al bot y se responden.
if (!dryRun) {
  const s = result.state;
  try {
    if (!s.commandsRegistered) {
      await setMyCommands(COMMAND_MENU, { token, fetchFn });
      s.commandsRegistered = true;
    }
    const updates = await getUpdates(s.updateOffset, { token, fetchFn });
    s.updateOffset = await handleCommands({ updates, chatId, recent: s.recent, now: Date.now(), send, offset: s.updateOffset });
  } catch (err) {
    console.log(`⚠️ No se pudieron leer los comandos: ${err.message}`);
  }
}

await writeFile(STATE_FILE, `${JSON.stringify(result.state, null, 1)}\n`);

// Si Telegram rechazó la conexión, marcar la corrida en rojo en GitHub para que se note.
if (result.errors.includes('telegram')) {
  console.error('❌ Telegram rechazó el mensaje: revisá TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID en los secretos.');
  process.exit(1);
}
