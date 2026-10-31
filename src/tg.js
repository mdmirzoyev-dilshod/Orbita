// Telegram-бот: отправка сообщений, приём команд (long polling), вход на сайт через бота
const db = require('./db');
const { today, fmtDue } = require('./time');

const TOKEN = process.env.BOT_TOKEN || '';
const API = `https://api.telegram.org/bot${TOKEN}`;
let BOT_USERNAME = process.env.BOT_USERNAME || '';
const handlers = { done: null };   // заполняется сервером (смена статуса с уведомлениями)

const appUrl = () => process.env.APP_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : '');
const enabled = () => Boolean(TOKEN);
const botUsername = () => BOT_USERNAME;

async function call(method, body) {
  if (!TOKEN) return null;
  try {
    const r = await fetch(`${API}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) });
    const j = await r.json();
    if (!j.ok) console.warn('[tg]', method, j.description);
    return j;
  } catch (e) {
    console.warn('[tg]', method, e.message);
    return null;
  }
}

function openButton(path = '') {
  const u = appUrl();
  return u && u.startsWith('https://') ? [{ text: '🪐 Открыть Орбиту', url: u + path }] : null;
}

async function send(chatId, text, opts = {}) {
  if (!chatId || !TOKEN) return null;
  const rows = [];
  if (opts.doneTaskId) rows.push([{ text: '✅ Выполнено', callback_data: `done:${opts.doneTaskId}` }]);
  const ob = openButton(opts.path);
  if (ob && opts.open !== false) rows.push(ob);
  return call('sendMessage', { chat_id: chatId, text, disable_web_page_preview: true, reply_markup: rows.length ? { inline_keyboard: rows } : undefined });
}

async function upsertUser(from) {
  const name = [from.first_name, from.last_name].filter(Boolean).join(' ') || from.username || 'Пользователь';
  return db.one(
    `INSERT INTO users (tg_id, name, username) VALUES ($1,$2,$3)
     ON CONFLICT (tg_id) DO UPDATE SET username = EXCLUDED.username
     RETURNING *`, [from.id, name, from.username || null]);
}

async function onMessage(m) {
  const text = (m.text || '').trim();
  const chat = m.chat.id;
  if (m.chat.type !== 'private') return;
  const user = await upsertUser(m.from);

  if (text.startsWith('/start')) {
    const arg = text.split(' ')[1] || '';
    if (arg.startsWith('login_')) {
      const nonce = arg.slice(6);
      const r = await db.q(`UPDATE login_nonces SET user_id=$1 WHERE nonce=$2 AND user_id IS NULL AND created_at > now() - interval '15 minutes'`, [user.id, nonce]);
      if (r.rowCount) return send(chat, `✅ Вход подтверждён, ${user.name}!\n\nВернитесь в браузер — страница откроется сама.\n\nСюда будут приходить ваши задачи, напоминания и итоги дня.`, { open: false });
      return send(chat, 'Ссылка для входа устарела. Нажмите «Войти через Telegram» на сайте ещё раз.', { open: false });
    }
    return send(chat, `Здравствуйте, ${user.name}! Это бот «Орбиты» — задачи и личные планы команды.\n\nЧтобы начать, откройте сайт и нажмите «Войти через Telegram».\n\nКоманды:\n/tasks — мои задачи\n/plan — мой план на сегодня`);
  }

  const members = await db.all(`SELECT m.*, c.name AS company FROM members m JOIN companies c ON c.id=m.company_id WHERE m.user_id=$1 AND m.active`, [user.id]);
  if (!members.length) return send(chat, 'Вы пока не состоите ни в одной компании. Откройте сайт «Орбиты», войдите и создайте компанию или примите приглашение.');

  if (text.startsWith('/tasks')) {
    const ids = members.map(x => x.id);
    const tasks = await db.all(`SELECT * FROM tasks WHERE assignee_id = ANY($1) AND status <> 'done' ORDER BY due LIMIT 30`, [ids]);
    if (!tasks.length) return send(chat, '🎉 Открытых задач нет.');
    const t0 = today();
    const lines = tasks.map(t => `${t.due < t0 ? '🔴' : t.due === t0 ? '🟠' : '▫️'} ${t.title} — ${t.due < t0 ? 'просрочено' : 'до ' + fmtDue(t.due)}`);
    return send(chat, `📋 Ваши задачи (${tasks.length})\n\n${lines.join('\n')}`, { path: '/#tasks' });
  }
  if (text.startsWith('/plan')) {
    const items = await db.all(`SELECT * FROM plan_items WHERE member_id = ANY($1) AND day=$2 ORDER BY id`, [members.map(x => x.id), today()]);
    if (!items.length) return send(chat, 'На сегодня план пуст. Добавьте пункты на сайте в разделе «Мои планы».', { path: '/#plans' });
    const done = items.filter(i => i.done).length;
    return send(chat, `🗓 План на сегодня: ${done} из ${items.length}\n\n${items.map(i => (i.done ? '✅ ' : '▫️ ') + i.text).join('\n')}`, { path: '/#plans' });
  }
  return send(chat, 'Команды:\n/tasks — мои задачи\n/plan — мой план на сегодня');
}

async function onCallback(cq) {
  const data = cq.data || '';
  if (data.startsWith('done:')) {
    const taskId = Number(data.slice(5));
    const user = await db.one(`SELECT * FROM users WHERE tg_id=$1`, [cq.from.id]);
    const t = user && await db.one(`SELECT t.* FROM tasks t JOIN members m ON m.id=t.assignee_id WHERE t.id=$1 AND m.user_id=$2`, [taskId, user.id]);
    if (!t) return call('answerCallbackQuery', { callback_query_id: cq.id, text: 'Задача не найдена или назначена не вам' });
    if (t.status !== 'done' && handlers.done) await handlers.done(t.id, t.assignee_id);
    await call('answerCallbackQuery', { callback_query_id: cq.id, text: 'Отмечено: выполнено ✅' });
    if (cq.message) await call('editMessageReplyMarkup', { chat_id: cq.message.chat.id, message_id: cq.message.message_id, reply_markup: { inline_keyboard: [[{ text: '✅ Выполнено', callback_data: 'noop' }]] } });
    return;
  }
  return call('answerCallbackQuery', { callback_query_id: cq.id });
}

let offset = 0, running = false;
async function poll() {
  if (!TOKEN || running) return;
  running = true;
  const me = await call('getMe');
  if (me && me.ok) BOT_USERNAME = me.result.username;
  await call('deleteWebhook', { drop_pending_updates: false });
  await call('setMyCommands', { commands: [{ command: 'tasks', description: 'Мои задачи' }, { command: 'plan', description: 'Мой план на сегодня' }] });
  console.log('[tg] бот запущен:', BOT_USERNAME ? '@' + BOT_USERNAME : '(нет имени)');
  while (running) {
    try {
      const r = await fetch(`${API}/getUpdates?timeout=50&offset=${offset}`);
      const j = await r.json();
      if (!j.ok) { await new Promise(s => setTimeout(s, 5000)); continue; }
      for (const u of j.result) {
        offset = u.update_id + 1;
        try {
          if (u.message) await onMessage(u.message);
          else if (u.callback_query) await onCallback(u.callback_query);
        } catch (e) { console.error('[tg] update', e); }
      }
    } catch (e) {
      console.warn('[tg] poll', e.message);
      await new Promise(s => setTimeout(s, 5000));
    }
  }
}
function stop() { running = false; }

module.exports = { send, poll, stop, enabled, botUsername, appUrl, handlers, upsertUser, onMessage, onCallback };
