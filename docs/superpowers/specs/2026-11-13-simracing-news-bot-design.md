# Bot de novedades de simracing — diseño

Fecha: 2026-11-13 · Estado: aprobado por el usuario

## Para qué

El usuario está arrancando un canal de contenido de simracing. Quiere enterarse **antes que nadie** y con información **real** de las novedades de Assetto Corsa, AC EVO, ACC, AC Rally, Le Mans Ultimate, iRacing y rFactor 2 para preparar contenido. Las notificaciones son **para él**, no para publicar: se manda todo lo relevante, aunque sea chico.

## Objetivos
- Avisar por Telegram de cada novedad de fuentes oficiales.
- Avisar de "adelantos": señales tempranas de fuentes con buen historial, separadas visualmente de lo oficial.
- Correr 24/7 sin depender de la PC del usuario, gratis.
- Resumen diario a la medianoche (hora Argentina).
- Agregar/quitar juegos y fuentes editando una sola lista.

## No-objetivos
- No publica en un canal público (posible en el futuro).
- No lee Discord ni X/Twitter (ToS / API paga).
- Guía de compras de iRacing: proyecto aparte, después.

## Anti-objetivos (sería un fracaso aunque funcione)
- Que un rumor se vea igual que algo oficial.
- Que el bot invente, reescriba o "resuma con IA" contenido: solo título, fuente, fecha y link originales.
- Spam: avisos repetidos o una avalancha de noticias viejas en el primer arranque.
- Saltear protecciones anti-bot de sitios (OverTake y Bsimracing quedan fuera por eso).

## Enfoques considerados
1. Script en la PC del usuario — simple, pero solo avisa con la PC prendida.
2. **Script en GitHub Actions cada 15 min — elegido.** Gratis, 24/7, sin servidor.
3. Bot de RSS de terceros — rápido pero sin filtros, sin etiquetas oficial/adelanto, depende de otro servicio.

## Fuentes (verificadas el 2026-11-13)

| Tipo | Fuente | Cómo |
|---|---|---|
| ✅ Oficial | Anuncios de Steam de los 7 juegos | Steam `ISteamNews/GetNewsForApp`, `feedname = steam_community_announcements` |
| ✅ Oficial | iracing.com | RSS `https://www.iracing.com/feed/` |
| ✅ Oficial | YouTube: iRacing, Kunos, Studio 397, Le Mans Ultimate | RSS de canal de YouTube |
| 🟡 Adelanto | DLC nuevos que aparecen en la ficha de Steam | Steam `appdetails` → lista `dlc`, se compara con la última vista |
| 🟡 Adelanto | Traxion, Sim Racing Info | RSS, solo ítems que mencionan un juego seguido |
| 🟡 Adelanto | Reddit: r/simracing, r/iRacing, r/assettocorsa, r/ACCompetizione, r/LeMansUltimateWEC | RSS; filtro por juego + palabras de novedad (patch, update, dlc, leak, roadmap, season, announce…). Opcional: si falla (429/403), se ignora sin cortar el resto |

IDs de Steam: AC 244210 · ACC 805550 · AC EVO 3058630 · AC Rally 3917090 · LMU 2399420 · iRacing 266410 · rFactor 2 365960.

Descartado durante la construcción: notas de prensa externas que Steam mezcla en las noticias (resultaron ser portales en otros idiomas, ruido). Descartado: detectar builds en ramas beta de Steam (requiere SteamCMD/SteamDB, que bloquea bots).

## Cómo funciona
- Node 24 (ESM), una sola dependencia (`fast-xml-parser`), tests con `node:test`.
- Cada corrida: lee todas las fuentes en paralelo → normaliza a `{id, game, kind: official|advance, source, title, url, date}` → descarta lo ya visto → manda a Telegram → guarda estado.
- Estado en `state.json` dentro del repo (IDs vistos con fecha, DLC conocidos por juego, ítems del día para el resumen). El workflow lo commitea si cambió. IDs vistos se podan a los 60 días.
- **Primer arranque de cada fuente**: registra lo existente sin avisar (evita avalancha).
- Solo se avisa de ítems de los últimos 7 días (protección extra).
- Corrida de las 03:00 UTC (00:00 ART) además manda el resumen del día y lo vacía.
- Una fuente que falla se loguea y no afecta a las demás; si falla Telegram no se marca como visto (se reintenta).
- Mensajes en HTML de Telegram, con texto escapado; máx. ~20 avisos por corrida, el resto queda para la siguiente.
- Secretos `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` en GitHub Secrets. `DRY_RUN=1` imprime en vez de enviar.

## Hosting
Repo **público** en GitHub (Actions ilimitado gratis; en privado, cada 15 min excede los 2000 min/mes). Los secretos no quedan expuestos. GitHub puede demorar el cron 5–20 min; aceptable.

## Decisiones tomadas por Claude (el usuario puede corregir)
- Node en vez de Python (no hay Python instalado en la PC del usuario; da igual en la nube).
- Zona horaria Argentina para el resumen.
- Medios y Reddit se clasifican como 🟡 Adelanto, nunca como ✅ Oficial.
- Sin IA en los mensajes.
