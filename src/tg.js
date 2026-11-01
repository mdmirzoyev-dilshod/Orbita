// Telegram-бот: отправка сообщений, приём команд (long polling), вход на сайт через бота
const db = require('./db');
const { today, fmtDue } = require('./time');

const TOKEN = process.env.BOT_TOKEN || '';
const API = `https://api.telegram.org/bot${TOKEN}`;
let BOT_USERNAME = process.env.BOT_USERNAME || '';
const handlers = { done: null, extend: null, transcribe: null, reply: null, assist: null, callback: null };   // заполняются logic.js и assistant.js

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
  if (opts.buttons) rows.push(...opts.buttons);
  const ob = openButton(opts.path);
  if (ob && opts.open !== false) rows.push(ob);
  const r = await call('sendMessage', { chat_id: chatId, text, disable_web_page_preview: true, reply_markup: rows.length ? { inline_keyboard: rows } : undefined });
  // запоминаем, к какой задаче относится сообщение — чтобы ответ на него стал комментарием
  const taskId = opts.taskId || opts.doneTaskId;
  if (taskId && r && r.ok) await db.q(`INSERT INTO tg_msgs (chat_id, message_id, task_id) VALUES ($1,$2,$3) ON CONFLICT (chat_id, message_id) DO UPDATE SET task_id=EXCLUDED.task_id`, [chatId, r.result.message_id, taskId]).catch(() => {});
  return r;
}

// скачать файл (голосовое) из Telegram
async function download(fileId) {
  const f = await call('getFile', { file_id: fileId });
  if (!f || !f.ok) throw new Error('не удалось получить файл');
  const r = await fetch(`https://api.telegram.org/file/bot${TOKEN}/${f.result.file_path}`);
  if (!r.ok) throw new Error('не удалось скачать файл');
  return Buffer.from(await r.arrayBuffer());
}

async function upsertUser(from) {
  const name = [from.first_name, from.last_name].filter(Boolean).join(' ') || from.username || 'Пользователь';
  return db.one(
    `INSERT INTO users (tg_id, name, username) VALUES ($1,$2,$3)
     ON CONFLICT (tg_id) DO UPDATE SET username = EXCLUDED.username
     RETURNING *`, [from.id, name, from.username || null]);
}

async function onMessage(m) {
  let text = (m.text || m.caption || '').trim();
  const chat = m.chat.id;
  if (m.chat.type !== 'private') return;
  const user = await upsertUser(m.from);

  // голосовое → текст (ИИ)
  let voice = false;
  const media = m.voice || m.audio || m.video_note;
  if (media) {
    if (!handlers.transcribe) return send(chat, '🎙 Голосовые пока не подключены: в настройках сервера нужно добавить ключ ИИ (OPENAI_API_KEY). Текстом всё работает.', { open: false });
    if ((media.duration || 0) > 300) return send(chat, '🎙 Голосовое длиннее 5 минут — разбейте, пожалуйста, на части.', { open: false });
    call('sendChatAction', { chat_id: chat, action: 'typing' });
    try { text = await handlers.transcribe(await download(media.file_id), user); }
    catch (e) { console.warn('[ai] stt', e.message); return send(chat, '😕 Не удалось распознать голосовое. Попробуйте ещё раз или напишите текстом.', { open: false }); }
    if (!text) return send(chat, '😕 Не расслышал. Попробуйте ещё раз или напишите текстом.', { open: false });
    voice = true;
  }

  // ответ на сообщение о задаче → комментарий к задаче
  if (m.reply_to_message && text && !text.startsWith('/') && handlers.reply) {
    const link = await db.one(`SELECT task_id FROM tg_msgs WHERE chat_id=$1 AND message_id=$2`, [chat, m.reply_to_message.message_id]);
    if (link && link.task_id) return handlers.reply({ chat, user, taskId: link.task_id, text, voice });
  }
  if (voice) text = text.replace(/^\//, '');

  if (text.startsWith('/start') || text.startsWith('/login')) {
    const arg = text.split(' ')[1] || '';
    let confirmed = false, joinCode = '';
    if (arg.startsWith('login_')) {
      const r = await db.one(`UPDATE login_nonces SET user_id=$1 WHERE nonce=$2 AND user_id IS NULL AND created_at > now() - interval '15 minutes' RETURNING join_code`, [user.id, arg.slice(6)]);
      confirmed = Boolean(r); joinCode = (r && r.join_code) || '';
    }
    // одноразовая кнопка входа — работает, даже если сайт не «увидел» подтверждение
    const token = require('crypto').randomBytes(18).toString('base64url');
    await db.q(`INSERT INTO login_tokens (token, user_id) VALUES ($1,$2)`, [token, user.id]);
    const u = appUrl();
    const rows = u ? [[{ text: '🔐 Войти в Орбиту', url: `${u}/auth/tg?t=${token}${joinCode ? '&join=' + encodeURIComponent(joinCode) : ''}` }]] : [];
    const head = confirmed
      ? `✅ Вход подтверждён, ${user.name}!\n\nВернитесь в браузер — страница откроется сама. Если не открылась, нажмите кнопку ниже.`
      : `Здравствуйте, ${user.name}! Это бот «Орбиты» — задачи и личные планы команды.\n\nНажмите кнопку ниже, чтобы войти на сайт (кнопка действует 15 минут).`;
    return call('sendMessage', { chat_id: chat, text: head + `\n\nСюда будут приходить задачи, напоминания и итоги дня.\nКоманды: /tasks — мои задачи, /plan — план на сегодня, /wallet — кошелёк, /login — войти на сайт\n\n👛 Расход: «45000 такси», доход: «+5 000 000 зарплата»\n🎙 Можно голосом: «Мадине до завтра 15:00 подготовить отчёт», «потратил 120 тысяч на продукты»\n↩️ Ответ на сообщение о задаче станет комментарием`, reply_markup: rows.length ? { inline_keyboard: rows } : undefined });
  }

  // Кошелёк: «45000 такси» — записать расход, «+5 000 000 зарплата» — доход
  const W = require('./wallet');
  if (text.startsWith('/wallet')) {
    const m = W.monthOf(today()), t = await W.totals(user.id, m);
    const top = await db.all(`SELECT category, sum(amount)::bigint AS s FROM wallet_tx WHERE user_id=$1 AND kind='expense' AND day >= $2 GROUP BY category ORDER BY 2 DESC LIMIT 5`, [user.id, W.monthStart(m)]);
    return send(chat, `👛 Кошелёк за ${W.monthName(m)}\n\nРасходы: ${W.fmtSum(t.expense)}\nДоходы: ${W.fmtSum(t.income)}\nОстаток: ${W.fmtSum(t.income - t.expense)}${top.length ? '\n\nБольше всего:\n' + top.map(x => '• ' + x.category + ' — ' + W.fmtSum(x.s)).join('\n') : ''}\n\nЧтобы записать расход, просто напишите сумму и на что: «45000 такси».`, { path: '/#wallet' });
  }
  const q = !text.startsWith('/') && W.parseQuick(text);
  if (q) {
    const r = await db.one(`INSERT INTO wallet_tx (user_id, kind, amount, category, note, day) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`, [user.id, q.kind, q.amount, q.category, q.note, today()]);
    const t = await W.totals(user.id, W.monthOf(today()));
    return call('sendMessage', { chat_id: chat,
      text: `${q.kind === 'income' ? '💰 Доход' : '✅ Расход'}: ${W.fmtSum(q.amount)} — ${q.category}${q.note ? ' (' + q.note + ')' : ''}\n\nЗа ${W.monthName(W.monthOf(today()))}: расходы ${W.fmtSum(t.expense)}, доходы ${W.fmtSum(t.income)}`,
      reply_markup: { inline_keyboard: [[{ text: '↩️ Отменить', callback_data: `wdel:${r.id}` }]] } });
  }

  const members = await db.all(`SELECT m.*, c.name AS company FROM members m JOIN companies c ON c.id=m.company_id WHERE m.user_id=$1 AND m.active`, [user.id]);
  if (!members.length && (text.startsWith('/') || !handlers.assist)) return send(chat, 'Вы пока не состоите ни в одной компании. Откройте сайт «Орбиты», войдите и создайте компанию или примите приглашение.');

  if (text.startsWith('/tasks')) {
    const ids = members.map(x => x.id);
    const tasks = await db.all(`SELECT * FROM tasks WHERE assignee_id = ANY($1) AND status <> 'done' ORDER BY due LIMIT 30`, [ids]);
    if (!tasks.length) return send(chat, '🎉 Открытых задач нет.');
    const t0 = today();
    const lines = tasks.map(t => `${t.due < t0 ? '🔴' : t.due === t0 ? '🟠' : '▫️'} ${t.title} — ${t.due < t0 ? 'просрочено' : 'до ' + fmtDue(t.due)}`);
    return send(chat, `📋 Ваши задачи (${tasks.length})\n\n${lines.join('\n')}`, { path: '/#tasks' });
  }
  if (text.startsWith('/plan')) {
    const items = await db.all(`SELECT * FROM plan_items WHERE user_id=$1 AND day=$2 ORDER BY time NULLS LAST, id`, [user.id, today()]);
    if (!items.length) return send(chat, 'На сегодня план пуст. Добавьте пункты на сайте в разделе «Мои планы».', { path: '/#plans' });
    const done = items.filter(i => i.done).length;
    return send(chat, `🗓 План на сегодня: ${done} из ${items.length}\n\n${items.map(i => (i.done ? '✅ ' : i.important ? '⭐ ' : '▫️ ') + (i.time ? i.time + ' ' : '') + i.text).join('\n')}`, { path: '/#plans' });
  }
  if (handlers.assist && text) return handlers.assist({ chat, user, text, voice, members });
  return send(chat, 'Команды:\n/tasks — мои задачи\n/plan — мой план на сегодня\n/wallet — кошелёк за месяц\n\n👛 Записать расход: «45000 такси», доход: «+5 000 000 зарплата»');
}

async function onCallback(cq) {
  const data = cq.data || '';
  if (handlers.callback && await handlers.callback(cq)) return;
  if (data.startsWith('wdel:')) {
    const user = await db.one(`SELECT * FROM users WHERE tg_id=$1`, [cq.from.id]);
    const r = user ? await db.q(`DELETE FROM wallet_tx WHERE id=$1 AND user_id=$2`, [Number(data.slice(5)), user.id]) : { rowCount: 0 };
    await call('answerCallbackQuery', { callback_query_id: cq.id, text: r.rowCount ? 'Запись удалена' : 'Запись уже удалена' });
    if (cq.message && r.rowCount) await call('editMessageText', { chat_id: cq.message.chat.id, message_id: cq.message.message_id, text: '↩️ Запись отменена' });
    return;
  }
  if (data.startsWith('ext:')) {
    const [, id, code] = data.split(':');
    const user = await db.one(`SELECT * FROM users WHERE tg_id=$1`, [cq.from.id]);
    const r = user && handlers.extend ? await handlers.extend(Number(id), user.id, code) : { error: 'Нет доступа' };
    await call('answerCallbackQuery', { callback_query_id: cq.id, text: r.error || `Срок продлён: ${r.label}`, show_alert: Boolean(r.error) });
    if (cq.message && !r.error) await call('editMessageReplyMarkup', { chat_id: cq.message.chat.id, message_id: cq.message.message_id, reply_markup: { inline_keyboard: [[{ text: `⏱ Продлено до ${r.label}`, callback_data: 'noop' }]] } });
    return;
  }
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
  await call('setMyCommands', { commands: [{ command: 'tasks', description: 'Мои задачи' }, { command: 'plan', description: 'Мой план на сегодня' }, { command: 'wallet', description: 'Кошелёк за месяц' }, { command: 'login', description: 'Войти на сайт' }] });
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

module.exports = { call, download, send, poll, stop, enabled, botUsername, appUrl, handlers, upsertUser, onMessage, onCallback };
