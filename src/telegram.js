export async function sendMessage(text, { token, chatId, fetchFn = fetch }) {
  const res = await fetchFn(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: false }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) throw new Error(`Telegram respondió ${res.status}: ${body.description ?? 'error desconocido'}`);
}
