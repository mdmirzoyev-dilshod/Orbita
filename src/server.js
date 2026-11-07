// Орбита — сервер: API, вход через Telegram, раздача интерфейса
process.env.TZ = process.env.TZ || 'UTC';
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const db = require('./db');
const tg = require('./tg');
const L = require('./logic');
require('./assistant');   // голосовые и свободный текст в боте (ИИ)
const B = require('./billing');
const PAY = require('./pay');
const EV = require('./events');
const { today, nowLocal, addDays, fmtDue } = require('./time');

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: false, limit: '50kb' }));   // Click присылает форму
// любое успешное изменение через API → событие для сайта и Mini App (синхронизация в реальном времени)
app.use('/api', (req, res, next) => {
  if (req.method !== 'GET' && !/^\/(auth|events|logout)/.test(req.path)) {
    res.on('finish', () => {
      if (res.statusCode >= 400) return;
      const companyId = req.me ? req.me.company_id : null, userId = req.s && req.s.user ? req.s.user.id : null;
      if (companyId || userId) EV.publish({ companyId, userId });
    });
  }
  next();
});
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
  const s = await db.one(`SELECT s.*, u.name, u.tg_id, u.username, u.demo, u.name_ok, u.first_name, u.last_name FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=$1`, [token]);
  if (!s) return null;
  let member = s.member_id ? await db.one(`SELECT * FROM members WHERE id=$1 AND user_id=$2 AND active`, [s.member_id, s.user_id]) : null;
  if (!member) {
    member = await db.one(`SELECT * FROM members WHERE user_id=$1 AND active ORDER BY created_at LIMIT 1`, [s.user_id]);
    if (member) await db.q(`UPDATE sessions SET member_id=$1 WHERE token=$2`, [member.id, token]);
  }
  return { token, back: s.back_token, user: { id: s.user_id, name: s.name, tg_id: s.tg_id, username: s.username, demo: s.demo, name_ok: s.name_ok || s.demo, first_name: s.first_name, last_name: s.last_name }, member };
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
// OPEN_SIGNUP=1 — открыть создание компаний всем (только для локальных тестов); по умолчанию — только администратор платформы
const canCreateCompany = async user => process.env.OPEN_SIGNUP === '1' || Boolean(await B.isPlatformAdmin(user));
const NAMES = require('./names');
// указать фамилию и имя (обязательно для всех, кто вошёл под ником Telegram)
app.post('/api/profile/name', auth(false), wrap(async (req, res) => {
  const n = NAMES.fullName(req.body.firstName, req.body.lastName);
  if (n.error) return res.status(400).json({ error: n.error });
  await db.q(`UPDATE users SET name=$1, first_name=$2, last_name=$3, name_ok=true WHERE id=$4`, [n.name, n.first, n.last, req.s.user.id]);
  res.json({ ok: true, name: n.name });
}));
app.get('/api/me', wrap(async (req, res) => {
  const s = await loadSession(req);
  const base = { bot: tg.botUsername(), botReady: tg.enabled(), devLogin: process.env.DEV_LOGIN === '1' };
  if (!s) return res.json({ ...base, user: null });
  const companies = await db.all(`SELECT m.id AS member_id, m.role, c.id, c.name FROM members m JOIN companies c ON c.id=m.company_id WHERE m.user_id=$1 AND m.active ORDER BY m.created_at`, [s.user.id]);
  res.json({ ...base, user: s.user, member: s.member ? s.member.id : null, companies, viewingAs: Boolean(s.back), canCreateCompany: await canCreateCompany(s.user) });
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
  const tgId = -Math.floor(Math.random() * 1e9);   // всегда новый тестовый пользователь — войти в чужой аккаунт нельзя
  const u = await tg.upsertUser({ id: tgId, first_name: clean(req.body.name, 60) || 'Тест' });
  await db.q(`UPDATE users SET name_ok=true WHERE id=$1`, [u.id]);
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
  // новые компании создаёт только администратор платформы; остальные попадают в компанию по приглашению
  if (!(await canCreateCompany(req.s.user))) return res.status(403).json({ error: 'Новую компанию может создать только администратор «Орбиты». Чтобы войти в команду, откройте ссылку-приглашение от руководителя.' });
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
  // фамилия и имя обязательны (если ещё не указаны) — чтобы в команде не было людей под никами
  if (!req.s.user.name_ok || req.body.firstName || req.body.lastName) {
    const n = NAMES.fullName(req.body.firstName, req.body.lastName);
    if (n.error) return res.status(400).json({ error: n.error, needName: true });
    await db.q(`UPDATE users SET name=$1, first_name=$2, last_name=$3, name_ok=true WHERE id=$4`, [n.name, n.first, n.last, req.s.user.id]);
    req.s.user.name = n.name;
  }
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
  const attIds = comments.filter(c => c.attach_id).map(c => c.attach_id);
  const attMap = Object.fromEntries((attIds.length ? await db.all(`SELECT id, name, mime, size FROM task_files WHERE id = ANY($1)`, [attIds]) : []).map(f => [f.id, f]));
  const sids = [...new Set(tasks.map(t => t.series_id).filter(Boolean))];
  const seriesMap = Object.fromEntries((sids.length ? await db.all(`SELECT id, repeat, active FROM task_series WHERE id = ANY($1)`, [sids]) : []).map(x => [x.id, x]));
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
    company: { id: co.id, name: co.name, logo: co.logo_mime ? co.logo_v : null },
    me: me.id,
    myRole: me.role,
    isAdmin: L.isAdmin(me),
    scope,
    depts: depts.map(d => ({ id: d.id, name: d.name, color: d.color })),
    users: members.map(m => ({ id: m.id, name: m.name, first: m.first_name || '', last: m.last_name || '', nameOk: Boolean(m.name_ok || m.demo), demo: Boolean(m.demo), role: m.role === 'worker' ? 'worker' : 'manager', level: m.role, pos: m.role === 'owner' ? (m.pos === 'director' ? 'director' : 'founder') : null, owner: m.role === 'owner', admin: L.ADMIN.includes(m.role), dept: m.dept || 'Без отдела', deptId: m.dept_id, deptColor: m.dept_color || '#9AA3C7', plansOn: m.plans_on, walletOn: m.wallet_on, title: m.title || '', boss: m.boss_id, tg: Boolean(m.tg_id) && (m.settings || {}).tg !== false, username: m.username })),
    tasks: tasks.map(t => ({ id: t.id, title: t.title, desc: t.descr, assignee: t.assignee_id, author: t.author_id, priority: t.priority, status: t.status, created: t.created_on, due: t.due, dueTime: t.due_time, ext: t.extended, remind: t.remind_at, doneAt: t.done_on,
      comments: comments.filter(c => c.task_id === t.id).map(c => ({ id: c.id, u: c.member_id, t: c.text, at: c.at, f: Boolean(c.file_id), a: c.attach_id && attMap[c.attach_id] ? { id: c.attach_id, name: attMap[c.attach_id].name, mime: attMap[c.attach_id].mime, size: attMap[c.attach_id].size } : null })),
      seenAt: t.seen_at, snoozeUntil: t.snooze_until, remindOff: t.remind_off, photo: t.requires_photo, checklist: Array.isArray(t.checklist) ? t.checklist : [], series: t.series_id ? { id: t.series_id, repeat: (seriesMap[t.series_id] || {}).repeat, active: (seriesMap[t.series_id] || {}).active } : null })),
    plans: P,
    habits: habits.map(h => ({ id: h.id, name: h.name, note: h.note, wdays: h.wdays, start: h.start_on, until: h.until, time: h.time, remind: h.remind, days: Object.fromEntries(marks.filter(m => m.habit_id === h.id).map(m => [m.day, true])) })),
    notifs: notifs.map(n => ({ id: n.id, to: me.id, text: n.text, at: n.at, read: n.read })),
    settings: { [me.id]: me.settings },
    bot: tg.botUsername(),
    billing: {
      company: L.isAdmin(me) ? await B.companyInfo(me.company_id) : null,
      ai: await B.aiAccess(me.user_id),
      features: { plans: await B.hasFeature(me.user_id, 'plans'), wallet: await B.hasFeature(me.user_id, 'wallet') },
      platformAdmin: await B.isPlatformAdmin(req.s.user),
      pay: process.env.PAY_CONTACT || '',
    },
  });
}));

/* ---------- задачи ---------- */
async function visibleTask(me, id) {
  const t = await db.one(`SELECT * FROM tasks WHERE id=$1 AND company_id=$2`, [id, me.company_id]);
  return (await L.canSeeTask(me, t)) ? t : null;
}
app.post('/api/tasks', auth(), wrap(async (req, res) => {
  const r = await L.createTask(req.me, req.body);
  if (r.error) return res.status(r.error.startsWith('Этому') ? 403 : 400).json({ error: r.error });
  res.json({ id: r.task ? r.task.id : null, series: r.series ? r.series.id : null });
}));
app.patch('/api/tasks/:id', auth(), wrap(async (req, res) => {
  const t = await visibleTask(req.me, Number(req.params.id));
  if (!t) return res.status(404).json({ error: 'Задача не найдена' });
  const b = req.body;
  if (b.status) {
    if (!L.STATUS[b.status]) return res.status(400).json({ error: 'Неизвестный статус' });
    if (b.status === 'done' && t.assignee_id === req.me.id && t.author_id !== req.me.id) {
      const r = await L.markDone(t, req.me);
      if (r.needPhoto) return res.status(400).json({ error: 'Нужен отчёт: прикрепите фото или файл (кнопка «📎 Прикрепить файл» в задаче или ответом в боте)' });
    } else await L.changeStatus(t.id, req.me.id, b.status);
  }
  if (t.author_id === req.me.id || L.isAdmin(req.me)) {
    const sets = [], vals = [];
    if (b.title !== undefined && clean(b.title, 200)) { vals.push(clean(b.title, 200)); sets.push(`title=$${vals.length}`); }
    if (b.desc !== undefined) { vals.push(clean(b.desc, 2000)); sets.push(`descr=$${vals.length}`); }
    if (isDate(b.due)) { vals.push(b.due); sets.push(`due=$${vals.length}, before_sent=false, overdue_sent=false`); }
    if (b.dueTime !== undefined) { vals.push(/^\d{2}:\d{2}$/.test(b.dueTime || '') ? b.dueTime : null); sets.push(`due_time=$${vals.length}, overdue_sent=false`); }
    if (b.priority && L.PRIO[b.priority]) { vals.push(b.priority); sets.push(`priority=$${vals.length}`); }
    if (b.remind !== undefined) { vals.push(isDT(b.remind) ? b.remind : null); sets.push(`remind_at=$${vals.length}, remind_sent=false`); }
    if (sets.length) { vals.push(t.id); await db.q(`UPDATE tasks SET ${sets.join(', ')} WHERE id=$${vals.length}`, vals); }
  }
  res.json({ ok: true });
}));
// файлы к задаче: загрузка с сайта / Mini App (до 20 МБ) и скачивание
const FILE_MAX = 20 * 1048576;
app.post('/api/tasks/:id/files', auth(), express.raw({ type: () => true, limit: FILE_MAX }), wrap(async (req, res) => {
  const t = await visibleTask(req.me, Number(req.params.id));
  if (!t) return res.status(404).json({ error: 'Задача не найдена' });
  const data = req.body;
  if (!Buffer.isBuffer(data) || !data.length) return res.status(400).json({ error: 'Файл пустой' });
  let name = 'file'; try { name = decodeURIComponent(String(req.get('x-file-name') || 'file')); } catch {}
  name = name.replace(/[\\/\r\n]+/g, '_').slice(0, 200) || 'file';
  const mime = String(req.get('content-type') || 'application/octet-stream').slice(0, 120);
  let caption = ''; try { caption = clean(decodeURIComponent(String(req.get('x-caption') || '')), 300); } catch {}
  const r = await L.attachFile(t, req.me, { name, mime, size: data.length, data, caption });
  res.json({ ok: true, id: r.id, closed: r.closed });
}));
app.get('/api/files/:id', auth(), wrap(async (req, res) => {
  const f = await db.one(`SELECT * FROM task_files WHERE id=$1`, [Number(req.params.id)]);
  const t = f && await visibleTask(req.me, f.task_id);
  if (!t) return res.status(404).end();
  let buf = f.data;
  if (!buf && f.tg_file_id) { try { buf = await tg.download(f.tg_file_id); } catch { return res.status(502).json({ error: 'Файл слишком большой для загрузки из Telegram — откройте его в боте' }); } }
  if (!buf) return res.status(404).end();
  const inline = req.query.inline === '1' && /^image\//.test(f.mime);
  res.set({ 'Content-Type': f.mime, 'Content-Length': buf.length, 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff',
    'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(f.name)}` });
  res.send(buf);
}));
app.post('/api/tasks/:id/remind', auth(), wrap(async (req, res) => {
  const t = await visibleTask(req.me, Number(req.params.id));
  if (!t || !(t.assignee_id === req.me.id || t.author_id === req.me.id)) return res.status(403).json({ error: 'Напоминания настраивает исполнитель или автор' });
  const b = req.body;
  if (b.snooze) await L.setTaskRemind(t, { snooze: L.snoozeAt(String(b.snooze)), userId: req.s.user.id });
  else await L.setTaskRemind(t, { off: Boolean(b.off) });
  res.json({ ok: true });
}));
app.post('/api/tasks/:id/check', auth(), wrap(async (req, res) => {
  const r = await L.toggleCheck(Number(req.params.id), req.me, Number(req.body.idx));
  if (r.error) return res.status(400).json(r);
  res.json({ ok: true });
}));
app.post('/api/tasks/:id/more', auth(), wrap(async (req, res) => {
  const t = await visibleTask(req.me, Number(req.params.id));
  if (!t || t.assignee_id !== req.me.id) return res.status(403).json({ error: 'Задача назначена не вам' });
  const r = await L.askMore(t, req.me);
  if (r.error) return res.status(400).json(r);
  res.json({ ok: true });
}));
app.delete('/api/series/:id', auth(), wrap(async (req, res) => {
  const ser = await db.one(`SELECT * FROM task_series WHERE id=$1 AND company_id=$2`, [Number(req.params.id), req.me.company_id]);
  if (!ser || !(ser.author_id === req.me.id || L.isAdmin(req.me))) return res.status(403).json({ error: 'Остановить повтор может автор задачи или руководство' });
  await db.q(`UPDATE task_series SET active=false WHERE id=$1`, [ser.id]);
  res.json({ ok: true });
}));
app.get('/api/comments/:id/file', auth(), wrap(async (req, res) => {
  const c = await db.one(`SELECT c.file_id, c.task_id FROM comments c WHERE c.id=$1`, [Number(req.params.id)]);
  const t = c && c.file_id && await visibleTask(req.me, c.task_id);
  if (!t) return res.status(404).end();
  try { const buf = await tg.download(c.file_id); res.set('Cache-Control', 'private, max-age=86400').type('image/jpeg').send(buf); }
  catch { res.status(502).end(); }
}));
app.post('/api/tasks/:id/extend', auth(), wrap(async (req, res) => {
  const t = await visibleTask(req.me, Number(req.params.id));
  if (!t) return res.status(404).json({ error: 'Задача не найдена' });
  const b = req.body, opt = L.EXT[b.code] ? L.EXT[b.code] : isDate(b.due) ? { due: b.due, dueTime: /^\d{2}:\d{2}$/.test(b.dueTime || '') ? b.dueTime : null } : null;
  if (!opt) return res.status(400).json({ error: 'Выберите новый срок' });
  const r = await L.extendTask(t.id, req.me, opt);
  if (r.error) return res.status(400).json(r);
  res.json(r);
}));
app.delete('/api/tasks/:id', auth(), wrap(async (req, res) => {
  const t = await visibleTask(req.me, Number(req.params.id));
  if (!t || !(t.author_id === req.me.id || L.isAdmin(req.me))) return res.status(403).json({ error: 'Удалить может только автор задачи' });
  await L.syncTaskMessages(t.id, 'deleted');
  await L.cancelReminders('task', t.id);
  await db.q(`DELETE FROM tasks WHERE id=$1`, [t.id]);
  res.json({ ok: true });
}));
app.post('/api/tasks/:id/comments', auth(), wrap(async (req, res) => {
  const t = await visibleTask(req.me, Number(req.params.id));
  if (!t) return res.status(404).json({ error: 'Задача не найдена' });
  const r = await L.addComment(t, req.me, clean(req.body.text, 1000));
  if (r.error) return res.status(400).json(r);
  res.json({ ok: true });
}));

/* ---------- платные разделы: «Мои планы» и «Кошелёк» ---------- */
const needFeature = (f, name) => (req, res, next) => (async () => {
  if (!req.s || !req.s.user) return next();
  if (await B.hasFeature(req.s.user.id, f)) return next();
  res.status(402).json({ error: `«${name}» не подключён. Попросите руководителя подключить его в разделе «Команда».`, locked: f });
})().catch(next);
app.use(['/api/plans', '/api/habits'], (req, res, next) => loadSession(req).then(s => { req.s = req.s || s; next(); }).catch(next), needFeature('plans', 'Мои планы'));
app.use('/api/wallet', (req, res, next) => loadSession(req).then(s => { req.s = req.s || s; next(); }).catch(next), needFeature('wallet', 'Кошелёк'));

/* ---------- онлайн-оплата: счёт → QR Payme / Click → автопродление ---------- */
PAY.routes(app, { auth, wrap, clean });

/* ---------- администрирование платформы: отметка оплат ---------- */
const platformAdmin = () => (req, res, next) => B.isPlatformAdmin(req.s.user).then(ok => ok ? next() : res.status(403).json({ error: 'Только для администратора платформы' })).catch(next);
app.get('/api/admin/overview', auth(false), platformAdmin(), wrap(async (req, res) => {
  const cos = await db.all(`SELECT id FROM companies ORDER BY id DESC LIMIT 300`);
  const companies = [];
  for (const c of cos) {
    const info = await B.companyInfo(c.id);
    const owner = await db.one(`SELECT u.name, u.username FROM members m JOIN users u ON u.id=m.user_id WHERE m.company_id=$1 AND m.role='owner' LIMIT 1`, [c.id]);
    companies.push({ ...info, owner: owner && owner.name, ownerUsername: owner && owner.username });
  }
  const us = await db.all(`SELECT u.id, u.name, u.username, u.ai_trial_start, u.ai_paid_until, COALESCE(a.voice_sec,0) voice_sec, COALESCE(a.msgs,0) msgs, COALESCE(a.extra_min,0) extra_min
     FROM users u LEFT JOIN ai_usage a ON a.user_id=u.id AND a.month=$1 WHERE NOT u.demo AND u.tg_id > 0 AND (u.ai_trial_start IS NOT NULL OR u.ai_paid_until IS NOT NULL) ORDER BY u.id DESC LIMIT 300`, [today().slice(0, 7)]);
  const users = [];
  for (const u of us) { const a = await B.aiAccess(u.id); users.push({ id: u.id, name: u.name, username: u.username, trialEnds: a.trialEnds, paidUntil: u.ai_paid_until, src: a.src, usedMin: a.usedMin, limitMin: a.limitMin, usedMsgs: a.usedMsgs, limitMsgs: a.limitMsgs }); }
  const pays = await db.all(`SELECT p.*, c.name AS company, u.name AS user FROM payments p LEFT JOIN companies c ON c.id=p.company_id LEFT JOIN users u ON u.id=p.user_id ORDER BY p.id DESC LIMIT 50`);
  res.json({ companies, users, payments: pays.map(p => ({ id: p.id, kind: p.kind, company: p.company, user: p.user, months: p.months, amount: Number(p.amount), at: p.at })), price: { unit: B.UNIT_UZS, solo: B.uzs(B.PRICE.solo), pack: B.uzs(B.PRICE.pack) } });
}));
app.post('/api/admin/company/:id/paid', auth(false), platformAdmin(), wrap(async (req, res) => {
  const months = Math.max(1, Math.min(12, Number(req.body.months) || 1));
  const co = await db.one(`SELECT * FROM companies WHERE id=$1`, [Number(req.params.id)]);
  if (!co) return res.status(404).json({ error: 'Компания не найдена' });
  const info = await B.companyInfo(co.id);
  const r = await B.applyPayment({ kind: 'company', companyId: co.id, months, amount: info.sum * months, byUser: req.s.user.id, note: 'вручную' }, tg);
  res.json({ ok: true, paidUntil: r.until });
}));
app.post('/api/admin/user/:id/ai', auth(false), platformAdmin(), wrap(async (req, res) => {
  const u = await db.one(`SELECT * FROM users WHERE id=$1`, [Number(req.params.id)]);
  if (!u) return res.status(404).json({ error: 'Пользователь не найден' });
  if (req.body.pack) { await B.applyPayment({ kind: 'pack', userId: u.id, amount: B.uzs(B.PRICE.pack), byUser: req.s.user.id, note: `+${B.PACK_MIN} мин` }, tg); return res.json({ ok: true }); }
  const months = Math.max(1, Math.min(12, Number(req.body.months) || 1));
  const r = await B.applyPayment({ kind: 'ai', userId: u.id, months, amount: B.uzs(B.PRICE.solo) * months, byUser: req.s.user.id, note: 'вручную' }, tg);
  res.json({ ok: true, paidUntil: r.until });
}));
app.get('/api/admin/find-user', auth(false), platformAdmin(), wrap(async (req, res) => {
  const q = clean(req.query.q, 60).replace(/^@/, '');
  const rows = q ? await db.all(`SELECT id, name, username, ai_trial_start, ai_paid_until FROM users WHERE NOT demo AND tg_id > 0 AND (name ILIKE $1 OR username ILIKE $1) ORDER BY id DESC LIMIT 20`, ['%' + q + '%']) : [];
  res.json(rows);
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
    if (b.done) await L.cancelReminders('plan', id);
    await L.syncPlanMessages(id, b.done);
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
  // руководство исправляет фамилию и имя сотрудника
  if (b.firstName !== undefined || b.lastName !== undefined) {
    const n = NAMES.fullName(b.firstName, b.lastName);
    if (n.error) return res.status(400).json({ error: n.error });
    await db.q(`UPDATE users SET name=$1, first_name=$2, last_name=$3, name_ok=true WHERE id=$4`, [n.name, n.first, n.last, m.user_id]);
  }
  // владелец остаётся владельцем, но выбирает, кем стоит в структуре: учредителем или директором; себя понизить нельзя
  const role = m.role === 'owner' || m.id === req.me.id ? m.role : (['founder', 'director', 'manager', 'worker'].includes(b.role) ? b.role : m.role);
  const pos = m.role === 'owner' && ['founder', 'director'].includes(b.role) ? b.role : m.pos;
  let deptId = b.deptId === undefined ? m.dept_id : (Number(b.deptId) || null);
  const newDept = clean(b.newDept, 40);
  if (newDept) {
    const cnt = await db.one(`SELECT count(*)::int AS n FROM depts WHERE company_id=$1`, [req.me.company_id]);
    deptId = (await db.one(`INSERT INTO depts (company_id, name, color) VALUES ($1,$2,$3) ON CONFLICT (company_id, name) DO UPDATE SET name=EXCLUDED.name RETURNING id`, [req.me.company_id, newDept, DEPT_COLORS[cnt.n % DEPT_COLORS.length]])).id;
  }
  const bossId = role === 'founder' || (role === 'owner' && pos !== 'director') ? null : (b.bossId === undefined ? m.boss_id : (Number(b.bossId) && Number(b.bossId) !== m.id ? Number(b.bossId) : null));
  const active = b.active === false && m.role !== 'owner' ? false : m.active;
  await db.q(`UPDATE members SET role=$1, dept_id=$2, title=$3, boss_id=$4, active=$5, plans_on=$6, wallet_on=$7, pos=$9 WHERE id=$8`,
    [role, deptId, (() => { const t = b.title !== undefined ? clean(b.title, 60) : m.title; return role !== m.role && (t === m.title || STD_TITLES.includes(String(t || '').toLowerCase())) ? titleFor(t, role) : t; })(), bossId, active, typeof b.plansOn === 'boolean' ? b.plansOn : m.plans_on, typeof b.walletOn === 'boolean' ? b.walletOn : m.wallet_on, m.id, pos]);
  res.json({ ok: true });
}));
/* ---------- отделы и структура компании ---------- */
// стандартные подписи ролей: при смене роли меняем и их, а свои должности («Продажник», «Главный бухгалтер») не трогаем
const ROLE_TITLE = { founder: 'Учредитель', director: 'Директор', manager: 'Руководитель отдела', worker: '' };
const STD_TITLES = ['', 'учредитель', 'директор', 'руководитель отдела', 'руководитель', 'сотрудник', 'работник', 'владелец'];
const titleFor = (oldTitle, newRole) => STD_TITLES.includes(String(oldTitle || '').trim().toLowerCase()) ? (ROLE_TITLE[newRole] ?? oldTitle) : oldTitle;
const adminOnly = (req, res) => { if (L.isAdmin(req.me)) return true; res.status(403).json({ error: 'Структуру компании меняют учредитель, владелец или директор' }); return false; };
const myDept = (req) => db.one(`SELECT * FROM depts WHERE id=$1 AND company_id=$2`, [Number(req.params.id), req.me.company_id]);
const deptHead = deptId => db.one(`SELECT * FROM members WHERE dept_id=$1 AND role='manager' AND active ORDER BY id LIMIT 1`, [deptId]);
// над руководителем отдела — директор (если есть), иначе учредитель/владелец
const topBoss = companyId => db.one(`SELECT id FROM members WHERE company_id=$1 AND active AND role IN ('director','founder','owner') ORDER BY (role='director') DESC, (role='owner') DESC, id LIMIT 1`, [companyId]);
app.post('/api/depts', auth(), wrap(async (req, res) => {
  if (!adminOnly(req, res)) return;
  const name = clean(req.body.name, 40);
  if (!name) return res.status(400).json({ error: 'Введите название отдела' });
  if (await db.one(`SELECT 1 FROM depts WHERE company_id=$1 AND lower(name)=lower($2)`, [req.me.company_id, name])) return res.status(400).json({ error: 'Такой отдел уже есть' });
  const cnt = await db.one(`SELECT count(*)::int AS n FROM depts WHERE company_id=$1`, [req.me.company_id]);
  const d = await db.one(`INSERT INTO depts (company_id, name, color) VALUES ($1,$2,$3) RETURNING *`, [req.me.company_id, name, DEPT_COLORS[cnt.n % DEPT_COLORS.length]]);
  res.json({ ok: true, id: d.id });
}));
app.patch('/api/depts/:id', auth(), wrap(async (req, res) => {
  if (!adminOnly(req, res)) return;
  const d = await myDept(req); if (!d) return res.status(404).json({ error: 'Отдел не найден' });
  const name = clean(req.body.name, 40);
  if (!name) return res.status(400).json({ error: 'Введите название отдела' });
  if (await db.one(`SELECT 1 FROM depts WHERE company_id=$1 AND lower(name)=lower($2) AND id<>$3`, [req.me.company_id, name, d.id])) return res.status(400).json({ error: 'Такой отдел уже есть' });
  await db.q(`UPDATE depts SET name=$1 WHERE id=$2`, [name, d.id]);
  res.json({ ok: true });
}));
app.delete('/api/depts/:id', auth(), wrap(async (req, res) => {
  if (!adminOnly(req, res)) return;
  const d = await myDept(req); if (!d) return res.status(404).json({ error: 'Отдел не найден' });
  await db.q(`DELETE FROM depts WHERE id=$1`, [d.id]);   // люди остаются в компании «без отдела»
  res.json({ ok: true });
}));
// добавить человека в отдел: работнику руководителем становится руководитель отдела
app.post('/api/depts/:id/members', auth(), wrap(async (req, res) => {
  if (!adminOnly(req, res)) return;
  const d = await myDept(req); if (!d) return res.status(404).json({ error: 'Отдел не найден' });
  const m = await db.one(`SELECT * FROM members WHERE id=$1 AND company_id=$2 AND active`, [Number(req.body.memberId), req.me.company_id]);
  if (!m) return res.status(404).json({ error: 'Сотрудник не найден' });
  const head = await deptHead(d.id);
  const boss = m.role === 'worker' && head && head.id !== m.id ? head.id : m.boss_id;
  await db.q(`UPDATE members SET dept_id=$1, boss_id=$2 WHERE id=$3`, [d.id, boss, m.id]);
  res.json({ ok: true });
}));
// назначить руководителя отдела: роль «Руководитель отдела», подчиняется директору; работники отдела — ему
app.post('/api/depts/:id/head', auth(), wrap(async (req, res) => {
  if (!adminOnly(req, res)) return;
  const d = await myDept(req); if (!d) return res.status(404).json({ error: 'Отдел не найден' });
  const m = await db.one(`SELECT * FROM members WHERE id=$1 AND company_id=$2 AND active`, [Number(req.body.memberId), req.me.company_id]);
  if (!m) return res.status(404).json({ error: 'Сотрудник не найден' });
  if (L.isAdmin(m)) return res.status(400).json({ error: 'Учредитель и директор уже руководят всей компанией' });
  const top = await topBoss(req.me.company_id);
  await db.tx(async c => {
    for (const o of (await c.query(`SELECT id, title FROM members WHERE dept_id=$1 AND role='manager' AND id<>$2`, [d.id, m.id])).rows)
      await c.query(`UPDATE members SET role='worker', boss_id=$2, title=$3 WHERE id=$1`, [o.id, m.id, titleFor(o.title, 'worker')]);   // прежний руководитель — в работники отдела
    await c.query(`UPDATE members SET role='manager', dept_id=$1, boss_id=$2, title=$4 WHERE id=$3`, [d.id, top && top.id !== m.id ? top.id : null, m.id, titleFor(m.title, 'manager')]);
    await c.query(`UPDATE members SET boss_id=$2 WHERE dept_id=$1 AND role='worker' AND id<>$2`, [d.id, m.id]);
  });
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
// логотип компании (в верхней панели): загружает и убирает руководство, видят участники компании
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
app.post('/api/company/logo', auth(), express.raw({ type: () => true, limit: 2 * 1048576 }), wrap(async (req, res) => {
  if (!L.isAdmin(req.me)) return res.status(403).json({ error: 'Логотип меняет учредитель, владелец или директор' });
  const mime = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (!LOGO_TYPES.includes(mime)) return res.status(400).json({ error: 'Нужна картинка PNG, JPG, WEBP или GIF' });
  if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: 'Файл пустой' });
  const r = await db.one(`UPDATE companies SET logo=$1, logo_mime=$2, logo_v=logo_v+1 WHERE id=$3 RETURNING logo_v`, [req.body, mime, req.me.company_id]);
  res.json({ ok: true, logo: r.logo_v });
}));
app.delete('/api/company/logo', auth(), wrap(async (req, res) => {
  if (!L.isAdmin(req.me)) return res.status(403).json({ error: 'Логотип меняет учредитель, владелец или директор' });
  await db.q(`UPDATE companies SET logo=NULL, logo_mime=NULL, logo_v=logo_v+1 WHERE id=$1`, [req.me.company_id]);
  res.json({ ok: true });
}));
app.get('/api/company/:id/logo', auth(false), wrap(async (req, res) => {
  const co = await db.one(`SELECT c.logo, c.logo_mime FROM companies c JOIN members m ON m.company_id=c.id AND m.user_id=$2 AND m.active WHERE c.id=$1`, [Number(req.params.id), req.s.user.id]);
  if (!co || !co.logo) return res.status(404).end();
  res.set({ 'Content-Type': co.logo_mime, 'Cache-Control': 'private, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' });
  res.end(co.logo);
}));
app.patch('/api/profile', auth(false), wrap(async (req, res) => {
  const name = clean(req.body.name, 60);
  if (name) await db.q(`UPDATE users SET name=$1 WHERE id=$2`, [name, req.s.user.id]);
  res.json({ ok: true });
}));

// поток событий (Server-Sent Events): сайт и Mini App узнают об изменениях мгновенно
app.get('/api/events', auth(false), async (req, res) => {
  const uid = req.s.user.id;
  let cos = new Set((await db.all(`SELECT company_id FROM members WHERE user_id=$1 AND active`, [uid])).map(r => r.company_id));
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  res.write(`retry: 3000\nevent: hello\ndata: {}\n\n`);
  const unsub = EV.subscribe(async e => {
    if (e.companyId && !cos.has(e.companyId)) cos = new Set((await db.all(`SELECT company_id FROM members WHERE user_id=$1 AND active`, [uid]).catch(() => [])).map(r => r.company_id));
    if (e.userId === uid || (e.companyId && cos.has(e.companyId))) res.write(`data: ${JSON.stringify({ types: e.types, at: e.at })}\n\n`);
  });
  const ping = setInterval(() => res.write(`: ping\n\n`), 25000);
  req.on('close', () => { clearInterval(ping); unsub(); });
});
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
  await require('./pay').migrate().catch(e => console.error('[pay] migrate', e.message));
  const port = Number(process.env.PORT) || 3000;
  app.listen(port, () => console.log(`Орбита запущена на порту ${port}`));
  if (tg.enabled()) tg.poll(); else console.warn('BOT_TOKEN не задан — бот выключен');
  setInterval(() => L.tick().catch(e => console.error('[tick]', e)), 30000);
}
if (require.main === module) main();
module.exports = { app, main };
