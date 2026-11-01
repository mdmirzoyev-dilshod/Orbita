// Тарифы «Орбиты»: что бесплатно, что платно, лимиты ИИ и счёт компании.
//  • Бесплатно навсегда: задачи, планы, кошелёк на сайте, бот без ИИ — для руководителей и тех, кто работает один.
//  • Пробный месяц ИИ-помощника (30 дней с первого использования, лимит 30 мин голоса / 300 сообщений).
//  • ИИ-помощник для одиночки: $2 в месяц (60 мин / 500 сообщений), пакет +60 мин — $1.
//  • Команда: руководитель бесплатно, его ИИ работает, пока в оплаченной компании есть хотя бы 1 работник.
//    Работник $1 (ИИ 20 мин / 150 сообщений), «Мои планы» +$1, «Кошелёк» +$1.
//  • Новая компания: 30 дней пробного периода — всё включено.
const db = require('./db');
const { today, addDays } = require('./time');

const UNIT_UZS = Number(process.env.PRICE_UZS || 12000);   // сколько сумов в одной «единице» ($1)
const PRICE = { worker: 1, plans: 1, wallet: 1, solo: 2, pack: 1 };
const LIMITS = { trial: { min: 30, msgs: 300 }, solo: { min: 60, msgs: 500 }, lead: { min: 60, msgs: 500 }, worker: { min: 20, msgs: 150 } };
const TRIAL_DAYS = 30, PACK_MIN = 60;
const ADMIN_ROLES = ['owner', 'founder', 'director'];
const month = () => today().slice(0, 7);
const dayOf = v => (v instanceof Date ? new Date(v.getTime() + 5 * 3600e3).toISOString().slice(0, 10) : String(v || '').slice(0, 10));
const uzs = units => Math.round(units * UNIT_UZS);

async function companyInfo(companyId) {
  const co = await db.one(`SELECT * FROM companies WHERE id=$1`, [companyId]);
  if (!co) return null;
  const rows = await db.all(`SELECT m.id, m.role, m.plans_on, m.wallet_on, u.name, u.demo FROM members m JOIN users u ON u.id=m.user_id WHERE m.company_id=$1 AND m.active`, [companyId]);
  const workers = rows.filter(r => !r.demo && !ADMIN_ROLES.includes(r.role));
  const t0 = today(), trialUntil = addDays(dayOf(co.created_at), TRIAL_DAYS);
  const inTrial = t0 < trialUntil, paid = Boolean(co.paid_until) && co.paid_until >= t0;
  const nPlans = workers.filter(w => w.plans_on).length, nWallet = workers.filter(w => w.wallet_on).length;
  const units = workers.length * PRICE.worker + nPlans * PRICE.plans + nWallet * PRICE.wallet;
  return { id: co.id, name: co.name, trialUntil, inTrial, paidUntil: co.paid_until || null, paid, active: inTrial || paid,
    workers: workers.length, plans: nPlans, wallet: nWallet, units, sum: uzs(units),
    lines: [['Работники', workers.length, PRICE.worker], ['«Мои планы»', nPlans, PRICE.plans], ['«Кошелёк»', nWallet, PRICE.wallet]].filter(l => l[1]).map(([name, n, p]) => ({ name, n, price: uzs(p), total: uzs(n * p) })) };
}

async function memberships(userId) {
  return db.all(`SELECT * FROM members WHERE user_id=$1 AND active`, [userId]);
}

// доступ к «Моим планам» / «Кошельку»: руководителям и одиночкам — всегда, работнику — если подключено (или пробный период компании)
async function hasFeature(userId, feature) {
  const ms = await memberships(userId);
  if (!ms.length || ms.some(m => ADMIN_ROLES.includes(m.role))) return true;
  for (const m of ms) {
    const c = await companyInfo(m.company_id);
    if (c && (c.inTrial || (c.paid && m[feature === 'plans' ? 'plans_on' : 'wallet_on']))) return true;
  }
  return false;
}

async function usage(userId) {
  return (await db.one(`SELECT * FROM ai_usage WHERE user_id=$1 AND month=$2`, [userId, month()])) || { voice_sec: 0, msgs: 0, extra_min: 0 };
}

// что доступно человеку по ИИ сейчас
async function aiAccess(userId) {
  const u = await db.one(`SELECT id, ai_trial_start, ai_paid_until FROM users WHERE id=$1`, [userId]);
  const t0 = today(), sources = [];
  const trialEnds = u.ai_trial_start ? addDays(u.ai_trial_start, TRIAL_DAYS) : null;
  if (!u.ai_trial_start || t0 < trialEnds) sources.push({ src: 'trial', ...LIMITS.trial });
  if (u.ai_paid_until && u.ai_paid_until >= t0) sources.push({ src: 'solo', ...LIMITS.solo });
  for (const m of await memberships(userId)) {
    const c = await companyInfo(m.company_id);
    if (!c || !c.active) continue;
    if (ADMIN_ROLES.includes(m.role)) { if (c.workers > 0) sources.push({ src: 'lead', company: c.name, ...LIMITS.lead }); }
    else sources.push({ src: 'worker', company: c.name, ...LIMITS.worker });
  }
  const best = sources.sort((a, b) => b.min - a.min)[0] || null;
  const us = await usage(userId);
  const limitMin = best ? best.min + (us.extra_min || 0) : 0;
  return {
    on: Boolean(best), src: best ? best.src : null, company: best && best.company,
    limitMin, limitMsgs: best ? best.msgs : 0, usedMin: Math.round((us.voice_sec || 0) / 6) / 10, usedMsgs: us.msgs || 0, extraMin: us.extra_min || 0,
    trialStarted: Boolean(u.ai_trial_start), trialEnds, paidUntil: u.ai_paid_until || null,
    price: { solo: uzs(PRICE.solo), pack: uzs(PRICE.pack), packMin: PACK_MIN },
  };
}

const payHint = () => process.env.PAY_CONTACT ? `\nОплата: ${process.env.PAY_CONTACT}` : '\nДля оплаты напишите администратору «Орбиты».';
// проверка перед обращением к ИИ: null — можно, иначе текст отказа
async function aiGate(userId, { voiceSec = 0 } = {}) {
  const a = await aiAccess(userId);
  if (!a.on) {
    return a.trialStarted
      ? `🤖 Пробный месяц ИИ-помощника закончился.\n\nГолосовые и свободный текст — ${a.price.solo.toLocaleString('ru-RU')} сум в месяц (60 минут голоса и 500 сообщений). Если вы работаете в команде, ИИ включится, когда компания оплатит тариф.${payHint()}\n\nБез ИИ продолжают работать: расход «45000 такси», /tasks, /plan, /wallet и сайт.`
      : '🤖 ИИ-помощник сейчас недоступен.';
  }
  if (a.usedMsgs >= a.limitMsgs) return `🤖 Лимит ИИ на этот месяц исчерпан (${a.limitMsgs} сообщений). Он обновится 1-го числа.${payHint()}`;
  if (voiceSec && (a.usedMin * 60 + voiceSec) > a.limitMin * 60) return `🎙 Лимит голосовых на этот месяц исчерпан (${a.limitMin} мин). Можно докупить +${PACK_MIN} мин за ${a.price.pack.toLocaleString('ru-RU')} сум или писать текстом.${payHint()}`;
  if (!a.trialStarted && a.src === 'trial') await db.q(`UPDATE users SET ai_trial_start=$1 WHERE id=$2 AND ai_trial_start IS NULL`, [today(), userId]);
  return null;
}
async function addUsage(userId, { sec = 0, msgs = 0 }) {
  await db.q(`INSERT INTO ai_usage (user_id, month, voice_sec, msgs) VALUES ($1,$2,$3,$4)
    ON CONFLICT (user_id, month) DO UPDATE SET voice_sec = ai_usage.voice_sec + EXCLUDED.voice_sec, msgs = ai_usage.msgs + EXCLUDED.msgs`, [userId, month(), Math.round(sec), msgs]);
}

// администратор платформы: из PLATFORM_ADMINS (Telegram id или @username через запятую), иначе — самый первый пользователь с Telegram
async function isPlatformAdmin(user) {
  if (!user) return false;
  const list = String(process.env.PLATFORM_ADMINS || '').split(',').map(s => s.trim().replace(/^@/, '').toLowerCase()).filter(Boolean);
  if (list.length) return list.includes(String(user.tg_id)) || (user.username && list.includes(String(user.username).toLowerCase()));
  const first = await db.one(`SELECT id FROM users WHERE tg_id > 0 AND NOT demo ORDER BY id LIMIT 1`);
  return Boolean(first) && first.id === user.id;
}

// за 3 дня до конца пробного месяца — сообщение в Telegram (один раз)
async function trialReminders(tg) {
  const t0 = today();
  const rows = await db.all(`SELECT id, tg_id, ai_trial_start FROM users WHERE tg_id > 0 AND ai_trial_start IS NOT NULL AND NOT ai_trial_notified AND ai_trial_start <= $1`, [addDays(t0, 3 - TRIAL_DAYS)]);
  for (const u of rows) {
    await db.q(`UPDATE users SET ai_trial_notified=true WHERE id=$1`, [u.id]);
    const a = await aiAccess(u.id);
    if (a.src && a.src !== 'trial') continue;   // ИИ и так оплачен (сам или через компанию)
    await tg.send(u.tg_id, `⏳ Через 3 дня (${addDays(u.ai_trial_start, TRIAL_DAYS)}) заканчивается пробный месяц ИИ-помощника.\n\nЧтобы и дальше ставить задачи и записывать расходы голосом — ${a.price.solo.toLocaleString('ru-RU')} сум в месяц.${payHint()}\n\nВсё остальное в «Орбите» остаётся бесплатным.`, { path: '/#alerts' });
  }
}

module.exports = { UNIT_UZS, PRICE, LIMITS, TRIAL_DAYS, PACK_MIN, uzs, companyInfo, hasFeature, aiAccess, aiGate, addUsage, isPlatformAdmin, trialReminders };
