// ИИ: распознавание голосовых (речь → текст) и разбор сообщений (текст → действия).
// Работает с OpenAI API (или совместимым сервисом через AI_BASE_URL). Ключ — переменная OPENAI_API_KEY.
// Если модель недоступна (снята с продажи, переименована), автоматически пробуется следующая из списка.
const KEY = process.env.OPENAI_API_KEY || process.env.AI_API_KEY || '';
const BASE = (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
const uniq = a => [...new Set(a.filter(Boolean))];
const CHAT_MODELS = uniq([process.env.AI_MODEL, 'gpt-4o-mini', 'gpt-6-luna', 'gpt-4.1-mini', 'gpt-5-mini']);
const STT_MODELS = uniq([process.env.AI_STT_MODEL, 'gpt-4o-mini-transcribe', 'gpt-transcribe', 'whisper-1']);
let chatIdx = 0, sttIdx = 0;   // запоминаем рабочую модель

const enabled = () => Boolean(KEY);
// ошибка «нет такой модели / нет доступа» — пробуем следующую; остальные ошибки (ключ, баланс) — сразу наверх
const modelProblem = (status, msg) => status === 404 || (status === 400 || status === 403) && /model|does not exist|not found|deprecat|unsupported|access/i.test(msg || '');

async function transcribe(buf, hint = '') {
  let last;
  for (let i = sttIdx; i < STT_MODELS.length; i++) {
    const fd = new FormData();
    fd.append('file', new Blob([buf], { type: 'audio/ogg' }), 'voice.ogg');
    fd.append('model', STT_MODELS[i]);
    if (hint) fd.append('prompt', hint.slice(0, 800));
    const r = await fetch(`${BASE}/audio/transcriptions`, { method: 'POST', headers: { authorization: `Bearer ${KEY}` }, body: fd });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { if (sttIdx !== i) console.log('[ai] голос: переключился на', STT_MODELS[i]); sttIdx = i; return String(j.text || '').trim(); }
    last = (j.error && j.error.message) || `Ошибка распознавания (${r.status})`;
    console.warn('[ai] stt', STT_MODELS[i], r.status, last);
    if (!modelProblem(r.status, last)) break;
  }
  throw new Error(last);
}

async function json(system, user) {
  let last;
  for (let i = chatIdx; i < CHAT_MODELS.length; i++) {
    const r = await fetch(`${BASE}/chat/completions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: CHAT_MODELS[i], response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      if (chatIdx !== i) console.log('[ai] текст: переключился на', CHAT_MODELS[i]);
      chatIdx = i;
      const text = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
      try { return JSON.parse(text || '{}'); } catch { return {}; }
    }
    last = (j.error && j.error.message) || `Ошибка ИИ (${r.status})`;
    console.warn('[ai] chat', CHAT_MODELS[i], r.status, last);
    if (!modelProblem(r.status, last)) break;
  }
  throw new Error(last);
}

module.exports = { enabled, transcribe, json, get MODEL() { return CHAT_MODELS[chatIdx]; }, get STT_MODEL() { return STT_MODELS[sttIdx]; } };
