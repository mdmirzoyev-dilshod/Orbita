// API для Джарвиса — личного ИИ-помощника владельца.
// Защита: заголовок «Authorization: Bearer <JARVIS_API_KEY>» (переменная в Railway, не короче 24 символов).
// Джарвис действует от имени владельца: JARVIS_USER (Telegram id или @username),
// а если не задан — от имени администратора платформы (первого пользователя), как в billing.js.
const crypto = require('crypto');
const express = require('express');
const db = require('./db');
const L = require('./logic');
const { today, nowLocal, addDays, isoDate } = require('./time');

const router = express.Router();
const wrap = fn => (req, res) => fn(req, res).catch(e => { console.error('[jarvis]', e); res.status(500).json({ error: 'Ошибка сервера' }); });

function keyOk(req) {
  const key = String(process.env.JARVIS_API_KEY || '');
  if (key.length < 24) return false;
  const got = String(req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const a = Buffer.from(got), b = Buffer.from(key);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function actingMember() {
  const who = String(process.env.JARVIS_USER || '').trim().replace(/^@/, '').toLowerCase();
  const user = who
    ? await db.one(`SELECT id FROM users WHERE tg_id::text=$1 OR lower(username)=$1 LIMIT 1`, [who])
    : await db.one(`SELECT id FROM users WHERE tg_id > 0 AND NOT demo ORDER BY id LIMIT 1`);
  if (!user) return null;
  return db.one(`SELECT * FROM members WHERE user_id=$1 AND active ORDER BY (role IN ('owner','founder','director')) DESC, created_at LIMIT 1`, [user.id]);
}

router.use((req, res, next) => {
  if (!keyOk(req)) return res.status(401).json({ error: 'Неверный ключ Джарвиса' });
  actingMember().then(me => {
    if (!me) return res.status(409).json({ error: 'Не найден владелец для Джарвиса (JARVIS_USER)' });
    req.me = me;
    next();
  }).catch(e => { console.error('[jarvis]', e); res.status(500).json({ error: 'Ошибка сервера' }); });
});

const fullName = m => [m.last_name, m.first_name].filter(Boolean).join(' ') || m.name || 'Без имени';
const isOverdue = (t, d0, now) => t.status !== 'done' && Boolean(isoDate(t.due) < d0 || (isoDate(t.due) === d0 && t.due_time && t.due_time < now.slice(11, 16)));
function overdueHours(t, now) {
  const end = new Date(isoDate(t.due) + 'T' + (t.due_time || '23:59') + ':00Z');
  return Math.max(1, Math.round((new Date(now + ':00Z') - end) / 3600000));
}

async function context(me) {
  const members = await L.companyMembers(me.company_id);
  const scope = L.scopeOf(me, members);
  const names = new Map(members.map(m => [m.id, fullName(m)]));
  const tasks = await db.all(`SELECT * FROM tasks WHERE company_id=$1 AND (assignee_id = ANY($2) OR author_id=$3)`, [me.company_id, scope, me.id]);
  members.forEach(m => { m.me = m.id === me.id; });
  return { members: members.filter(m => scope.includes(m.id)), names, tasks };
}
const shapeTask = (t, names, d0, now) => ({
  id: t.id, title: t.title, desc: t.descr || '', assignee: names.get(t.assignee_id) || '—', assigneeId: t.assignee_id,
  author: names.get(t.author_id) || '—', status: L.STATUS[t.status], priority: L.PRIO[t.priority],
  due: isoDate(t.due), dueTime: t.due_time || null, overdue: isOverdue(t, d0, now), doneOn: isoDate(t.done_on),
});

// Сводка для экрана Джарвиса
router.get('/summary', wrap(async (req, res) => {
  const { names, tasks } = await context(req.me);
  const d0 = today(), now = nowLocal(), y = addDays(d0, -1), from = addDays(d0, -30);
  const open = tasks.filter(t => t.status !== 'done');
  const overdue = open.filter(t => isOverdue(t, d0, now));
  const done30 = tasks.filter(t => t.status === 'done' && isoDate(t.done_on) >= from);
  const onTime = done30.filter(t => isoDate(t.done_on) <= isoDate(t.due)).length;
  res.json({
    inWork: open.length,
    overdue: overdue.length,
    dueToday: open.filter(t => isoDate(t.due) === d0).length,
    doneYesterday: tasks.filter(t => t.status === 'done' && isoDate(t.done_on) === y).length,
    discipline: done30.length ? Math.round(onTime / done30.length * 100) : 100,
    needsDecision: overdue.sort((a, b) => overdueHours(b, now) - overdueHours(a, now)).slice(0, 10)
      .map(t => ({ id: t.id, title: t.title, assignee: names.get(t.assignee_id) || '—', overdueHours: overdueHours(t, now) })),
  });
}));

// Сотрудники, которым владелец может ставить задачи
router.get('/members', wrap(async (req, res) => {
  const { members } = await context(req.me);
  res.json(members.map(m => ({ id: m.id, name: fullName(m), title: m.title || '', dept: m.dept || '', role: m.role, me: m.id === req.me.id })));
}));

// Задачи: filter = open | overdue | today | done_today | all; assignee = id или часть имени
router.get('/tasks', wrap(async (req, res) => {
  const { members, names, tasks } = await context(req.me);
  const d0 = today(), now = nowLocal(), f = String(req.query.filter || 'open');
  let list = tasks;
  if (f === 'open') list = list.filter(t => t.status !== 'done');
  if (f === 'overdue') list = list.filter(t => isOverdue(t, d0, now));
  if (f === 'today') list = list.filter(t => t.status !== 'done' && isoDate(t.due) === d0);
  if (f === 'done_today') list = list.filter(t => t.status === 'done' && isoDate(t.done_on) === d0);
  if (req.query.assignee) {
    const m = findMember(members, req.query.assignee);
    if (!m.member) return res.status(404).json({ error: m.error });
    list = list.filter(t => t.assignee_id === m.member.id);
  }
  list.sort((a, b) => String(isoDate(a.due)).localeCompare(String(isoDate(b.due))) || a.id - b.id);
  res.json(list.slice(0, 100).map(t => shapeTask(t, names, d0, now)));
}));

// Найти сотрудника по id или имени (без учёта регистра, по части имени/фамилии)
function findMember(members, q) {
  if (/^\d+$/.test(String(q))) { const m = members.find(x => x.id === Number(q)); return m ? { member: m } : { error: 'Нет такого сотрудника' }; }
  const s = String(q).toLowerCase().replace(/ё/g, 'е').trim();
  if (/^(я|мне|себе|сам|me)$/.test(s)) return { member: members.find(m => m.me) || null };
  const norm = x => String(x || '').toLowerCase().replace(/ё/g, 'е');
  const hits = members.filter(m => [fullName(m), m.name, m.first_name, m.last_name, m.username].some(v => v && (norm(v) === s || norm(v).includes(s) || s.includes(norm(v).split(' ')[0] || '~'))));
  if (hits.length === 1) return { member: hits[0] };
  if (!hits.length) return { error: `Не нашёл сотрудника «${q}»` };
  return { error: `Подходит несколько: ${hits.map(fullName).join(', ')}. Уточни, кого именно.` };
}

// Поставить задачу
router.post('/tasks', wrap(async (req, res) => {
  const { members } = await context(req.me);
  const b = req.body || {};
  let assignee = req.me.id;
  if (b.assignee !== undefined && b.assignee !== null && b.assignee !== '') {
    const m = findMember(members, b.assignee);
    if (!m.member) return res.status(400).json({ error: m.error });
    assignee = m.member.id;
  }
  const r = await L.createTask(req.me, { title: b.title, desc: b.desc, assignee, due: b.due, dueTime: b.dueTime, priority: b.priority, checklist: b.checklist, requiresPhoto: b.requiresPhoto, remind: b.remind });
  if (r.error) return res.status(400).json({ error: r.error });
  res.json({ ok: true, id: r.task.id, assignee: fullName(members.find(m => m.id === assignee) || {}), due: isoDate(r.task.due), dueTime: r.task.due_time || null });
}));

// Изменить статус или добавить комментарий
router.post('/tasks/:id', wrap(async (req, res) => {
  const t = await db.one(`SELECT * FROM tasks WHERE id=$1 AND company_id=$2`, [Number(req.params.id), req.me.company_id]);
  if (!t || !(await L.canSeeTask(req.me, t))) return res.status(404).json({ error: 'Задача не найдена' });
  const b = req.body || {};
  if (b.status) {
    if (!L.STATUS[b.status]) return res.status(400).json({ error: 'Статус: new, progress, review или done' });
    await L.changeStatus(t.id, req.me.id, b.status);
  }
  if (b.comment) await L.addComment(t, req.me, b.comment);
  res.json({ ok: true });
}));

module.exports = router;
