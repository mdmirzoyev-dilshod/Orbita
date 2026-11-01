// Общая логика: права, уведомления, смена статуса, сводки
const db = require('./db');
const tg = require('./tg');
const { today, nowLocal, addDays, fmtDue, parts } = require('./time');

const STATUS = { new: 'Новая', progress: 'В работе', review: 'На проверке', done: 'Выполнено' };
const ADMIN = ['owner', 'founder', 'director'];
const isAdmin = m => Boolean(m) && ADMIN.includes(m.role);
const PRIO = { high: 'высокий', medium: 'средний', low: 'низкий' };

async function companyMembers(companyId) {
  return db.all(`SELECT m.*, u.name, u.tg_id, u.username, u.demo, d.name AS dept, d.color AS dept_color
                 FROM members m JOIN users u ON u.id=m.user_id LEFT JOIN depts d ON d.id=m.dept_id
                 WHERE m.company_id=$1 AND m.active ORDER BY (m.role IN ('owner','founder')) DESC, (m.role='director') DESC, (m.role='manager') DESC, d.name NULLS LAST, u.name`, [companyId]);
}

// Кого видит участник: владелец — всех; руководитель — себя и всех, кто ниже по цепочке подчинения; сотрудник — себя
function scopeOf(member, members) {
  if (isAdmin(member)) return members.map(m => m.id);
  if (member.role === 'worker') return [member.id];
  const ids = new Set([member.id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const m of members) if (!ids.has(m.id) && m.boss_id && ids.has(m.boss_id)) { ids.add(m.id); grew = true; }
  }
  // сотрудники своего отдела без явного руководителя тоже видны руководителю отдела
  for (const m of members) if (m.role === 'worker' && m.dept_id && m.dept_id === member.dept_id && !m.boss_id) ids.add(m.id);
  return [...ids];
}

async function notify(memberId, text, opts = {}) {
  if (!memberId) return;
  await db.q(`INSERT INTO notifs (member_id, text, at) VALUES ($1,$2,$3)`, [memberId, text, nowLocal()]);
  const m = await db.one(`SELECT m.settings, u.tg_id FROM members m JOIN users u ON u.id=m.user_id WHERE m.id=$1`, [memberId]);
  if (!m || !m.tg_id) return;
  const s = m.settings || {};
  if (s.tg === false) return;
  if (opts.kind === 'assign' && s.onAssign === false) return;
  if (['done', 'status', 'comment', 'review'].includes(opts.kind) && s.onDone === false) return;
  await tg.send(m.tg_id, text, { doneTaskId: opts.doneTaskId, taskId: opts.taskId, path: opts.path, buttons: opts.buttons, photo: opts.photo, checklist: opts.checklist });
}

// Основное участие человека (самое раннее активное) — туда идут личные напоминания и итоги дня
async function primaryMemberId(userId) {
  const r = await db.one(`SELECT id FROM members WHERE user_id=$1 AND active ORDER BY created_at, id LIMIT 1`, [userId]);
  return r ? r.id : null;
}
async function isPrimary(member) { return (await primaryMemberId(member.user_id)) === member.id; }

async function memberName(id) {
  const r = await db.one(`SELECT u.name FROM members m JOIN users u ON u.id=m.user_id WHERE m.id=$1`, [id]);
  return r ? r.name : 'Сотрудник';
}

async function changeStatus(taskId, actorId, status) {
  const t = await db.one(`SELECT * FROM tasks WHERE id=$1`, [taskId]);
  if (!t || t.status === status) return t;
  const doneOn = status === 'done' ? today() : null;
  await db.q(`UPDATE tasks SET status=$1, done_on=$2 WHERE id=$3`, [status, doneOn, taskId]);
  const who = await memberName(actorId);
  if (t.author_id && t.author_id !== actorId) {
    const text = status === 'done' ? `✅ ${who} выполнил(а) задачу\n«${t.title}»`
      : status === 'review' ? `👀 ${who} отправил(а) на проверку\n«${t.title}»`
      : `🔄 ${who}: статус «${STATUS[status]}»\n«${t.title}»`;
    await notify(t.author_id, text, { kind: status === 'done' ? 'done' : 'status', path: '/#tasks' });
  }
  if (t.assignee_id !== actorId) {
    await notify(t.assignee_id, status === 'done' ? `✅ ${who} принял(а) задачу\n«${t.title}»` : `🔄 ${who} изменил(а) статус: «${STATUS[status]}»\n«${t.title}»`, { kind: 'status', path: '/#tasks' });
  }
  return db.one(`SELECT * FROM tasks WHERE id=$1`, [taskId]);
}
tg.handlers.done = (taskId, actorId) => changeStatus(taskId, actorId, 'done');

function taskLine(t, names) {
  return `• ${t.title} — ${names[t.assignee_id] || ''}`.replace(/ — $/, '');
}

async function morningDigest(member) {
  const members = await companyMembers(member.company_id);
  const names = Object.fromEntries(members.map(m => [m.id, m.name]));
  const scope = scopeOf(member, members);
  const t0 = today(), t1 = addDays(t0, 1);
  const tasks = await db.all(`SELECT * FROM tasks WHERE company_id=$1 AND assignee_id = ANY($2) AND status <> 'done' ORDER BY due`, [member.company_id, scope]);
  const over = tasks.filter(t => t.due < t0), tod = tasks.filter(t => t.due === t0), tom = tasks.filter(t => t.due === t1);
  const own = member.role === 'worker';
  const fmtList = arr => arr.slice(0, 10).map(t => own ? `• ${t.title}` : taskLine(t, names)).join('\n') + (arr.length > 10 ? `\n…и ещё ${arr.length - 10}` : '');
  let text = `☀️ Доброе утро, ${names[member.id].split(' ')[0]}! Задачи на ${fmtDue(t0) === 'сегодня' ? 'сегодня' : t0}`;
  if (over.length) text += `\n\n🔴 Просрочено (${over.length})\n${fmtList(over)}`;
  if (tod.length) text += `\n\n🟠 Срок сегодня (${tod.length})\n${fmtList(tod)}`;
  if (tom.length) text += `\n\n🟡 Срок завтра (${tom.length})\n${fmtList(tom)}`;
  if (!over.length && !tod.length && !tom.length) text += `\n\n✅ Срочных задач нет. Всего в работе: ${tasks.length}.`;
  else text += `\n\nВсего в работе: ${tasks.length}`;
  const primary = await isPrimary(member);
  const plan = primary ? await db.all(`SELECT * FROM plan_items WHERE user_id=$1 AND day=$2 ORDER BY time NULLS LAST, id`, [member.user_id, t0]) : [];
  if (!primary) { /* план показываем в одной компании, чтобы не дублировать */ }
  else if (!plan.length) text += `\n\n🗓 Запишите план на день в «Моих планах».`;
  else text += `\n\n🗓 Ваш план на сегодня (${plan.length}):\n${plan.slice(0, 12).map(p => (p.important ? '⭐ ' : '▫️ ') + (p.time ? p.time + ' ' : '') + p.text).join('\n')}`;
  await notify(member.id, text, { kind: 'digest', path: '/#tasks' });
}

async function eveningDigest(member) {
  const t0 = today();
  if (!(await isPrimary(member))) return;   // итоги дня — одни на человека, а не в каждой компании
  const plan = await db.all(`SELECT * FROM plan_items WHERE user_id=$1 AND day=$2 ORDER BY time NULLS LAST, id`, [member.user_id, t0]);
  const wd = String(new Date(t0 + 'T12:00:00Z').getUTCDay());
  const habits = (await db.all(`SELECT h.name, h.wdays, EXISTS(SELECT 1 FROM habit_marks hm WHERE hm.habit_id=h.id AND hm.day=$2) AS done FROM habits h
     WHERE h.user_id=$1 AND (h.start_on IS NULL OR h.start_on <= $2) AND (h.until IS NULL OR h.until >= $2)`, [member.user_id, t0])).filter(h => (h.wdays || '0123456').includes(wd));
  if (!plan.length && !habits.length) return;
  let text = '🌙 Итоги дня';
  if (plan.length) {
    const d = plan.filter(p => p.done).length, left = plan.filter(p => !p.done);
    text += `: план выполнен на ${Math.round(d / plan.length * 100)}% (${d} из ${plan.length})`;
    if (left.length) text += `\n\nОсталось:\n${left.map(p => '▫️ ' + (p.time ? p.time + ' ' : '') + p.text).join('\n')}`;
    else text += '\n\n🔥 Всё по плану выполнено!';
  }
  const hl = habits.filter(h => !h.done);
  if (habits.length) text += hl.length ? `\n\nПривычки не отмечены: ${hl.map(h => h.name).join(', ')}` : '\n\n✅ Все привычки отмечены';
  await notify(member.id, text, { kind: 'digest', path: '/#plans' });
}

// Раз в 30 секунд: сводки по времени, напоминания по задачам
async function tick() {
  const { date, time } = parts();
  const now = `${date}T${time}`;
  const members = await db.all(`SELECT m.* FROM members m JOIN users u ON u.id=m.user_id WHERE m.active AND u.tg_id IS NOT NULL`);
  for (const m of members) {
    const s = m.settings || {};
    if (s.tg === false) continue;
    for (const [kind, at, fn] of [['morning', s.morning || '08:00', morningDigest], ['evening', s.evening || '21:00', eveningDigest]]) {
      if (time >= at && time < addMinutes(at, 30)) {
        const r = await db.q(`INSERT INTO sent_digests (member_id, kind, day) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [m.id, kind, date]);
        if (r.rowCount) { try { await fn(m); } catch (e) { console.error('[digest]', e); } }
      }
    }
  }
  // напоминания по пунктам личного плана (время указано в пункте)
  const pl = await db.all(`SELECT * FROM plan_items WHERE day=$1 AND remind AND NOT reminded AND NOT done AND time IS NOT NULL AND time <= $2`, [date, time]);
  for (const p of pl) {
    await db.q(`UPDATE plan_items SET reminded=true WHERE id=$1`, [p.id]);
    const pm = await primaryMemberId(p.user_id); if (!pm) continue;
    await notify(pm, `🗓 ${p.time} — ${p.important ? '⭐ ' : ''}${p.text}${p.note ? '\n\n📝 ' + p.note : ''}`, { kind: 'remind', path: '/#plans' });
  }
  // напоминания по привычкам (в дни расписания, если ещё не отмечена)
  const wdNow = String(new Date(`${date}T12:00:00Z`).getUTCDay());
  const hs = await db.all(`SELECT h.* FROM habits h WHERE h.remind AND h.time IS NOT NULL AND h.time <= $2 AND (h.last_reminded IS NULL OR h.last_reminded < $1)
     AND (h.start_on IS NULL OR h.start_on <= $1) AND (h.until IS NULL OR h.until >= $1)
     AND NOT EXISTS (SELECT 1 FROM habit_marks hm WHERE hm.habit_id=h.id AND hm.day=$1)`, [date, time]);
  for (const h of hs) {
    if (!(h.wdays || '0123456').includes(wdNow)) continue;
    await db.q(`UPDATE habits SET last_reminded=$1 WHERE id=$2`, [date, h.id]);
    const hm = await primaryMemberId(h.user_id); if (!hm) continue;
    await notify(hm, `💪 Привычка: ${h.name}${h.note ? '\n🎯 ' + h.note : ''}\n\nНе забудьте отметить в «Моих планах».`, { kind: 'remind', path: '/#plans' });
  }
  await require('./billing').trialReminders(tg).catch(e => console.warn('[billing]', e.message));
  await seriesTick(time);
  // напоминания, указанные в задаче
  const due = await db.all(`SELECT * FROM tasks WHERE remind_at IS NOT NULL AND NOT remind_sent AND status <> 'done' AND remind_at <= $1`, [now]);
  for (const t of due) {
    await db.q(`UPDATE tasks SET remind_sent=true WHERE id=$1`, [t.id]);
    await notify(t.assignee_id, `⏰ Напоминание\n«${t.title}»\nСрок: ${fmtDue(t.due)} · Приоритет: ${PRIO[t.priority]}`, { kind: 'remind', doneTaskId: t.id, path: '/#tasks' });
  }
  // срок истёк: исполнителю — напоминание, поставившему задачу — кнопки «продлить»
  const late = await db.all(`SELECT * FROM tasks WHERE status <> 'done' AND NOT overdue_sent AND due <= $1`, [date]);
  for (const t of late) {
    const passed = t.due_time ? now >= `${t.due}T${t.due_time}` : (t.due < date && time >= '09:00');
    if (!passed) continue;
    await db.q(`UPDATE tasks SET overdue_sent=true WHERE id=$1`, [t.id]);
    const was = dueLabel(t.due, t.due_time), who = await memberName(t.assignee_id);
    await notify(t.assignee_id, `🔴 Срок истёк\n«${t.title}»\nСрок был: ${was}\n\nЕсли нужно больше времени — напишите в комментарии к задаче.`, { kind: 'overdue', doneTaskId: t.id, path: '/#tasks' });
    for (const to of await extendersToNotify(t)) {
      await notify(to, `🔴 Просрочена задача\nИсполнитель: ${who}\n«${t.title}»\nСрок был: ${was}\n\nДобавить время?`, { kind: 'overdue', taskId: t.id, path: '/#tasks', buttons: EXT_BUTTONS(t.id) });
    }
  }
  // напоминание до срока (срок задачи — указанное время, по умолчанию 18:00)
  const open = await db.all(`SELECT t.*, m.settings FROM tasks t JOIN members m ON m.id=t.assignee_id WHERE t.status <> 'done' AND NOT t.before_sent AND t.due >= $1 AND t.due <= $2`, [addDays(date, -1), addDays(date, 2)]);
  for (const t of open) {
    const before = Number((t.settings || {}).before || 2);
    const dueAt = new Date(`${t.due}T${t.due_time || '18:00'}:00Z`).getTime() - before * 3600e3;
    const nowMs = new Date(`${now}:00Z`).getTime();
    if (nowMs >= dueAt) {
      await db.q(`UPDATE tasks SET before_sent=true WHERE id=$1`, [t.id]);
      await notify(t.assignee_id, `⏳ Скоро срок: ${fmtDue(t.due)}\n«${t.title}»`, { kind: 'remind', doneTaskId: t.id, path: '/#tasks' });
    }
  }
}
/* ---------- задачи и комментарии (общие для сайта и бота) ---------- */
async function canSeeTask(me, t) {
  if (!me || !t || t.company_id !== me.company_id) return false;
  if (t.assignee_id === me.id || t.author_id === me.id || isAdmin(me)) return true;
  if (me.role === 'manager') return scopeOf(me, await companyMembers(me.company_id)).includes(t.assignee_id);
  return false;
}
const REPLY_HINT = '\n\n↩️ Ответьте на это сообщение (текстом или голосом) — ответ добавится в комментарии к задаче.';
async function createTask(me, b) {
  const title = String(b.title || '').trim().slice(0, 200);
  if (!title) return { error: 'Напишите, что нужно сделать' };
  const assignee = Number(b.assignee) || me.id;
  if (!scopeOf(me, await companyMembers(me.company_id)).includes(assignee)) return { error: 'Этому сотруднику вы не можете ставить задачи' };
  const isD = s => /^\d{4}-\d{2}-\d{2}$/.test(s || ''), isT = s => /^\d{2}:\d{2}$/.test(s || '');
  const due = isD(b.due) ? b.due : addDays(today(), 1);
  const dueTime = isT(b.dueTime) ? b.dueTime : null;
  const remind = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(b.remind || '') ? b.remind : null;
  const priority = ['high', 'medium', 'low'].includes(b.priority) ? b.priority : 'medium';
  const descr = String(b.desc || '').trim().slice(0, 2000);
  const checklist = parseChecklist(b.checklist);
  const requiresPhoto = Boolean(b.requiresPhoto);
  // повторяющаяся задача: создаём серию, задачи появляются сами в нужные дни
  const repeat = ['daily', 'weekdays', 'days', 'monthly'].includes(b.repeat) ? b.repeat : null;
  if (repeat && !b.seriesId) {
    const wdays = Array.isArray(b.wdays) ? [...new Set(b.wdays.map(Number).filter(n => n >= 0 && n <= 6))].sort().join('') : (repeat === 'weekdays' ? '12345' : '0123456');
    const ser = await db.one(`INSERT INTO task_series (company_id, author_id, assignee_id, title, descr, priority, due_time, requires_photo, checklist, repeat, wdays, mday, start_on) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [me.company_id, me.id, assignee, title, descr, priority, dueTime, requiresPhoto, JSON.stringify(checklist.map(c => c.t)), repeat, repeat === 'days' ? (wdays || '12345') : repeat === 'weekdays' ? '12345' : '0123456', repeat === 'monthly' ? Number(due.slice(8, 10)) : null, due]);
    const first = await runSeries(ser, true);
    return { task: first, series: ser };
  }
  const t = await db.one(`INSERT INTO tasks (company_id, title, descr, assignee_id, author_id, priority, created_on, due, due_time, remind_at, requires_photo, checklist, series_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [me.company_id, title, descr, assignee, me.id, priority, today(), due, dueTime, remind, requiresPhoto, JSON.stringify(checklist), b.seriesId || null]);
  if (assignee !== me.id) {
    const who = await memberName(me.id);
    await notify(assignee, `${b.seriesId ? '🔁 Задача на сегодня' : '📌 Новая задача'}\nот: ${who}\n\n«${title}»\nСрок: ${fmtDue(due)}${dueTime ? ' до ' + dueTime : ''} · Приоритет: ${PRIO[priority]}${descr ? '\n\n' + descr : ''}${checklist.length ? '\n\n📋 Чек-лист — отмечайте кнопками ниже' : ''}${requiresPhoto ? '\n📸 Нужен фото-отчёт: после выполнения ответьте на это сообщение фотографией' : ''}${remind ? '\n⏰ Напомню ' + remind.replace('T', ' в ') : ''}${REPLY_HINT}`, { kind: 'assign', doneTaskId: t.id, path: '/#tasks', checklist });
  }
  return { task: t };
}
async function addComment(t, me, text, { fileId = null, silent = false } = {}) {
  text = String(text || '').trim().slice(0, 2000);
  if (!text && !fileId) return { error: 'Пустой комментарий' };
  if (!text) text = '📷 Фото-отчёт';
  await db.q(`INSERT INTO comments (task_id, member_id, text, at, file_id) VALUES ($1,$2,$3,$4,$5)`, [t.id, me.id, text, nowLocal(), fileId]);
  if (silent) return { ok: true };
  const who = await memberName(me.id);
  for (const to of new Set([t.assignee_id, t.author_id])) if (to && to !== me.id) await notify(to, `${fileId ? '📷' : '💬'} ${who} к задаче «${t.title}»:\n${text}${REPLY_HINT}`, { kind: 'comment', taskId: t.id, path: '/#tasks', photo: fileId });
  return { ok: true };
}
function parseChecklist(v) {
  const arr = Array.isArray(v) ? v : String(v || '').split('\n');
  return arr.map(x => (typeof x === 'object' && x ? { t: String(x.t || '').trim().slice(0, 120), d: Boolean(x.d) } : { t: String(x).replace(/^[-•*\s]+/, '').trim().slice(0, 120), d: false })).filter(x => x.t).slice(0, 20);
}
// отметить пункт чек-листа
async function toggleCheck(taskId, member, idx) {
  const t = await db.one(`SELECT * FROM tasks WHERE id=$1`, [taskId]);
  if (!t || !(await canSeeTask(member, t))) return { error: 'Задача недоступна' };
  const list = Array.isArray(t.checklist) ? t.checklist : [];
  if (!list[idx]) return { error: 'Пункт не найден' };
  list[idx].d = !list[idx].d;
  await db.q(`UPDATE tasks SET checklist=$1 WHERE id=$2`, [JSON.stringify(list), t.id]);
  if (list.every(c => c.d) && t.author_id && t.author_id !== member.id) await notify(t.author_id, `📋 ${await memberName(member.id)} отметил(а) все пункты чек-листа\n«${t.title}»`, { kind: 'status', taskId: t.id, path: '/#tasks' });
  return { ok: true, task: { ...t, checklist: list } };
}
// «Сделал» — с проверкой фото-отчёта
async function markDone(t, member) {
  if (t.status === 'done') return { ok: true, already: true };
  if (t.requires_photo) {
    const ph = await db.one(`SELECT 1 FROM comments WHERE task_id=$1 AND file_id IS NOT NULL`, [t.id]);
    if (!ph) return { needPhoto: true };
  }
  await changeStatus(t.id, member.id, 'done');
  return { ok: true };
}
// фото к задаче: комментарий; если нужен фото-отчёт — задача выполнена
async function photoReport(t, member, fileId, caption) {
  await addComment(t, member, caption || '📷 Фото-отчёт', { fileId, silent: true });
  const who = await memberName(member.id);
  const closes = t.requires_photo && t.status !== 'done' && t.assignee_id === member.id;
  if (closes) await db.q(`UPDATE tasks SET status='done', done_on=$1 WHERE id=$2`, [today(), t.id]);
  for (const to of new Set([t.assignee_id, t.author_id])) if (to && to !== member.id)
    await notify(to, `${closes ? '✅' : '📷'} ${who} ${closes ? 'выполнил(а) задачу с фото-отчётом' : 'прислал(а) фото к задаче'}\n«${t.title}»${caption ? '\n' + caption : ''}`, { kind: closes ? 'done' : 'comment', taskId: t.id, path: '/#tasks', photo: fileId });
  return { closed: closes };
}
// «Нужно больше времени» — запрос тому, кто может продлить
async function askMore(t, member) {
  if (t.status === 'done') return { error: 'Задача уже выполнена' };
  const who = await memberName(member.id);
  const to = (await extendersToNotify(t)).filter(x => x !== member.id);
  if (!to.length) return { error: 'Некому продлить срок — обратитесь к руководителю' };
  for (const id of to) await notify(id, `⏳ ${who} просит больше времени\n«${t.title}»\nСрок сейчас: ${dueLabel(t.due, t.due_time)}\n\nСколько добавить?`, { kind: 'overdue', taskId: t.id, path: '/#tasks', buttons: EXT_BUTTONS(t.id) });
  await db.q(`INSERT INTO comments (task_id, member_id, text, at) VALUES ($1,$2,$3,$4)`, [t.id, member.id, '⏳ Попросил(а) больше времени', nowLocal()]);
  return { ok: true };
}

/* ---------- повторяющиеся задачи ---------- */
const seriesMatches = (s, day) => {
  const wd = new Date(day + 'T12:00:00Z').getUTCDay(), dom = Number(day.slice(8, 10));
  if (s.repeat === 'daily') return true;
  if (s.repeat === 'weekdays') return wd >= 1 && wd <= 5;
  if (s.repeat === 'days') return String(s.wdays || '').includes(String(wd));
  if (s.repeat === 'monthly') { const last = new Date(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)), 0)).getUTCDate(); return dom === Math.min(s.mday || 1, last); }
  return false;
};
const REPEAT_RU = { daily: 'каждый день', weekdays: 'по будням', days: 'по дням недели', monthly: 'каждый месяц' };
// создать задачу серии на сегодня (если сегодня подходит и ещё не создана)
async function runSeries(ser, force = false) {
  const d = today();
  if (!ser.active || ser.start_on > d || (ser.last_on && ser.last_on >= d) || !seriesMatches(ser, d)) return null;
  const author = ser.author_id && await db.one(`SELECT * FROM members WHERE id=$1 AND active`, [ser.author_id]);
  if (!author) return null;
  const upd = await db.one(`UPDATE task_series SET last_on=$1 WHERE id=$2 AND (last_on IS NULL OR last_on < $1) RETURNING id`, [d, ser.id]);
  if (!upd) return null;   // уже создана параллельно
  const r = await createTask(author, { title: ser.title, desc: ser.descr, assignee: ser.assignee_id, priority: ser.priority, due: d, dueTime: ser.due_time, requiresPhoto: ser.requires_photo, checklist: ser.checklist, seriesId: ser.id });
  return r.task || null;
}
async function seriesTick(time) {
  if (time < '06:00') return;
  const list = await db.all(`SELECT * FROM task_series WHERE active AND start_on <= $1 AND (last_on IS NULL OR last_on < $1)`, [today()]);
  for (const s of list) await runSeries(s).catch(e => console.warn('[series]', e.message));
}

tg.handlers.acc = async (taskId, userId) => {
  const t = await db.one(`SELECT t.*, m.id AS mid FROM tasks t JOIN members m ON m.id=t.assignee_id WHERE t.id=$1 AND m.user_id=$2`, [taskId, userId]);
  if (!t) return { error: 'Задача назначена не вам' };
  if (t.status === 'new') await changeStatus(t.id, t.mid, 'progress');
  return { ok: true };
};
tg.handlers.doneBtn = async (taskId, userId) => {
  const t = await db.one(`SELECT t.*, m.id AS mid FROM tasks t JOIN members m ON m.id=t.assignee_id WHERE t.id=$1 AND m.user_id=$2`, [taskId, userId]);
  if (!t) return { error: 'Задача не найдена или назначена не вам' };
  return markDone(t, { id: t.mid });
};
tg.handlers.more = async (taskId, userId) => {
  const t = await db.one(`SELECT t.*, m.id AS mid FROM tasks t JOIN members m ON m.id=t.assignee_id WHERE t.id=$1 AND m.user_id=$2`, [taskId, userId]);
  if (!t) return { error: 'Задача назначена не вам' };
  return askMore(t, { id: t.mid });
};
tg.handlers.check = async (taskId, userId, idx) => {
  const t = await db.one(`SELECT company_id FROM tasks WHERE id=$1`, [taskId]);
  const m = t && await db.one(`SELECT * FROM members WHERE company_id=$1 AND user_id=$2 AND active`, [t.company_id, userId]);
  if (!m) return { error: 'Задача недоступна' };
  return toggleCheck(taskId, m, idx);
};
tg.handlers.photo = async ({ chat, user, taskId, fileId, caption }) => {
  const t = await db.one(`SELECT * FROM tasks WHERE id=$1`, [taskId]);
  const m = t && await db.one(`SELECT * FROM members WHERE company_id=$1 AND user_id=$2 AND active`, [t.company_id, user.id]);
  if (!t || !m || !(await canSeeTask(m, t))) return tg.send(chat, 'Эта задача уже недоступна.', { open: false });
  const r = await photoReport(t, m, fileId, caption);
  return tg.send(chat, r.closed ? `✅ Фото-отчёт принят — задача «${t.title}» выполнена.` : `📷 Фото добавлено к задаче «${t.title}».`, { open: false, taskId: t.id });
};

/* ---------- продление срока ---------- */
const EXT = { '2h': { hours: 2, label: '+2 часа' }, '1d': { days: 1, label: '+1 день' }, '3d': { days: 3, label: '+3 дня' }, '7d': { days: 7, label: '+неделя' } };
const EXT_BUTTONS = id => [[{ text: '+2 часа', callback_data: `ext:${id}:2h` }, { text: '+1 день', callback_data: `ext:${id}:1d` }], [{ text: '+3 дня', callback_data: `ext:${id}:3d` }, { text: '+неделя', callback_data: `ext:${id}:7d` }]];
const dueLabel = (d, tm) => `${fmtDue(d)}${tm ? ' до ' + tm : ''}`;
// кто может продлить: автор, руководство компании или руководитель исполнителя (но не сам исполнитель, если он не автор)
async function canExtend(member, t) {
  if (!member || !member.active || member.company_id !== t.company_id) return false;
  if (member.id === t.author_id || isAdmin(member)) return true;
  if (member.id === t.assignee_id) return false;
  return scopeOf(member, await companyMembers(t.company_id)).includes(t.assignee_id);
}
// кому слать кнопки «продлить»: автору; если у автора нет Telegram или он сам исполнитель — его руководителю
async function extendersToNotify(t) {
  const out = new Set();
  const au = t.author_id && await db.one(`SELECT m.id, m.boss_id, u.tg_id FROM members m JOIN users u ON u.id=m.user_id WHERE m.id=$1 AND m.active`, [t.author_id]);
  if (au && au.id !== t.assignee_id) out.add(au.id);
  if (au && !au.tg_id && au.boss_id) out.add(au.boss_id);   // у автора нет Telegram — сообщаем его руководителю
  if (!au || au.id === t.assignee_id) {
    const as = await db.one(`SELECT boss_id FROM members WHERE id=$1`, [t.assignee_id]);
    if (as && as.boss_id) out.add(as.boss_id);
  }
  out.delete(t.assignee_id);
  return [...out];
}
async function extendTask(taskId, actor, opt) {
  const t = await db.one(`SELECT * FROM tasks WHERE id=$1`, [taskId]);
  if (!t) return { error: 'Задача не найдена' };
  if (t.status === 'done') return { error: 'Задача уже выполнена' };
  if (!(await canExtend(actor, t))) return { error: 'Продлить срок может тот, кто поставил задачу, или руководитель' };
  const now = nowLocal();
  let nd, nt;
  if (opt.due) { nd = opt.due; nt = opt.dueTime || null; }
  else if (opt.hours) {
    const dl = `${t.due}T${t.due_time || '18:00'}`;
    const base = dl > now ? dl : now;
    const x = new Date(base + ':00Z'); x.setUTCMinutes(x.getUTCMinutes() + opt.hours * 60);
    const iso = x.toISOString(); nd = iso.slice(0, 10); nt = iso.slice(11, 16);
  } else {
    const baseDay = t.due >= today() && !t.overdue_sent ? t.due : today();
    nd = addDays(baseDay, opt.days || 1); nt = t.due_time;
  }
  if (`${nd}T${nt || '23:59'}` <= now) return { error: 'Новый срок уже прошёл — выберите позже' };
  await db.q(`UPDATE tasks SET due=$1, due_time=$2, overdue_sent=false, before_sent=$3, extended=extended+1 WHERE id=$4`, [nd, nt, Boolean(opt.hours), t.id]);
  const label = dueLabel(nd, nt), was = dueLabel(t.due, t.due_time);
  await db.q(`INSERT INTO comments (task_id, member_id, text, at) VALUES ($1,$2,$3,$4)`, [t.id, actor.id, `⏱ Срок продлён до ${label} (был ${was})`, now]);
  if (t.assignee_id !== actor.id) {
    const who = await memberName(actor.id);
    await notify(t.assignee_id, `⏱ ${who} продлил срок\n«${t.title}»\nНовый срок: ${label}`, { kind: 'assign', doneTaskId: t.id, path: '/#tasks' });
  }
  return { ok: true, label, due: nd, dueTime: nt };
}
tg.handlers.extend = async (taskId, userId, code) => {
  const t = await db.one(`SELECT company_id FROM tasks WHERE id=$1`, [taskId]);
  if (!t || !EXT[code]) return { error: 'Задача не найдена' };
  const actor = await db.one(`SELECT * FROM members WHERE company_id=$1 AND user_id=$2 AND active`, [t.company_id, userId]);
  return extendTask(taskId, actor, EXT[code]);
};

function addMinutes(hhmm, n) { const [h, m] = hhmm.split(':').map(Number); const x = h * 60 + m + n; return `${String(Math.min(23, Math.floor(x / 60))).padStart(2, '0')}:${String(x >= 1440 ? 59 : x % 60).padStart(2, '0')}`; }

module.exports = { REPEAT_RU, seriesMatches, runSeries, seriesTick, toggleCheck, markDone, photoReport, askMore, parseChecklist, canSeeTask, createTask, addComment, primaryMemberId, EXT, extendTask, canExtend, ADMIN, isAdmin, STATUS, PRIO, companyMembers, scopeOf, notify, memberName, changeStatus, morningDigest, eveningDigest, tick };
