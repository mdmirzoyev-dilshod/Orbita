// ИИ: распознавание голосовых (речь → текст) и разбор сообщений (текст → действия).
// Работает с OpenAI API (или совместимым сервисом через AI_BASE_URL). Ключ — переменная OPENAI_API_KEY.
const KEY = process.env.OPENAI_API_KEY || process.env.AI_API_KEY || '';
const BASE = (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
const MODEL = process.env.AI_MODEL || 'gpt-4o-mini';
const STT_MODEL = process.env.AI_STT_MODEL || 'whisper-1';

const enabled = () => Boolean(KEY);

async function transcribe(buf, hint = '') {
  const fd = new FormData();
  fd.append('file', new Blob([buf], { type: 'audio/ogg' }), 'voice.ogg');
  fd.append('model', STT_MODEL);
  if (hint) fd.append('prompt', hint.slice(0, 800));
  const r = await fetch(`${BASE}/audio/transcriptions`, { method: 'POST', headers: { authorization: `Bearer ${KEY}` }, body: fd });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j.error && j.error.message) || `Ошибка распознавания (${r.status})`);
  return String(j.text || '').trim();
}

async function json(system, user) {
  const r = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, temperature: 0, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j.error && j.error.message) || `Ошибка ИИ (${r.status})`);
  const text = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
  try { return JSON.parse(text || '{}'); } catch { return {}; }
}

module.exports = { enabled, transcribe, json, MODEL, STT_MODEL };
