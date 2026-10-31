// Общая логика: права, уведомления, смена статуса, сводки
const db = require('./db');
const tg = require('./tg');
const { today, nowLocal, addDays, fmtDue, parts } = require('./time');

const STATUS = { new: 'Новая', progress: 'В работе', review: 'На проверке', done: 'Выполнено' };
const ADMIN = ['owner', 'founder', 'director'];
const isAdmin = m => Boolean(m) && ADMIN.includes(m.role);
const PRIO = { high: 'высокий', medium: 'средний', low: 'низкий' };

async function companyMembers(companyId) {
  return db.all(`SELECT m.*, u.name, u.tg_id, u.username, d.name AS dept, d.color AS dept_color
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
  await tg.send(m.tg_id, text, { doneTaskId: opts.doneTaskId, path: opts.path });
}

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
  const plan = await db.all(`SELECT * FROM plan_items WHERE member_id=$1 AND day=$2`, [member.id, t0]);
  if (!plan.length) text += `\n\n🗓 Запишите план на день в «Моих планах».`;
  await notify(member.id, text, { kind: 'digest', path: '/#tasks' });
}

async function eveningDigest(member) {
  const t0 = today();
  const plan = await db.all(`SELECT * FROM plan_items WHERE member_id=$1 AND day=$2 ORDER BY id`, [member.id, t0]);
  const habits = await db.all(`SELECT h.name, EXISTS(SELECT 1 FROM habit_marks hm WHERE hm.habit_id=h.id AND hm.day=$2) AS done FROM habits h WHERE h.member_id=$1`, [member.id, t0]);
  if (!plan.length && !habits.length) return;
  let text = '🌙 Итоги дня';
  if (plan.length) {
    const d = plan.filter(p => p.done).length, left = plan.filter(p => !p.done);
    text += `: план выполнен на ${Math.round(d / plan.length * 100)}% (${d} из ${plan.length})`;
    if (left.length) text += `\n\nОсталось:\n${left.map(p => '▫️ ' + p.text).join('\n')}`;
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
  // напоминания, указанные в задаче
  const due = await db.all(`SELECT * FROM tasks WHERE remind_at IS NOT NULL AND NOT remind_sent AND status <> 'done' AND remind_at <= $1`, [now]);
  for (const t of due) {
    await db.q(`UPDATE tasks SET remind_sent=true WHERE id=$1`, [t.id]);
    await notify(t.assignee_id, `⏰ Напоминание\n«${t.title}»\nСрок: ${fmtDue(t.due)} · Приоритет: ${PRIO[t.priority]}`, { kind: 'remind', doneTaskId: t.id, path: '/#tasks' });
  }
  // напоминание до срока (срок задачи — конец рабочего дня 18:00)
  const open = await db.all(`SELECT t.*, m.settings FROM tasks t JOIN members m ON m.id=t.assignee_id WHERE t.status <> 'done' AND NOT t.before_sent AND t.due >= $1 AND t.due <= $2`, [addDays(date, -1), addDays(date, 2)]);
  for (const t of open) {
    const before = Number((t.settings || {}).before || 2);
    const dueAt = new Date(`${t.due}T18:00:00Z`).getTime() - before * 3600e3;
    const nowMs = new Date(`${now}:00Z`).getTime();
    if (nowMs >= dueAt) {
      await db.q(`UPDATE tasks SET before_sent=true WHERE id=$1`, [t.id]);
      await notify(t.assignee_id, `⏳ Скоро срок: ${fmtDue(t.due)}\n«${t.title}»`, { kind: 'remind', doneTaskId: t.id, path: '/#tasks' });
    }
  }
}
function addMinutes(hhmm, n) { const [h, m] = hhmm.split(':').map(Number); const x = h * 60 + m + n; return `${String(Math.min(23, Math.floor(x / 60))).padStart(2, '0')}:${String(x >= 1440 ? 59 : x % 60).padStart(2, '0')}`; }

module.exports = { ADMIN, isAdmin, STATUS, PRIO, companyMembers, scopeOf, notify, memberName, changeStatus, morningDigest, eveningDigest, tick };
