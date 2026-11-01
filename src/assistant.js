// Помощник в Telegram: понимает свободный текст и голосовые — ставит задачи, пишет расходы/доходы,
// добавляет комментарии и пункты плана. Задачи сначала показываются черновиком с кнопкой «Поставить».
const db = require('./db');
const tg = require('./tg');
const ai = require('./ai');
const L = require('./logic');
const W = require('./wallet');
const { today, nowLocal, addDays, fmtDue, parts } = require('./time');

const WD = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const PRIO_RU = { high: 'высокий', medium: 'средний', low: 'низкий' };
const isD = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
const isT = s => /^\d{2}:\d{2}$/.test(s || '');
const plainName = n => String(n || '').replace(/^Демо:\s*/, '');

async function memberships(userId) {
  return db.all(`SELECT m.*, c.name AS company FROM members m JOIN companies c ON c.id=m.company_id WHERE m.user_id=$1 AND m.active ORDER BY m.created_at, m.id`, [userId]);
}
// кому человек может ставить задачи — по каждой его компании
async function teamOf(ms) {
  const out = [];
  for (const m of ms) {
    const all = await L.companyMembers(m.company_id), scope = new Set(L.scopeOf(m, all));
    for (const x of all) if (scope.has(x.id)) out.push({ id: x.id, name: x.name, title: x.title || '', company: m.company, me: x.id === m.id, via: m });
  }
  return out;
}

const SYSTEM = `Ты — помощник в системе управления задачами «Орбита» (Узбекистан). Пользователь пишет или говорит (текст может быть расшифровкой голосового, с ошибками распознавания) на русском или узбекском (латиница или кириллица), иногда вперемешку.
Разбери сообщение на действия и верни ТОЛЬКО JSON вида {"items":[...]}. Возможные элементы:
- {"type":"task","title":"кратко, в повелительной форме, на языке пользователя","description":"детали или пусто","assignee_id":число из списка команды или null,"assignee_name":"как назван исполнитель","due":"YYYY-MM-DD" или null,"due_time":"HH:MM" или null,"priority":"high|medium|low","remind_at":"YYYY-MM-DDTHH:MM" или null} — поручение кому-то (или себе, если явно «поставь мне задачу»). Слова «срочно», «важно», «tez», «shoshilinch» → high.
- {"type":"expense"|"income","amount":целое число в сумах,"category":"строго из списка категорий","note":"на что","day":"YYYY-MM-DD"} — потратил/купил/заплатил или получил деньги. «45 тысяч»/«45 ming»=45000, «1,5 миллиона»/«1,5 mln»=1500000.
- {"type":"plan","text":"","day":"YYYY-MM-DD","time":"HH:MM" или null} — личное дело или напоминание себе («мне надо», «напомни», «запланируй»).
- {"type":"comment","task_id":число из списка задач,"text":"текст комментария"} — когда пользователь сообщает что-то по существующей задаче (ход работы, вопрос, причина задержки).
- {"type":"done","task_id":число} — сообщает, что задача из списка выполнена.
- {"type":"my_tasks"} — спрашивает о своих задачах. {"type":"wallet_summary"} — спрашивает о расходах за месяц.
- {"type":"answer","text":"короткий ответ"} — если это вопрос или ничего из перечисленного не подходит.
Правила: исполнителя ищи по имени среди команды с учётом падежей и уменьшительных форм (Мадине → Мадина, Азизу → Азиз); если не нашёл — assignee_id null. Даты считай от «сегодня» по таблице ниже; если срок не назван — due null. Не выдумывай задачи, которых нет в сообщении. Исправляй очевидные ошибки распознавания в названиях.`;

async function understand(user, text, ms) {
  const team = await teamOf(ms);
  const ids = ms.map(m => m.id);
  const tasks = ids.length ? await db.all(`SELECT t.id, t.title, t.due, u.name AS who FROM tasks t JOIN members m ON m.id=t.assignee_id JOIN users u ON u.id=m.user_id
     WHERE t.status <> 'done' AND (t.assignee_id = ANY($1) OR t.author_id = ANY($1)) ORDER BY t.due LIMIT 40`, [ids]) : [];
  const t0 = today(), { time } = parts();
  const week = Array.from({ length: 8 }, (_, i) => { const d = addDays(t0, i); return `${d} — ${WD[new Date(d + 'T12:00:00Z').getUTCDay()]}${i === 0 ? ' (сегодня)' : i === 1 ? ' (завтра)' : ''}`; }).join('\n');
  const ctx = `Сейчас: ${t0} ${time} (Ташкент).\nДни:\n${week}\n\nПользователь: ${user.name}\nКоманда (кому можно ставить задачи):\n${team.map(x => `${x.id}: ${plainName(x.name)}${x.title ? ' — ' + x.title : ''}${x.me ? ' (это сам пользователь)' : ''}${ms.length > 1 ? ' [' + x.company + ']' : ''}`).join('\n') || 'нет'}\n\nОткрытые задачи:\n${tasks.map(t => `${t.id}: «${t.title}» — ${plainName(t.who)}, срок ${t.due}`).join('\n') || 'нет'}\n\nКатегории расходов: ${W.CATS.expense.join(', ')}\nКатегории доходов: ${W.CATS.income.join(', ')}\n\nСообщение:\n${text}`;
  const r = await ai.json(SYSTEM, ctx);
  return { items: Array.isArray(r.items) ? r.items.slice(0, 6) : [], team };
}

function draftText(d, team, many) {
  const a = team.find(x => x.id === d.assignee);
  return `📝 Новая задача — проверьте:\n\n«${d.title}»${d.desc ? '\n' + d.desc : ''}\n\n👤 Исполнитель: ${a ? plainName(a.name) + (a.me ? ' (вы)' : '') + (many ? ' · ' + a.company : '') : (d.assigneeName ? `не нашёл «${d.assigneeName}» — выберите ниже` : 'выберите ниже')}\n📅 Срок: ${fmtDue(d.due)}${d.dueTime ? ' до ' + d.dueTime : ''}\n⚡ Приоритет: ${PRIO_RU[d.priority]}${d.remind ? '\n⏰ Напомнить: ' + d.remind.replace('T', ' в ') : ''}`;
}
function draftButtons(id, d, team) {
  if (d.assignee) return [[{ text: '✅ Поставить задачу', callback_data: `ado:${id}` }, { text: '✖️ Отмена', callback_data: `adx:${id}` }], [{ text: '👤 Другой исполнитель', callback_data: `adp:${id}` }]];
  const rows = [], list = team.slice(0, 12);
  for (let i = 0; i < list.length; i += 2) rows.push(list.slice(i, i + 2).map(x => ({ text: (x.me ? '🙋 Себе' : '👤 ' + plainName(x.name)).slice(0, 30), callback_data: `adr:${id}:${x.id}` })));
  rows.push([{ text: '✖️ Отмена', callback_data: `adx:${id}` }]);
  return rows;
}

async function handle({ chat, user, text, voice }) {
  const ms = await memberships(user.id);
  if (voice) await tg.send(chat, `🎙 «${text}»`, { open: false });
  let res;
  try { res = await understand(user, text, ms); }
  catch (e) { console.warn('[ai]', e.message); return tg.send(chat, '😕 ИИ сейчас недоступен. Попробуйте позже или воспользуйтесь сайтом.', { open: false }); }
  const { items, team } = res;
  if (!items.length) return tg.send(chat, 'Не понял, что сделать 🤔\nПримеры: «Мадине до пятницы подготовить отчёт», «потратил 45 тысяч на такси», «напомни завтра в 9 позвонить в банк».', { open: false });
  const notes = [];
  for (const it of items) {
    try {
      if (it.type === 'task') {
        if (!ms.length) { notes.push('Чтобы ставить задачи, войдите на сайт и создайте компанию или примите приглашение.'); continue; }
        const a = team.find(x => x.id === Number(it.assignee_id));
        const d = { title: String(it.title || '').trim().slice(0, 200) || text.slice(0, 120), desc: String(it.description || '').trim().slice(0, 1000), assignee: a ? a.id : null, assigneeName: String(it.assignee_name || '').slice(0, 60),
          due: isD(it.due) && it.due >= today() ? it.due : addDays(today(), 1), dueTime: isT(it.due_time) ? it.due_time : null, priority: PRIO_RU[it.priority] ? it.priority : 'medium',
          remind: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(it.remind_at || '') && it.remind_at > nowLocal() ? it.remind_at : null, voice };
        const r = await db.one(`INSERT INTO ai_drafts (user_id, data) VALUES ($1,$2) RETURNING id`, [user.id, d]);
        await tg.send(chat, draftText(d, team, ms.length > 1), { open: false, buttons: draftButtons(r.id, d, team) });
      } else if (it.type === 'expense' || it.type === 'income') {
        const kind = it.type, amount = Math.round(Number(it.amount) || 0);
        if (!(amount > 0 && amount < 1e12)) { notes.push('Не понял сумму — напишите, например: «45000 такси».'); continue; }
        const note = String(it.note || '').trim().slice(0, 200);
        const category = W.CATS[kind].includes(it.category) ? it.category : W.guessCategory(note, kind);
        const day = isD(it.day) && it.day <= today() ? it.day : today();
        const r = await db.one(`INSERT INTO wallet_tx (user_id, kind, amount, category, note, day) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`, [user.id, kind, amount, category, note, day]);
        const t = await W.totals(user.id, W.monthOf(today()));
        await tg.call('sendMessage', { chat_id: chat, text: `${kind === 'income' ? '💰 Доход' : '✅ Расход'}: ${W.fmtSum(amount)} — ${category}${note ? ' (' + note + ')' : ''}${day !== today() ? ' · ' + fmtDue(day) : ''}\n\nЗа ${W.monthName(W.monthOf(today()))}: расходы ${W.fmtSum(t.expense)}, доходы ${W.fmtSum(t.income)}`,
          reply_markup: { inline_keyboard: [[{ text: '↩️ Отменить', callback_data: `wdel:${r.id}` }]] } });
      } else if (it.type === 'plan') {
        const ptext = String(it.text || '').trim().slice(0, 200); if (!ptext) continue;
        const day = isD(it.day) && it.day >= today() ? it.day : today(), time = isT(it.time) ? it.time : null;
        const r = await db.one(`INSERT INTO plan_items (user_id, day, text, time, remind) VALUES ($1,$2,$3,$4,$5) RETURNING id`, [user.id, day, ptext, time, Boolean(time)]);
        await tg.call('sendMessage', { chat_id: chat, text: `🗓 В план на ${fmtDue(day)}${time ? ' в ' + time : ''}: ${ptext}${time ? '\n🔔 Напомню в это время' : ''}`, reply_markup: { inline_keyboard: [[{ text: '↩️ Отменить', callback_data: `pdel:${r.id}` }]] } });
      } else if (it.type === 'comment' || it.type === 'done') {
        const t = await db.one(`SELECT * FROM tasks WHERE id=$1`, [Number(it.task_id)]);
        const me = t && ms.find(m => m.company_id === t.company_id);
        if (!t || !me || !(await L.canSeeTask(me, t))) { notes.push('Не нашёл такую задачу среди ваших.'); continue; }
        if (it.type === 'done') {
          if (t.status !== 'done') await L.changeStatus(t.id, me.id, 'done');
          notes.push(`✅ Задача «${t.title}» отмечена выполненной.`);
        } else {
          const r = await L.addComment(t, me, (voice ? '🎙 ' : '') + String(it.text || text));
          notes.push(r.error ? r.error : `💬 Комментарий добавлен к задаче «${t.title}».`);
        }
      } else if (it.type === 'my_tasks') {
        const tasks = ms.length ? await db.all(`SELECT * FROM tasks WHERE assignee_id = ANY($1) AND status <> 'done' ORDER BY due LIMIT 30`, [ms.map(m => m.id)]) : [];
        const t0 = today();
        notes.push(tasks.length ? `📋 Ваши задачи (${tasks.length})\n\n` + tasks.map(t => `${t.due < t0 ? '🔴' : t.due === t0 ? '🟠' : '▫️'} ${t.title} — ${t.due < t0 ? 'просрочено' : 'до ' + fmtDue(t.due)}`).join('\n') : '🎉 Открытых задач нет.');
      } else if (it.type === 'wallet_summary') {
        const m = W.monthOf(today()), t = await W.totals(user.id, m);
        notes.push(`👛 ${W.monthName(m)}: расходы ${W.fmtSum(t.expense)}, доходы ${W.fmtSum(t.income)}, остаток ${W.fmtSum(t.income - t.expense)}`);
      } else if (it.type === 'answer' && it.text) {
        notes.push(String(it.text).slice(0, 1500));
      }
    } catch (e) { console.error('[ai] item', e); notes.push('Не получилось выполнить одно из действий.'); }
  }
  if (notes.length) await tg.send(chat, notes.join('\n\n'), { open: false });
}

// ответ на сообщение о задаче → комментарий
async function reply({ chat, user, taskId, text, voice }) {
  const t = await db.one(`SELECT * FROM tasks WHERE id=$1`, [taskId]);
  const me = t && await db.one(`SELECT * FROM members WHERE company_id=$1 AND user_id=$2 AND active`, [t.company_id, user.id]);
  if (!t || !me || !(await L.canSeeTask(me, t))) return tg.send(chat, 'Эта задача уже недоступна.', { open: false });
  const r = await L.addComment(t, me, (voice ? '🎙 ' : '') + text);
  return tg.send(chat, r.error || `💬 Комментарий добавлен к задаче «${t.title}»${voice ? `:\n🎙 «${text}»` : ''}`, { open: false, taskId: t.id });
}

async function transcribe(buf, user) {
  const ms = await memberships(user.id);
  const names = [...new Set((await teamOf(ms)).map(x => plainName(x.name)))].slice(0, 40);
  return ai.transcribe(buf, `Орбита, задачи, сроки, расходы, сум. ${names.join(', ')}.`);
}

async function callback(cq) {
  const data = cq.data || '';
  const m = data.match(/^(ado|adx|adr|adp|pdel):(\d+)(?::(\d+))?$/);
  if (!m) return false;
  const [, act, idS, extra] = m, id = Number(idS);
  const answer = (text, alert) => tg.call('answerCallbackQuery', { callback_query_id: cq.id, text, show_alert: Boolean(alert) });
  const user = await db.one(`SELECT * FROM users WHERE tg_id=$1`, [cq.from.id]);
  if (!user) { await answer('Сначала нажмите /start'); return true; }
  const msg = cq.message, edit = (text, rows) => msg && tg.call('editMessageText', { chat_id: msg.chat.id, message_id: msg.message_id, text, reply_markup: rows ? { inline_keyboard: rows } : undefined });

  if (act === 'pdel') {
    const r = await db.q(`DELETE FROM plan_items WHERE id=$1 AND user_id=$2`, [id, user.id]);
    await answer(r.rowCount ? 'Удалено из плана' : 'Уже удалено');
    if (r.rowCount) await edit('↩️ Пункт плана отменён');
    return true;
  }
  const dr = await db.one(`SELECT * FROM ai_drafts WHERE id=$1 AND user_id=$2`, [id, user.id]);
  if (!dr || dr.used) { await answer('Этот черновик уже обработан'); return true; }
  const d = dr.data, ms = await memberships(user.id), team = await teamOf(ms);
  if (act === 'adx') {
    await db.q(`UPDATE ai_drafts SET used=true WHERE id=$1`, [id]);
    await answer('Отменено'); await edit(`✖️ Задача не поставлена\n«${d.title}»`);
    return true;
  }
  if (act === 'adp') { d.assignee = null; await answer('Выберите исполнителя'); await edit(draftText(d, team, ms.length > 1), draftButtons(id, d, team)); return true; }
  if (act === 'adr') {
    if (!team.some(x => x.id === Number(extra))) { await answer('Этому сотруднику нельзя поставить задачу', true); return true; }
    d.assignee = Number(extra);
    await db.q(`UPDATE ai_drafts SET data=$1 WHERE id=$2`, [d, id]);
    await answer('Исполнитель выбран'); await edit(draftText(d, team, ms.length > 1), draftButtons(id, d, team));
    return true;
  }
  // ado — поставить задачу
  const a = team.find(x => x.id === d.assignee);
  if (!a) { await answer('Выберите исполнителя', true); return true; }
  const r = await L.createTask(a.via, { title: d.title, desc: d.desc, assignee: a.id, due: d.due, dueTime: d.dueTime, priority: d.priority, remind: d.remind });
  if (r.error) { await answer(r.error, true); return true; }
  await db.q(`UPDATE ai_drafts SET used=true WHERE id=$1`, [id]);
  await answer('Задача поставлена ✅');
  await edit(`✅ Задача поставлена${a.me ? '' : ' — ' + plainName(a.name) + ' получил(а) уведомление'}\n\n«${d.title}»\n📅 Срок: ${fmtDue(d.due)}${d.dueTime ? ' до ' + d.dueTime : ''} · ${PRIO_RU[d.priority]}`);
  if (msg) await db.q(`INSERT INTO tg_msgs (chat_id, message_id, task_id) VALUES ($1,$2,$3) ON CONFLICT (chat_id, message_id) DO UPDATE SET task_id=EXCLUDED.task_id`, [msg.chat.id, msg.message_id, r.task.id]);
  return true;
}

tg.handlers.reply = reply;
tg.handlers.callback = callback;
if (ai.enabled()) {
  tg.handlers.assist = handle;
  tg.handlers.transcribe = transcribe;
  console.log(`[ai] подключён: ${ai.MODEL}, голос: ${ai.STT_MODEL}`);
} else console.log('[ai] OPENAI_API_KEY не задан — голосовые и свободный текст в боте выключены');

module.exports = { handle, reply, callback, understand };
