async function call(method, payload, { token, fetchFn = fetch }) {
  const res = await fetchFn(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) throw new Error(`Telegram respondió ${res.status}: ${body.description ?? 'error desconocido'}`);
  return body.result;
}

export function sendMessage(text, { token, chatId, fetchFn }) {
  return call('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: false }, { token, fetchFn });
}

// Mensajes que le escribieron al bot desde la última vez (offset = último update_id + 1).
export function getUpdates(offset, { token, fetchFn }) {
  return call('getUpdates', { offset, timeout: 0, allowed_updates: ['message'] }, { token, fetchFn });
}

// Menú de comandos que aparece al tocar "/" en el chat del bot.
export function setMyCommands(commands, { token, fetchFn }) {
  return call('setMyCommands', { commands }, { token, fetchFn });
}
