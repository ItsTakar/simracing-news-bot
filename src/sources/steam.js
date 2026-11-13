// Fuentes de Steam: anuncios oficiales y detección de DLC nuevos.

const OFFICIAL_FEED = 'steam_community_announcements';

async function getJson(url, fetchFn) {
  const res = await fetchFn(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  return res.json();
}

// Anuncios que el estudio publica en la página de Steam del juego.
// Steam también mezcla notas de medios externos (otros "feedname"): se ignoran,
// porque suelen ser reseñas o portales en otros idiomas y no aportan adelantos.
export async function fetchSteamNews(game, fetchFn) {
  const url = `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=${game.steamId}&count=10&maxlength=1&format=json`;
  const data = await getJson(url, fetchFn);
  const items = data?.appnews?.newsitems ?? [];
  return items
    .filter((n) => n.feedname === OFFICIAL_FEED)
    .map((n) => ({
      id: `steam:${n.gid}`,
      sourceKey: `steamnews:${game.key}`,
      game: game.name,
      kind: 'official',
      source: 'Steam (anuncio oficial)',
      title: n.title,
      url: n.url,
      date: n.date * 1000,
    }));
}

// Lista de IDs de DLC que figuran en la ficha de Steam del juego.
export async function fetchSteamDlcIds(game, fetchFn) {
  const url = `https://store.steampowered.com/api/appdetails?appids=${game.steamId}&filters=basic`;
  const data = await getJson(url, fetchFn);
  const entry = data?.[game.steamId];
  if (!entry?.success) throw new Error(`Steam no devolvió datos para ${game.name}`);
  return (entry.data.dlc ?? []).map(Number);
}

// Nombre de un DLC. Si todavía está oculto en la tienda, devuelve null.
export async function fetchDlcName(dlcId, fetchFn) {
  try {
    const data = await getJson(`https://store.steampowered.com/api/appdetails?appids=${dlcId}&filters=basic`, fetchFn);
    return data?.[dlcId]?.success ? data[dlcId].data.name : null;
  } catch {
    return null;
  }
}

export function dlcToItem(game, dlcId, name, now) {
  return {
    id: `dlc:${game.key}:${dlcId}`,
    sourceKey: `dlc:${game.key}`,
    game: game.name,
    kind: 'advance',
    source: 'Steam (DLC nuevo en la ficha del juego)',
    title: `Nuevo DLC detectado en Steam: "${name ?? `DLC #${dlcId} (todavía sin nombre público)`}"`,
    url: `https://store.steampowered.com/app/${dlcId}/`,
    date: now,
  };
}
