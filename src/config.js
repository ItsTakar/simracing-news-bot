// ============================================================
//  CONFIGURACIÓN: acá se agregan o sacan juegos y fuentes.
// ============================================================

// Juegos que sigue el bot.
// - steamId: el número que aparece en la URL de la tienda de Steam
//   (store.steampowered.com/app/<steamId>/...). null si no está en Steam.
// - keywords: palabras para reconocer el juego en noticias de medios y Reddit
//   (en minúsculas). Las más específicas van primero.
export const GAMES = [
  { key: 'acevo', name: 'Assetto Corsa EVO', steamId: 3058630, keywords: ['assetto corsa evo', 'ac evo', 'acevo'] },
  { key: 'acrally', name: 'Assetto Corsa Rally', steamId: 3917090, keywords: ['assetto corsa rally', 'ac rally'] },
  { key: 'acc', name: 'Assetto Corsa Competizione', steamId: 805550, keywords: ['assetto corsa competizione', 'competizione', 'acc'] },
  { key: 'ac', name: 'Assetto Corsa', steamId: 244210, keywords: ['assetto corsa', 'kunos'] },
  { key: 'lmu', name: 'Le Mans Ultimate', steamId: 2399420, keywords: ['le mans ultimate', 'lmu', 'studio 397', 'studio397'] },
  { key: 'iracing', name: 'iRacing', steamId: 266410, keywords: ['iracing'] },
  { key: 'rf2', name: 'rFactor 2', steamId: 365960, keywords: ['rfactor 2', 'rfactor2', 'rf2'] },
];

// Fuentes RSS / YouTube / Reddit.
// - type: 'official' (✅ lo publica el estudio) o 'advance' (🟡 adelanto, sin confirmar).
// - game: si la fuente es de un solo juego, su key. Si no, se detecta por el texto.
// - filter:
//     'game'       -> solo pasa si menciona un juego seguido
//     'game+news'  -> además tiene que sonar a novedad (patch, update, dlc, leak...)
//     'news'       -> el juego ya es fijo, solo tiene que sonar a novedad
//     (sin filter) -> pasa todo
export const FEEDS = [
  // Oficiales
  { key: 'iracing-web', name: 'iracing.com', url: 'https://www.iracing.com/feed/', type: 'official', game: 'iracing' },
  { key: 'yt-iracing', name: 'YouTube iRacing', url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCGtc7c4fHCySr5BNN-OxwGA', type: 'official', game: 'iracing' },
  { key: 'yt-kunos', name: 'YouTube Kunos Simulazioni', url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCC6EIwxMsAxM78LpCCXpltQ', type: 'official', game: 'ac' },
  { key: 'yt-studio397', name: 'YouTube Studio 397', url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC9Ejp75R_b6JghllLoc5I9g', type: 'official', game: 'lmu' },
  { key: 'yt-lmu', name: 'YouTube Le Mans Ultimate', url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCenZuLqOaYxsoxH8Sn4gkrg', type: 'official', game: 'lmu' },

  // Adelantos: medios que entrevistan a los devs
  { key: 'traxion', name: 'Traxion.gg', url: 'https://traxion.gg/feed/', type: 'advance', filter: 'game' },
  { key: 'simracinginfo', name: 'Sim Racing Info', url: 'https://www.simracinginfo.com/rss/', type: 'advance', filter: 'game' },

  // Adelantos: Reddit (opcional, a veces Reddit limita las consultas)
  { key: 'r-simracing', name: 'r/simracing', url: 'https://www.reddit.com/r/simracing/new/.rss', type: 'advance', filter: 'game+news', optional: true },
  { key: 'r-iracing', name: 'r/iRacing', url: 'https://www.reddit.com/r/iRacing/new/.rss', type: 'advance', game: 'iracing', filter: 'news', optional: true },
  { key: 'r-assettocorsa', name: 'r/assettocorsa', url: 'https://www.reddit.com/r/assettocorsa/new/.rss', type: 'advance', filter: 'game+news', optional: true },
  { key: 'r-acc', name: 'r/ACCompetizione', url: 'https://www.reddit.com/r/ACCompetizione/new/.rss', type: 'advance', game: 'acc', filter: 'news', optional: true },
  { key: 'r-lmu', name: 'r/LeMansUltimateWEC', url: 'https://www.reddit.com/r/LeMansUltimateWEC/new/.rss', type: 'advance', game: 'lmu', filter: 'news', optional: true },
];

// Palabras que hacen que un post "suene a novedad".
export const NEWS_WORDS = [
  'patch', 'update', 'hotfix', 'dlc', 'leak', 'leaked', 'datamine', 'roadmap', 'season',
  'announce', 'announced', 'announcement', 'release', 'released', 'new car', 'new track',
  'build', 'confirmed', 'coming', 'beta', 'preview', 'devlog', 'dev blog', 'teaser',
  'trailer', 'early access', 'v1.', 'version', 'changelog', 'release notes',
];

export const SETTINGS = {
  maxPerRun: 20,          // máximo de avisos por corrida (el resto va en la siguiente)
  maxAgeDays: 7,          // nunca avisar cosas más viejas que esto
  pruneSeenDays: 60,      // olvidar IDs vistos después de esto
  digestUtcHour: 3,       // 03:00 UTC = 00:00 en Argentina
  userAgent: 'simracing-news-bot/1.0 (personal news notifier)',
  timeoutMs: 20000,
};
