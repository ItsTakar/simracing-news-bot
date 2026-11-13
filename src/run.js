// Una corrida del bot: leer fuentes -> filtrar lo nuevo -> avisar -> actualizar estado.
import { GAMES, FEEDS, SETTINGS } from './config.js';
import { fetchSteamNews, fetchSteamDlcIds, fetchDlcName, dlcToItem } from './sources/steam.js';
import { fetchFeed } from './sources/rss.js';
import { formatItem, formatDigest, splitMessage } from './format.js';

const DAY = 24 * 60 * 60 * 1000;

export const emptyState = () => ({ seen: {}, seededSources: [], dlc: {}, today: [], lastDigest: null });

// Cada tarea devuelve { sourceKey, items }. Si una fuente falla, se registra y se sigue.
function buildTasks(fetchFn, now) {
  const tasks = [];
  for (const game of GAMES.filter((g) => g.steamId)) {
    tasks.push({ label: `Steam noticias ${game.name}`, run: async () => [{ sourceKey: `steamnews:${game.key}`, items: await fetchSteamNews(game, fetchFn) }] });
    tasks.push({ label: `Steam DLC ${game.name}`, run: async () => [{ sourceKey: `dlc:${game.key}`, dlcGame: game, dlcIds: await fetchSteamDlcIds(game, fetchFn) }] });
  }
  // Las fuentes opcionales (Reddit) se piden de a una, separadas, porque si no limitan las consultas.
  let stagger = 0;
  for (const feed of FEEDS) {
    const delay = feed.optional ? stagger++ * 3000 : 0;
    tasks.push({
      label: feed.name,
      optional: feed.optional,
      run: async () => {
        if (delay) await new Promise((r) => setTimeout(r, delay));
        return [{ sourceKey: `feed:${feed.key}`, items: await fetchFeed(feed, fetchFn) }];
      },
    });
  }
  return tasks;
}

export async function run({ state, now = Date.now(), fetchFn, send, log = console.log, tasks }) {
  state = { ...emptyState(), ...structuredClone(state) };
  const errors = [];

  const results = await Promise.all(
    (tasks ?? buildTasks(fetchFn, now)).map(async (t) => {
      try {
        return await t.run();
      } catch (err) {
        (t.optional ? log : (m) => { errors.push(m); log(m); })(`⚠️ Falló "${t.label}": ${err.message}`);
        return [];
      }
    }),
  );

  const candidates = [];
  for (const r of results.flat()) {
    const firstTime = !state.seededSources.includes(r.sourceKey);

    if (r.dlcIds) {
      const known = new Set(state.dlc[r.dlcGame.key] ?? []);
      const fresh = firstTime ? [] : r.dlcIds.filter((id) => !known.has(id));
      // Los DLC nuevos se marcan como conocidos recién cuando el aviso sale bien.
      state.dlc[r.dlcGame.key] = [...new Set([...known, ...r.dlcIds.filter((id) => !fresh.includes(id))])];
      for (const id of fresh) {
        const item = dlcToItem(r.dlcGame, id, await fetchDlcName(id, fetchFn), now);
        item.dlcRef = { gameKey: r.dlcGame.key, id };
        candidates.push(item);
      }
    } else if (firstTime) {
      // Primera vez que vemos esta fuente: registrar lo que ya existe sin avisar.
      for (const it of r.items) state.seen[it.id] = now;
    } else {
      candidates.push(...r.items);
    }
    if (firstTime) {
      state.seededSources.push(r.sourceKey);
      log(`🌱 Fuente nueva registrada sin avisar: ${r.sourceKey}`);
    }
  }

  // Filtrar: no vistos, no repetidos en esta corrida, no viejos. Más viejos primero.
  const unique = new Map();
  for (const it of candidates) {
    if (state.seen[it.id] || unique.has(it.id)) continue;
    if (it.date && now - it.date > SETTINGS.maxAgeDays * DAY) { state.seen[it.id] = now; continue; }
    unique.set(it.id, it);
  }
  const toSend = [...unique.values()].sort((a, b) => a.date - b.date).slice(0, SETTINGS.maxPerRun);

  let sent = 0;
  for (const item of toSend) {
    try {
      await send(formatItem(item));
      state.seen[item.id] = now;
      if (item.dlcRef) state.dlc[item.dlcRef.gameKey].push(item.dlcRef.id);
      state.today.push({ game: item.game, kind: item.kind, title: item.title, url: item.url });
      sent++;
    } catch (err) {
      log(`⚠️ No se pudo enviar "${item.title}": ${err.message} (se reintenta en la próxima corrida)`);
    }
  }

  // Resumen diario: una vez por día, en la primera corrida a partir de la hora configurada.
  const d = new Date(now);
  const todayKey = d.toISOString().slice(0, 10);
  if (state.lastDigest === null) {
    // Primer arranque: en vez de un resumen vacío, un mensaje que confirma que la conexión anda.
    try {
      await send(`🏁 <b>Bot de novedades activo</b>\nYa registré ${Object.keys(state.seen).length} noticias existentes. A partir de ahora te aviso solo lo nuevo.`);
      state.lastDigest = todayKey;
    } catch (err) {
      log(`⚠️ No se pudo enviar el mensaje de bienvenida: ${err.message}`);
      errors.push('telegram');
    }
  } else if (d.getUTCHours() >= SETTINGS.digestUtcHour && state.lastDigest !== todayKey) {
    try {
      for (const chunk of splitMessage(formatDigest(state.today))) await send(chunk);
      state.today = [];
      state.lastDigest = todayKey;
      log('🌙 Resumen del día enviado');
    } catch (err) {
      log(`⚠️ No se pudo enviar el resumen: ${err.message}`);
    }
  }

  // Olvidar IDs muy viejos para que el archivo no crezca para siempre.
  for (const [id, ts] of Object.entries(state.seen)) if (now - ts > SETTINGS.pruneSeenDays * DAY) delete state.seen[id];

  log(`✔ Corrida terminada: ${sent} aviso(s) enviado(s), ${unique.size - sent} pendiente(s), ${errors.length} fuente(s) con error`);
  return { state, sent, errors };
}
