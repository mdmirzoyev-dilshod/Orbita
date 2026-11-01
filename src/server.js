// Орбита — сервер: API, вход через Telegram, раздача интерфейса
process.env.TZ = process.env.TZ || 'UTC';
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const db = require('./db');
const tg = require('./tg');
const L = require('./logic');
const { today, nowLocal, addDays, fmtDue } = require('./time');

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '200kb' }));
app.use(cookieParser());

const COOKIE = 'orb_s';
const DEPT_COLORS = ['#FFD23F', '#6F8BFF', '#FF8A4C', '#3FD3A8', '#C77DFF', '#FF6B9A', '#52C7EA', '#B4E05A'];
const rid = (n = 24) => crypto.randomBytes(n).toString('base64url');
const clean = (s, max = 300) => String(s == null ? '' : s).trim().slice(0, max);
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const isDT = s => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(s || ''));
const wrap = fn => (req, res) => fn(req, res).catch(e => { console.error(e); res.status(500).json({ error: 'Ошибка сервера. Попробуйте ещё раз.' }); });

/* ---------- сессия ---------- */
async function loadSession(req) {
  const token = req.cookies[COOKIE];
  if (!token) return null;
  const s = await db.one(`SELECT s.*, u.name, u.tg_id, u.username, u.demo FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=$1`, [token]);
  if (!s) return null;
  let member = s.member_id ? await db.one(`SELECT * FROM members WHERE id=$1 AND user_id=$2 AND active`, [s.member_id, s.user_id]) : null;
  if (!member) {
    member = await db.one(`SELECT * FROM members WHERE user_id=$1 AND active ORDER BY created_at LIMIT 1`, [s.user_id]);
    if (member) await db.q(`UPDATE sessions SET member_id=$1 WHERE token=$2`, [member.id, token]);
  }
  return { token, back: s.back_token, user: { id: s.user_id, name: s.name, tg_id: s.tg_id, username: s.username, demo: s.demo }, member };
}
const auth = (needMember = true) => async (req, res, next) => {
  try {
    const s = await loadSession(req);
    if (!s) return res.status(401).json({ error: 'Нужно войти' });
    if (needMember && !s.member) return res.status(409).json({ error: 'Сначала создайте компанию или примите приглашение' });
    req.s = s; req.me = s.member;
    next();
  } catch (e) { next(e); }
};
async function startSession(res, userId, req) {
  const token = rid();
  await db.q(`INSERT INTO sessions (token, user_id) VALUES ($1,$2)`, [token, userId]);
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: Boolean(req && req.secure), maxAge: 1000 * 60 * 60 * 24 * 90 });
}

/* ---------- вход ---------- */
app.get('/api/me', wrap(async (req, res) => {
  const s = await loadSession(req);
  const base = { bot: tg.botUsername(), botReady: tg.enabled(), devLogin: process.env.DEV_LOGIN === '1' };
  if (!s) return res.json({ ...base, user: null });
  const companies = await db.all(`SELECT m.id AS member_id, m.role, c.id, c.name FROM members m JOIN companies c ON c.id=m.company_id WHERE m.user_id=$1 AND m.active ORDER BY m.created_at`, [s.user.id]);
  res.json({ ...base, user: s.user, member: s.member ? s.member.id : null, companies, viewingAs: Boolean(s.back) });
}));

app.post('/api/auth/start', wrap(async (req, res) => {
  if (!tg.enabled() || !tg.botUsername()) return res.status(503).json({ error: 'Telegram-бот ещё не подключён на сервере (нет BOT_TOKEN).' });
  const nonce = rid(12);
  await db.q(`INSERT INTO login_nonces (nonce, join_code) VALUES ($1,$2)`, [nonce, clean(req.body && req.body.join, 30) || null]);
  res.json({ nonce, link: `https://t.me/${tg.botUsername()}?start=login_${nonce}` });
}));
app.get('/api/auth/poll', wrap(async (req, res) => {
  const n = await db.one(`SELECT * FROM login_nonces WHERE nonce=$1 AND created_at > now() - interval '15 minutes'`, [clean(req.query.nonce, 40)]);
  if (!n) return res.status(404).json({ error: 'Ссылка устарела, начните вход заново' });
  if (!n.user_id) return res.json({ ok: false });
  await db.q(`DELETE FROM login_nonces WHERE nonce=$1`, [n.nonce]);
  await startSession(res, n.user_id, req);
  res.json({ ok: true });
}));
// Вход по одноразовой кнопке из бота
app.get('/auth/tg', wrap(async (req, res) => {
  const t = await db.one(`DELETE FROM login_tokens WHERE token=$1 AND created_at > now() - interval '15 minutes' RETURNING user_id`, [clean(req.query.t, 60)]);
  if (!t) return res.redirect('/?login=expired');
  await startSession(res, t.user_id, req);
  const join = clean(req.query.join, 30);
  res.redirect(join ? `/join/${encodeURIComponent(join)}` : '/');
}));
// Вход без Telegram — только для проверки (DEV_LOGIN=1)
app.post('/api/auth/dev', wrap(async (req, res) => {
  if (process.env.DEV_LOGIN !== '1') return res.status(404).end();
  const tgId = Number(req.body.tg_id) || Math.floor(Math.random() * 1e9);
  const u = await tg.upsertUser({ id: tgId, first_name: clean(req.body.name, 60) || 'Тест' });
  await startSession(res, u.id, req);
  res.json({ ok: true });
}));
app.post('/api/logout', wrap(async (req, res) => {
  if (req.cookies[COOKIE]) await db.q(`DELETE FROM sessions WHERE token=$1`, [req.cookies[COOKIE]]);
  res.clearCookie(COOKIE);
  res.json({ ok: true });
}));

/* ---------- компания и приглашения ---------- */
app.post('/api/company', auth(false), wrap(async (req, res) => {
  const name = clean(req.body.name, 80), title = clean(req.body.title, 60) || 'Директор';
  const myName = clean(req.body.myName, 60);
  if (!name) return res.status(400).json({ error: 'Введите название компании' });
  const m = await db.tx(async c => {
    const co = (await c.query(`INSERT INTO companies (name) VALUES ($1) RETURNING *`, [name])).rows[0];
    const d = (await c.query(`INSERT INTO depts (company_id, name, color) VALUES ($1,'Руководство',$2) RETURNING *`, [co.id, DEPT_COLORS[0]])).rows[0];
    if (myName) await c.query(`UPDATE users SET name=$1 WHERE id=$2`, [myName, req.s.user.id]);
    return (await c.query(`INSERT INTO members (company_id, user_id, role, dept_id, title) VALUES ($1,$2,'owner',$3,$4) RETURNING *`, [co.id, req.s.user.id, d.id, title])).rows[0];
  });
  await db.q(`UPDATE sessions SET member_id=$1 WHERE token=$2`, [m.id, req.s.token]);
  await L.notify(m.id, `🪐 Компания «${name}» создана!\n\nДальше: пригласите сотрудников в разделе «Команда» — им придёт ссылка для входа, а задачи и напоминания будут приходить сюда.`, { kind: 'info', path: '/#team' });
  res.json({ ok: true });
}));
app.post('/api/switch', auth(false), wrap(async (req, res) => {
  const m = await db.one(`SELECT * FROM members WHERE id=$1 AND user_id=$2 AND active`, [Number(req.body.memberId), req.s.user.id]);
  if (!m) return res.status(404).json({ error: 'Компания не найдена' });
  await db.q(`UPDATE sessions SET member_id=$1 WHERE token=$2`, [m.id, req.s.token]);
  res.json({ ok: true });
}));

app.post('/api/invites', auth(), wrap(async (req, res) => {
  if (req.me.role === 'worker') return res.status(403).json({ error: 'Приглашать могут только руководители' });
  let deptId = Number(req.body.deptId) || null;
  const newDept = clean(req.body.newDept, 40);
  if (newDept) {
    const cnt = await db.one(`SELECT count(*)::int AS n FROM depts WHERE company_id=$1`, [req.me.company_id]);
    const d = await db.one(`INSERT INTO depts (company_id, name, color) VALUES ($1,$2,$3) ON CONFLICT (company_id, name) DO UPDATE SET name=EXCLUDED.name RETURNING *`, [req.me.company_id, newDept, DEPT_COLORS[cnt.n % DEPT_COLORS.length]]);
    deptId = d.id;
  }
  if (deptId && !(await db.one(`SELECT 1 FROM depts WHERE id=$1 AND company_id=$2`, [deptId, req.me.company_id]))) return res.status(400).json({ error: 'Отдел не найден' });
  if (!deptId && req.me.role === 'manager') deptId = req.me.dept_id;
  let role = ['founder', 'director', 'manager', 'worker'].includes(req.body.role) ? req.body.role : 'worker';
  if (!L.isAdmin(req.me)) role = 'worker';
  let bossId = Number(req.body.bossId) || req.me.id;
  const members = await L.companyMembers(req.me.company_id);
  if (!members.some(m => m.id === bossId)) bossId = req.me.id;
  if (role === 'founder') bossId = null;   // учредитель никому не подчиняется
  const code = rid(9);
  await db.q(`INSERT INTO invites (code, company_id, role, dept_id, title, boss_id, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [code, req.me.company_id, role, deptId, clean(req.body.title, 60), bossId, req.me.id]);
  const base = tg.appUrl() || `${req.protocol}://${req.get('host')}`;
  res.json({ code, link: `${base}/join/${code}` });
}));
app.get('/api/invite/:code', wrap(async (req, res) => {
  const i = await db.one(`SELECT i.*, c.name AS company, d.name AS dept, u.name AS inviter FROM invites i JOIN companies c ON c.id=i.company_id
    LEFT JOIN depts d ON d.id=i.dept_id LEFT JOIN members m ON m.id=i.created_by LEFT JOIN users u ON u.id=m.user_id
    WHERE i.code=$1`, [clean(req.params.code, 30)]);
  if (!i || i.used_by || new Date(i.expires_at) < new Date()) return res.status(404).json({ error: 'Приглашение не найдено или уже использовано' });
  res.json({ company: i.company, dept: i.dept, title: i.title, inviter: i.inviter, role: i.role });
}));
app.post('/api/invite/:code/accept', auth(false), wrap(async (req, res) => {
  const code = clean(req.params.code, 30);
  const r = await db.tx(async c => {
    const i = (await c.query(`SELECT * FROM invites WHERE code=$1 FOR UPDATE`, [code])).rows[0];
    if (!i || i.used_by || new Date(i.expires_at) < new Date()) return { error: 'Приглашение не найдено или уже использовано' };
    const exist = (await c.query(`SELECT * FROM members WHERE company_id=$1 AND user_id=$2`, [i.company_id, req.s.user.id])).rows[0];
    let m;
    if (exist) m = (await c.query(`UPDATE members SET active=true, role=$2, dept_id=$3, title=$4, boss_id=$5 WHERE id=$1 RETURNING *`, [exist.id, i.role, i.dept_id, i.title, i.boss_id])).rows[0];
    else m = (await c.query(`INSERT INTO members (company_id, user_id, role, dept_id, title, boss_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`, [i.company_id, req.s.user.id, i.role, i.dept_id, i.title, i.boss_id])).rows[0];
    await c.query(`UPDATE invites SET used_by=$1 WHERE code=$2`, [m.id, code]);
    return { m, i };
  });
  if (r.error) return res.status(404).json(r);
  await db.q(`UPDATE sessions SET member_id=$1 WHERE token=$2`, [r.m.id, req.s.token]);
  if (r.i.created_by) await L.notify(r.i.created_by, `👋 ${req.s.user.name} принял(а) приглашение и теперь в команде${r.i.title ? ' (' + r.i.title + ')' : ''}.`, { kind: 'info', path: '/#team' });
  await L.notify(r.m.id, `👋 Добро пожаловать в «Орбиту»!\n\nСюда будут приходить новые задачи, напоминания о сроках, утренняя сводка и вечерние итоги. Настройки — в разделе «Уведомления».`, { kind: 'info' });
  res.json({ ok: true });
}));

/* ---------- состояние для интерфейса ---------- */
app.get('/api/state', auth(), wrap(async (req, res) => {
  const me = req.me;
  const co = await db.one(`SELECT * FROM companies WHERE id=$1`, [me.company_id]);
  const members = await L.companyMembers(me.company_id);
  const scope = L.scopeOf(me, members);
  const t0 = today();
  const tasks = await db.all(`SELECT * FROM tasks WHERE company_id=$1 AND (assignee_id = ANY($2) OR author_id=$3) ORDER BY due, id`, [me.company_id, scope, me.id]);
  const comments = tasks.length ? await db.all(`SELECT * FROM comments WHERE task_id = ANY($1) ORDER BY id`, [tasks.map(t => t.id)]) : [];
  const u2m = new Map(members.filter(m => scope.includes(m.id)).map(m => [m.user_id, m.id]));   // человек → его участие в этой компании
  const plans = await db.all(`SELECT * FROM plan_items WHERE user_id = ANY($1) AND day BETWEEN $2 AND $3 ORDER BY time NULLS LAST, id`, [[...u2m.keys()], addDays(t0, -21), addDays(t0, 60)]);
  const habits = await db.all(`SELECT * FROM habits WHERE user_id=$1 ORDER BY id`, [me.user_id]);
  const marks = habits.length ? await db.all(`SELECT * FROM habit_marks WHERE habit_id = ANY($1) AND day >= $2`, [habits.map(h => h.id), addDays(t0, -60)]) : [];
  const notifs = await db.all(`SELECT * FROM notifs WHERE member_id=$1 ORDER BY id DESC LIMIT 100`, [me.id]);
  const depts = await db.all(`SELECT * FROM depts WHERE company_id=$1 ORDER BY id`, [me.company_id]);

  const P = {};
  for (const p of plans) {
    const own = p.user_id === me.user_id;   // заметки и детали видит только сам человек
    const mid = u2m.get(p.user_id);
    ((P[mid] ||= {})[p.day] ||= []).push(own
      ? { id: p.id, text: p.text, done: p.done, time: p.time, note: p.note, series: p.series_id, repeat: p.repeat, remind: p.remind, important: p.important }
      : { id: p.id, text: p.text, done: p.done });
  }
  res.json({
    today: t0,
    company: { id: co.id, name: co.name },
    me: me.id,
    myRole: me.role,
    isAdmin: L.isAdmin(me),
    scope,
    depts: depts.map(d => ({ id: d.id, name: d.name, color: d.color })),
    users: members.map(m => ({ id: m.id, name: m.name, demo: Boolean(m.demo), role: m.role === 'worker' ? 'worker' : 'manager', level: m.role, owner: m.role === 'owner', admin: L.ADMIN.includes(m.role), dept: m.dept || 'Без отдела', deptId: m.dept_id, deptColor: m.dept_color || '#9AA3C7', title: m.title || '', boss: m.boss_id, tg: Boolean(m.tg_id) && (m.settings || {}).tg !== false, username: m.username })),
    tasks: tasks.map(t => ({ id: t.id, title: t.title, desc: t.descr, assignee: t.assignee_id, author: t.author_id, priority: t.priority, status: t.status, created: t.created_on, due: t.due, remind: t.remind_at, doneAt: t.done_on,
      comments: comments.filter(c => c.task_id === t.id).map(c => ({ u: c.member_id, t: c.text, at: c.at })) })),
    plans: P,
    habits: habits.map(h => ({ id: h.id, name: h.name, note: h.note, wdays: h.wdays, start: h.start_on, until: h.until, time: h.time, remind: h.remind, days: Object.fromEntries(marks.filter(m => m.habit_id === h.id).map(m => [m.day, true])) })),
    notifs: notifs.map(n => ({ id: n.id, to: me.id, text: n.text, at: n.at, read: n.read })),
    settings: { [me.id]: me.settings },
    bot: tg.botUsername(),
  });
}));

/* ---------- задачи ---------- */
async function visibleTask(me, id) {
  const t = await db.one(`SELECT * FROM tasks WHERE id=$1 AND company_id=$2`, [id, me.company_id]);
  if (!t) return null;
  if (t.assignee_id === me.id || t.author_id === me.id || L.isAdmin(me)) return t;
  if (me.role === 'manager') { const scope = L.scopeOf(me, await L.companyMembers(me.company_id)); if (scope.includes(t.assignee_id)) return t; }
  return null;
}
app.post('/api/tasks', auth(), wrap(async (req, res) => {
  const me = req.me, b = req.body;
  const title = clean(b.title, 200);
  if (!title) return res.status(400).json({ error: 'Напишите, что нужно сделать' });
  const assignee = Number(b.assignee) || me.id;
  const scope = L.scopeOf(me, await L.companyMembers(me.company_id));
  if (!scope.includes(assignee)) return res.status(403).json({ error: 'Этому сотруднику вы не можете ставить задачи' });
  const due = isDate(b.due) ? b.due : addDays(today(), 1);
  const remind = isDT(b.remind) ? b.remind : null;
  const priority = ['high', 'medium', 'low'].includes(b.priority) ? b.priority : 'medium';
  const t = await db.one(`INSERT INTO tasks (company_id, title, descr, assignee_id, author_id, priority, created_on, due, remind_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [me.company_id, title, clean(b.desc, 2000), assignee, me.id, priority, today(), due, remind]);
  if (assignee !== me.id) {
    const who = await L.memberName(me.id);
    await L.notify(assignee, `📌 Новая задача\nот: ${who}\n\n«${title}»\nСрок: ${fmtDue(due)} · Приоритет: ${L.PRIO[priority]}${t.descr ? '\n\n' + t.descr : ''}${remind ? '\n⏰ Напомню ' + remind.replace('T', ' в ') : ''}`, { kind: 'assign', doneTaskId: t.id, path: '/#tasks' });
  }
  res.json({ id: t.id });
}));
app.patch('/api/tasks/:id', auth(), wrap(async (req, res) => {
  const t = await visibleTask(req.me, Number(req.params.id));
  if (!t) return res.status(404).json({ error: 'Задача не найдена' });
  const b = req.body;
  if (b.status) {
    if (!L.STATUS[b.status]) return res.status(400).json({ error: 'Неизвестный статус' });
    await L.changeStatus(t.id, req.me.id, b.status);
  }
  if (t.author_id === req.me.id || L.isAdmin(req.me)) {
    const sets = [], vals = [];
    if (b.title !== undefined && clean(b.title, 200)) { vals.push(clean(b.title, 200)); sets.push(`title=$${vals.length}`); }
    if (b.desc !== undefined) { vals.push(clean(b.desc, 2000)); sets.push(`descr=$${vals.length}`); }
    if (isDate(b.due)) { vals.push(b.due); sets.push(`due=$${vals.length}, before_sent=false`); }
    if (b.priority && L.PRIO[b.priority]) { vals.push(b.priority); sets.push(`priority=$${vals.length}`); }
    if (b.remind !== undefined) { vals.push(isDT(b.remind) ? b.remind : null); sets.push(`remind_at=$${vals.length}, remind_sent=false`); }
    if (sets.length) { vals.push(t.id); await db.q(`UPDATE tasks SET ${sets.join(', ')} WHERE id=$${vals.length}`, vals); }
  }
  res.json({ ok: true });
}));
app.delete('/api/tasks/:id', auth(), wrap(async (req, res) => {
  const t = await visibleTask(req.me, Number(req.params.id));
  if (!t || !(t.author_id === req.me.id || L.isAdmin(req.me))) return res.status(403).json({ error: 'Удалить может только автор задачи' });
  await db.q(`DELETE FROM tasks WHERE id=$1`, [t.id]);
  res.json({ ok: true });
}));
app.post('/api/tasks/:id/comments', auth(), wrap(async (req, res) => {
  const t = await visibleTask(req.me, Number(req.params.id));
  const text = clean(req.body.text, 1000);
  if (!t) return res.status(404).json({ error: 'Задача не найдена' });
  if (!text) return res.status(400).json({ error: 'Пустой комментарий' });
  await db.q(`INSERT INTO comments (task_id, member_id, text, at) VALUES ($1,$2,$3,$4)`, [t.id, req.me.id, text, nowLocal()]);
  const who = await L.memberName(req.me.id);
  for (const to of new Set([t.assignee_id, t.author_id])) if (to && to !== req.me.id) await L.notify(to, `💬 ${who} к задаче «${t.title}»:\n${text}`, { kind: 'comment', path: '/#tasks' });
  res.json({ ok: true });
}));

/* ---------- планы и привычки ---------- */
// План: один пункт или серия (каждый день / по будням / раз в неделю / по выбранным дням) до указанной даты
const isTime = s => /^\d{2}:\d{2}$/.test(String(s || ''));
function planFields(b) {
  return { text: clean(b.text, 200), note: clean(b.note, 1000), time: isTime(b.time) ? b.time : null, important: Boolean(b.important), remind: Boolean(b.remind) && isTime(b.time) };
}
app.post('/api/plans', auth(), wrap(async (req, res) => {
  const b = req.body, f = planFields(b);
  if (!f.text || !isDate(b.day)) return res.status(400).json({ error: 'Напишите пункт плана и выберите дату' });
  const repeat = ['daily', 'weekdays', 'weekly', 'days'].includes(b.repeat) ? b.repeat : null;
  let days = [b.day];
  if (repeat) {
    const maxEnd = addDays(b.day, 365);
    let until = isDate(b.until) ? b.until : addDays(b.day, 89);
    if (until > maxEnd) until = maxEnd;
    if (until < b.day) return res.status(400).json({ error: 'Дата окончания раньше даты начала' });
    const wdStart = new Date(b.day + 'T12:00:00Z').getUTCDay();
    const pick = Array.isArray(b.days) ? b.days.map(Number).filter(n => n >= 0 && n <= 6) : [];
    if (repeat === 'days' && !pick.length) return res.status(400).json({ error: 'Выберите дни недели' });
    days = [];
    for (let d = b.day; d <= until; d = addDays(d, 1)) {
      const wd = new Date(d + 'T12:00:00Z').getUTCDay();
      if (repeat === 'daily' || (repeat === 'weekdays' && wd >= 1 && wd <= 5) || (repeat === 'weekly' && wd === wdStart) || (repeat === 'days' && pick.includes(wd))) days.push(d);
    }
    if (!days.length) return res.status(400).json({ error: 'В выбранном периоде нет подходящих дней' });
  }
  const series = repeat ? rid(8) : null;
  const vals = [], ph = [];
  days.forEach((d, i) => {
    const k = i * 9;
    ph.push(`($${k + 1},$${k + 2},$${k + 3},$${k + 4},$${k + 5},$${k + 6},$${k + 7},$${k + 8},$${k + 9})`);
    vals.push(req.me.user_id, d, f.text, f.note, f.time, series, repeat, f.remind, f.important);
  });
  await db.q(`INSERT INTO plan_items (user_id, day, text, note, time, series_id, repeat, remind, important) VALUES ${ph.join(',')}`, vals);
  res.json({ ok: true, count: days.length, from: days[0], to: days[days.length - 1] });
}));
app.patch('/api/plans/:id', auth(), wrap(async (req, res) => {
  const b = req.body, id = Number(req.params.id);
  const p = await db.one(`SELECT * FROM plan_items WHERE id=$1 AND user_id=$2`, [id, req.me.user_id]);
  if (!p) return res.status(404).json({ error: 'Пункт не найден' });
  if (typeof b.done === 'boolean' && Object.keys(b).length === 1) {
    await db.q(`UPDATE plan_items SET done=$1 WHERE id=$2`, [b.done, id]);
    return res.json({ ok: true });
  }
  const f = planFields({ ...p, ...b, time: b.time !== undefined ? b.time : p.time });
  if (!f.text) return res.status(400).json({ error: 'Пункт плана не может быть пустым' });
  const timeChanged = f.time !== p.time;
  if (b.scope === 'series' && p.series_id) {
    // изменить этот и все следующие дни серии (дату не трогаем)
    await db.q(`UPDATE plan_items SET text=$1, note=$2, time=$3, remind=$4, important=$5, reminded = CASE WHEN $6 THEN false ELSE reminded END
                WHERE series_id=$7 AND user_id=$8 AND day >= $9`, [f.text, f.note, f.time, f.remind, f.important, timeChanged, p.series_id, req.me.user_id, p.day]);
  } else {
    const day = isDate(b.day) ? b.day : p.day;
    await db.q(`UPDATE plan_items SET text=$1, note=$2, time=$3, remind=$4, important=$5, day=$6, reminded = CASE WHEN $7 OR $6 <> day THEN false ELSE reminded END WHERE id=$8`,
      [f.text, f.note, f.time, f.remind, f.important, day, timeChanged, id]);
  }
  res.json({ ok: true });
}));
app.delete('/api/plans/:id', auth(), wrap(async (req, res) => {
  const p = await db.one(`SELECT * FROM plan_items WHERE id=$1 AND user_id=$2`, [Number(req.params.id), req.me.user_id]);
  if (!p) return res.json({ ok: true });
  if (req.query.series === '1' && p.series_id) {
    const r = await db.q(`DELETE FROM plan_items WHERE series_id=$1 AND user_id=$2 AND day >= $3`, [p.series_id, req.me.user_id, p.day]);
    return res.json({ ok: true, count: r.rowCount });
  }
  await db.q(`DELETE FROM plan_items WHERE id=$1`, [p.id]);
  res.json({ ok: true, count: 1 });
}));
// Привычка: расписание по дням недели, период, время напоминания, цель/заметка
function habitFields(b, prev = {}) {
  const wd = Array.isArray(b.wdays) ? [...new Set(b.wdays.map(Number).filter(n => n >= 0 && n <= 6))].sort().join('') : (prev.wdays || '0123456');
  const f = {
    name: clean(b.name !== undefined ? b.name : prev.name, 60),
    note: clean(b.note !== undefined ? b.note : prev.note, 500),
    wdays: wd || '0123456',
    start: isDate(b.start) ? b.start : (prev.start_on || today()),
    until: b.until === null || b.until === '' ? null : (isDate(b.until) ? b.until : (prev.until || null)),
    time: b.time === null || b.time === '' ? null : (isTime(b.time) ? b.time : (prev.time || null)),
  };
  f.remind = Boolean(b.remind !== undefined ? b.remind : prev.remind) && Boolean(f.time);
  return f;
}
app.post('/api/habits', auth(), wrap(async (req, res) => {
  const f = habitFields(req.body);
  if (!f.name) return res.status(400).json({ error: 'Напишите название привычки' });
  if (f.until && f.until < f.start) return res.status(400).json({ error: 'Дата окончания раньше даты начала' });
  await db.q(`INSERT INTO habits (user_id, name, note, wdays, start_on, until, time, remind) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [req.me.user_id, f.name, f.note, f.wdays, f.start, f.until, f.time, f.remind]);
  res.json({ ok: true });
}));
app.patch('/api/habits/:id', auth(), wrap(async (req, res) => {
  const h = await db.one(`SELECT * FROM habits WHERE id=$1 AND user_id=$2`, [Number(req.params.id), req.me.user_id]);
  if (!h) return res.status(404).json({ error: 'Привычка не найдена' });
  const f = habitFields(req.body, h);
  if (!f.name) return res.status(400).json({ error: 'Название не может быть пустым' });
  if (f.until && f.until < f.start) return res.status(400).json({ error: 'Дата окончания раньше даты начала' });
  await db.q(`UPDATE habits SET name=$1, note=$2, wdays=$3, start_on=$4, until=$5, time=$6, remind=$7, last_reminded = CASE WHEN $6 IS DISTINCT FROM time THEN NULL ELSE last_reminded END WHERE id=$8`,
    [f.name, f.note, f.wdays, f.start, f.until, f.time, f.remind, h.id]);
  res.json({ ok: true });
}));
app.post('/api/habits/:id/toggle', auth(), wrap(async (req, res) => {
  const h = await db.one(`SELECT * FROM habits WHERE id=$1 AND user_id=$2`, [Number(req.params.id), req.me.user_id]);
  if (!h || !isDate(req.body.day)) return res.status(404).json({ error: 'Привычка не найдена' });
  const r = await db.q(`DELETE FROM habit_marks WHERE habit_id=$1 AND day=$2`, [h.id, req.body.day]);
  if (!r.rowCount) await db.q(`INSERT INTO habit_marks (habit_id, day) VALUES ($1,$2)`, [h.id, req.body.day]);
  res.json({ ok: true });
}));
app.delete('/api/habits/:id', auth(), wrap(async (req, res) => {
  await db.q(`DELETE FROM habits WHERE id=$1 AND user_id=$2`, [Number(req.params.id), req.me.user_id]);
  res.json({ ok: true });
}));

/* ---------- уведомления, настройки, команда ---------- */
app.post('/api/notifs/read', auth(), wrap(async (req, res) => {
  await db.q(`UPDATE notifs SET read=true WHERE member_id=$1`, [req.me.id]);
  res.json({ ok: true });
}));
app.patch('/api/settings', auth(), wrap(async (req, res) => {
  const b = req.body, s = { ...(req.me.settings || {}) };
  for (const k of ['tg', 'onAssign', 'onDone']) if (typeof b[k] === 'boolean') s[k] = b[k];
  for (const k of ['morning', 'evening']) if (/^\d{2}:\d{2}$/.test(b[k] || '')) s[k] = b[k];
  if (['1', '2', '24'].includes(String(b.before))) s.before = String(b.before);
  await db.q(`UPDATE members SET settings=$1 WHERE id=$2`, [s, req.me.id]);
  res.json({ ok: true });
}));
app.post('/api/test-message', auth(), wrap(async (req, res) => {
  await L.notify(req.me.id, '🔔 Проверка связи: уведомления «Орбиты» приходят сюда.', { kind: 'info' });
  res.json({ ok: true });
}));
app.patch('/api/members/:id', auth(), wrap(async (req, res) => {
  if (!L.isAdmin(req.me)) return res.status(403).json({ error: 'Менять сотрудников могут учредитель, владелец или директор' });
  const m = await db.one(`SELECT * FROM members WHERE id=$1 AND company_id=$2`, [Number(req.params.id), req.me.company_id]);
  if (!m) return res.status(404).json({ error: 'Сотрудник не найден' });
  const b = req.body;
  const role = m.role === 'owner' ? 'owner' : (['founder', 'director', 'manager', 'worker'].includes(b.role) ? b.role : m.role);
  let deptId = b.deptId === undefined ? m.dept_id : (Number(b.deptId) || null);
  const newDept = clean(b.newDept, 40);
  if (newDept) {
    const cnt = await db.one(`SELECT count(*)::int AS n FROM depts WHERE company_id=$1`, [req.me.company_id]);
    deptId = (await db.one(`INSERT INTO depts (company_id, name, color) VALUES ($1,$2,$3) ON CONFLICT (company_id, name) DO UPDATE SET name=EXCLUDED.name RETURNING id`, [req.me.company_id, newDept, DEPT_COLORS[cnt.n % DEPT_COLORS.length]])).id;
  }
  const bossId = role === 'founder' ? null : (b.bossId === undefined ? m.boss_id : (Number(b.bossId) && Number(b.bossId) !== m.id ? Number(b.bossId) : null));
  const active = b.active === false && m.role !== 'owner' ? false : m.active;
  await db.q(`UPDATE members SET role=$1, dept_id=$2, title=$3, boss_id=$4, active=$5 WHERE id=$6`, [role, deptId, b.title !== undefined ? clean(b.title, 60) : m.title, bossId, active, m.id]);
  res.json({ ok: true });
}));
/* ---------- кошелёк (личный, видит только сам человек) ---------- */
const W = require('./wallet');
const isMonth = m => /^\d{4}-\d{2}$/.test(String(m || ''));
app.get('/api/wallet', auth(false), wrap(async (req, res) => {
  const uid = req.s.user.id, m = isMonth(req.query.month) ? req.query.month : W.monthOf(today());
  const tx = await db.all(`SELECT id, kind, amount, category, note, day FROM wallet_tx WHERE user_id=$1 AND day >= $2 AND day < $3 ORDER BY day DESC, id DESC`, [uid, W.monthStart(m), W.monthStart(W.nextMonth(m))]);
  const prev = await W.totals(uid, W.prevMonth(m));
  const prevCats = await db.all(`SELECT category, sum(amount)::bigint AS s FROM wallet_tx WHERE user_id=$1 AND kind='expense' AND day >= $2 AND day < $3 GROUP BY category`, [uid, W.monthStart(W.prevMonth(m)), W.monthStart(m)]);
  const budgets = await db.all(`SELECT category, amount FROM wallet_budgets WHERE user_id=$1`, [uid]);
  const months = await db.all(`SELECT to_char(day,'YYYY-MM') AS m, kind, sum(amount)::bigint AS s FROM wallet_tx WHERE user_id=$1 AND day >= $2 GROUP BY 1,2 ORDER BY 1`, [uid, W.monthStart(W.prevMonth(W.prevMonth(W.prevMonth(W.prevMonth(W.prevMonth(m))))))]);
  res.json({ month: m, today: today(), tx: tx.map(t => ({ ...t, amount: Number(t.amount) })), prev, prevCats: Object.fromEntries(prevCats.map(c => [c.category, Number(c.s)])),
    budgets: Object.fromEntries(budgets.map(b => [b.category, Number(b.amount)])),
    history: months.map(x => ({ m: x.m, kind: x.kind, s: Number(x.s) })),
    cats: { expense: W.EXPENSE.map(c => ({ name: c[0], icon: c[1] })), income: W.INCOME.map(c => ({ name: c[0], icon: c[1] })) }, bot: tg.botUsername() });
}));
function walletBody(b) {
  const kind = b.kind === 'income' ? 'income' : 'expense';
  const amount = Math.round(Number(String(b.amount || '').replace(/[^\d.]/g, '')));
  const category = (W.CATS[kind].includes(b.category) ? b.category : null) || W.guessCategory(b.note, kind);
  return { kind, amount, category, note: clean(b.note, 200), day: isDate(b.day) ? b.day : today() };
}
app.post('/api/wallet', auth(false), wrap(async (req, res) => {
  const f = walletBody(req.body);
  if (!f.amount || f.amount <= 0 || f.amount > 1e12) return res.status(400).json({ error: 'Введите сумму' });
  const r = await db.one(`INSERT INTO wallet_tx (user_id, kind, amount, category, note, day) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`, [req.s.user.id, f.kind, f.amount, f.category, f.note, f.day]);
  res.json({ ok: true, id: r.id });
}));
app.patch('/api/wallet/:id', auth(false), wrap(async (req, res) => {
  const f = walletBody(req.body);
  if (!f.amount || f.amount <= 0) return res.status(400).json({ error: 'Введите сумму' });
  await db.q(`UPDATE wallet_tx SET kind=$1, amount=$2, category=$3, note=$4, day=$5 WHERE id=$6 AND user_id=$7`, [f.kind, f.amount, f.category, f.note, f.day, Number(req.params.id), req.s.user.id]);
  res.json({ ok: true });
}));
app.delete('/api/wallet/:id', auth(false), wrap(async (req, res) => {
  await db.q(`DELETE FROM wallet_tx WHERE id=$1 AND user_id=$2`, [Number(req.params.id), req.s.user.id]);
  res.json({ ok: true });
}));
app.put('/api/wallet/budgets', auth(false), wrap(async (req, res) => {
  const cat = clean(req.body.category, 40), amount = Math.round(Number(req.body.amount) || 0);
  if (!W.CATS.expense.includes(cat)) return res.status(400).json({ error: 'Неизвестная категория' });
  if (amount > 0) await db.q(`INSERT INTO wallet_budgets (user_id, category, amount) VALUES ($1,$2,$3) ON CONFLICT (user_id, category) DO UPDATE SET amount=EXCLUDED.amount`, [req.s.user.id, cat, amount]);
  else await db.q(`DELETE FROM wallet_budgets WHERE user_id=$1 AND category=$2`, [req.s.user.id, cat]);
  res.json({ ok: true });
}));

/* ---------- демо-сотрудники: посмотреть процесс без настоящих людей ---------- */
app.post('/api/demo', auth(), wrap(async (req, res) => {
  if (!L.isAdmin(req.me)) return res.status(403).json({ error: 'Только для руководства компании' });
  const co = req.me.company_id, t0 = today();
  const exists = await db.one(`SELECT count(*)::int AS n FROM members m JOIN users u ON u.id=m.user_id WHERE m.company_id=$1 AND u.demo AND m.active`, [co]);
  if (exists.n) return res.status(400).json({ error: 'Демо-сотрудники уже добавлены' });
  const dept = async name => (await db.one(`INSERT INTO depts (company_id, name, color) VALUES ($1,$2,$3) ON CONFLICT (company_id, name) DO UPDATE SET name=EXCLUDED.name RETURNING id`, [co, name, DEPT_COLORS[1]])).id;
  const d1 = await dept('Продажи');
  const mk = async (name, role, title, boss) => {
    const u = await db.one(`INSERT INTO users (name, demo) VALUES ($1, true) RETURNING id`, [name]);
    return (await db.one(`INSERT INTO members (company_id, user_id, role, dept_id, title, boss_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`, [co, u.id, role, d1, title, boss])).id;
  };
  const lead = await mk('Демо: Азиз', 'manager', 'Руководитель отдела', req.me.id);
  const w1 = await mk('Демо: Мадина', 'worker', 'Менеджер', lead);
  const w2 = await mk('Демо: Бехзод', 'worker', 'Менеджер', lead);
  const T = (title, a, author, pr, st, created, due, extra = {}) => db.q(
    `INSERT INTO tasks (company_id, title, descr, assignee_id, author_id, priority, status, created_on, due, done_on) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [co, title, extra.desc || '', a, author, pr, st, addDays(t0, created), addDays(t0, due), st === 'done' ? addDays(t0, extra.doneAgo || -1) : null]);
  await T('Еженедельный отчёт по продажам', lead, req.me.id, 'high', 'progress', -3, 2, { desc: 'Итоги недели по каждому менеджеру.' });
  await T('План продаж на следующий месяц', lead, req.me.id, 'medium', 'new', -1, 6);
  await T('Обзвонить 10 корпоративных клиентов', w1, lead, 'high', 'progress', -4, -1);
  await T('Подготовить коммерческое предложение', w1, lead, 'medium', 'review', -2, 1);
  await T('Сверка оплат за неделю', w2, lead, 'medium', 'new', 0, 0);
  await T('Обновить базу клиентов', w2, lead, 'low', 'done', -6, -2, { doneAgo: -2 });
  const plan = async (mid, items) => { const u = await db.one(`SELECT user_id FROM members WHERE id=$1`, [mid]); for (const [txt, done, time] of items) await db.q(`INSERT INTO plan_items (user_id, day, text, done, time) VALUES ($1,$2,$3,$4,$5)`, [u.user_id, t0, txt, done, time || null]); };
  await plan(lead, [['Планёрка с отделом', true, '09:30'], ['Проверить отчёты менеджеров', false, '12:00'], ['Встреча с клиентом', false, '15:00']]);
  await plan(w1, [['Звонки клиентам', true, '10:00'], ['Отправить КП', true], ['Обновить CRM', false]]);
  await plan(w2, [['Сверка оплат', false, '11:00'], ['Ответить на заявки', false]]);
  res.json({ ok: true });
}));
app.delete('/api/demo', auth(), wrap(async (req, res) => {
  if (!L.isAdmin(req.me)) return res.status(403).json({ error: 'Только для руководства компании' });
  const r = await db.q(`DELETE FROM users u USING members m WHERE m.user_id=u.id AND u.demo AND m.company_id=$1`, [req.me.company_id]);
  res.json({ ok: true, removed: r.rowCount });
}));
// «Войти как» демо-сотрудник и вернуться к себе
app.post('/api/view-as', auth(), wrap(async (req, res) => {
  if (!L.isAdmin(req.me)) return res.status(403).json({ error: 'Только для руководства компании' });
  const m = await db.one(`SELECT m.* FROM members m JOIN users u ON u.id=m.user_id WHERE m.id=$1 AND m.company_id=$2 AND u.demo AND m.active`, [Number(req.body.memberId), req.me.company_id]);
  if (!m) return res.status(404).json({ error: 'Войти можно только за демо-сотрудника' });
  const token = rid();
  await db.q(`INSERT INTO sessions (token, user_id, member_id, back_token) VALUES ($1,$2,$3,$4)`, [token, m.user_id, m.id, req.s.token]);
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: Boolean(req.secure), maxAge: 1000 * 60 * 60 * 12 });
  res.json({ ok: true });
}));
app.post('/api/view-back', auth(false), wrap(async (req, res) => {
  if (!req.s.back) return res.json({ ok: true });
  const back = await db.one(`SELECT token FROM sessions WHERE token=$1`, [req.s.back]);
  await db.q(`DELETE FROM sessions WHERE token=$1`, [req.s.token]);
  if (back) res.cookie(COOKIE, back.token, { httpOnly: true, sameSite: 'lax', secure: Boolean(req.secure), maxAge: 1000 * 60 * 60 * 24 * 90 });
  else res.clearCookie(COOKIE);
  res.json({ ok: true });
}));

app.patch('/api/company', auth(), wrap(async (req, res) => {
  if (!L.isAdmin(req.me)) return res.status(403).json({ error: 'Только учредитель, владелец или директор' });
  const name = clean(req.body.name, 80);
  if (name) await db.q(`UPDATE companies SET name=$1 WHERE id=$2`, [name, req.me.company_id]);
  res.json({ ok: true });
}));
app.patch('/api/profile', auth(false), wrap(async (req, res) => {
  const name = clean(req.body.name, 60);
  if (name) await db.q(`UPDATE users SET name=$1 WHERE id=$2`, [name, req.s.user.id]);
  res.json({ ok: true });
}));

app.get('/healthz', wrap(async (req, res) => { await db.q('SELECT 1'); res.json({ ok: true, bot: tg.botUsername() || null }); }));

/* ---------- интерфейс ---------- */
app.use(express.static(path.join(__dirname, '..', 'public'), { index: false, maxAge: 0, etag: true }));
// index.html отдаём с версией в ссылке на app.js, чтобы браузер не держал старый интерфейс
const BUILD = process.env.RAILWAY_GIT_COMMIT_SHA ? process.env.RAILWAY_GIT_COMMIT_SHA.slice(0, 8) : String(Date.now());
const INDEX = require('fs').readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8').replace('/app.js"', `/app.js?v=${BUILD}"`);
app.get(['/', '/join/:code'], (req, res) => { res.set('Cache-Control', 'no-cache'); res.type('html').send(INDEX); });

/* ---------- запуск ---------- */
async function main() {
  if (!process.env.DATABASE_URL) { console.error('Нет DATABASE_URL — подключите PostgreSQL'); process.exit(1); }
  await db.migrate();
  const port = Number(process.env.PORT) || 3000;
  app.listen(port, () => console.log(`Орбита запущена на порту ${port}`));
  if (tg.enabled()) tg.poll(); else console.warn('BOT_TOKEN не задан — бот выключен');
  setInterval(() => L.tick().catch(e => console.error('[tick]', e)), 30000);
}
if (require.main === module) main();
module.exports = { app, main };
