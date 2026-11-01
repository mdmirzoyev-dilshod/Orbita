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
  await tg.send(m.tg_id, text, { doneTaskId: opts.doneTaskId, path: opts.path, buttons: opts.buttons });
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
      await notify(to, `🔴 Просрочена задача\nИсполнитель: ${who}\n«${t.title}»\nСрок был: ${was}\n\nДобавить время?`, { kind: 'overdue', path: '/#tasks', buttons: EXT_BUTTONS(t.id) });
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

module.exports = { EXT, extendTask, canExtend, ADMIN, isAdmin, STATUS, PRIO, companyMembers, scopeOf, notify, memberName, changeStatus, morningDigest, eveningDigest, tick };
