// Онлайн-оплата: счёт → QR-код / ссылка Payme или Click → платёжная система подтверждает → тариф продлевается сам.
//  Payme: Merchant API (JSON-RPC) на POST /pay/payme, авторизация Basic «Paycom:<PAYME_KEY>».
//  Click: SHOP-API на POST /pay/click/prepare и /pay/click/complete, подпись md5.
// Переменные: PAYME_MERCHANT_ID, PAYME_KEY, PAYME_TEST=1 (песочница);
//             CLICK_SERVICE_ID, CLICK_MERCHANT_ID, CLICK_SECRET_KEY.
const crypto = require('crypto');
const QR = require('qrcode');
const db = require('./db');
const tg = require('./tg');
const B = require('./billing');
const L = require('./logic');

const env = k => process.env[k] || '';
const paymeOn = () => Boolean(env('PAYME_MERCHANT_ID') && env('PAYME_KEY'));
const clickOn = () => Boolean(env('CLICK_SERVICE_ID') && env('CLICK_MERCHANT_ID') && env('CLICK_SECRET_KEY'));
const TIMEOUT = 43200000;   // Payme: 12 часов на оплату созданной транзакции

const SCHEMA = `
CREATE TABLE IF NOT EXISTS invoices (
  id          SERIAL PRIMARY KEY,
  kind        TEXT NOT NULL CHECK (kind IN ('company','ai','pack')),
  company_id  INT REFERENCES companies(id) ON DELETE SET NULL,
  user_id     INT REFERENCES users(id) ON DELETE SET NULL,
  months      INT NOT NULL DEFAULT 1,
  amount      BIGINT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'new',
  provider    TEXT,
  paid_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS payme_tx (
  id           TEXT PRIMARY KEY,
  invoice_id   INT NOT NULL REFERENCES invoices(id),
  amount       BIGINT NOT NULL,
  time         BIGINT NOT NULL,
  state        INT NOT NULL,
  create_time  BIGINT NOT NULL,
  perform_time BIGINT NOT NULL DEFAULT 0,
  cancel_time  BIGINT NOT NULL DEFAULT 0,
  reason       INT
);
CREATE TABLE IF NOT EXISTS click_tx (
  id             SERIAL PRIMARY KEY,
  click_trans_id BIGINT UNIQUE NOT NULL,
  invoice_id     INT NOT NULL REFERENCES invoices(id),
  amount         NUMERIC NOT NULL,
  status         TEXT NOT NULL DEFAULT 'prepared',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);`;
let ready = null;
const migrate = () => (ready ||= db.q(SCHEMA));

const NAMES = { company: 'Тариф компании', ai: 'ИИ-помощник', pack: 'Пакет +60 минут голоса' };
function links(inv) {
  const out = {};
  if (paymeOn()) {
    const host = env('PAYME_TEST') === '1' ? 'https://checkout.test.paycom.uz' : 'https://checkout.paycom.uz';
    const params = `m=${env('PAYME_MERCHANT_ID')};ac.order_id=${inv.id};a=${Number(inv.amount) * 100};l=ru${tg.appUrl() ? ';c=' + tg.appUrl() + '/#alerts' : ''}`;
    out.payme = `${host}/${Buffer.from(params).toString('base64')}`;
  }
  if (clickOn()) {
    const q = new URLSearchParams({ service_id: env('CLICK_SERVICE_ID'), merchant_id: env('CLICK_MERCHANT_ID'), amount: Number(inv.amount).toFixed(2), transaction_param: String(inv.id) });
    if (tg.appUrl()) q.set('return_url', tg.appUrl() + '/#alerts');
    out.click = `https://my.click.uz/services/pay?${q}`;
  }
  return out;
}
const view = inv => ({ id: inv.id, kind: inv.kind, name: NAMES[inv.kind], months: inv.months, amount: Number(inv.amount), status: inv.status, provider: inv.provider, links: inv.status === 'new' ? links(inv) : {} });

async function markPaid(inv, provider) {
  const r = await db.one(`UPDATE invoices SET status='paid', provider=$1, paid_at=now() WHERE id=$2 AND status='new' RETURNING *`, [provider, inv.id]);
  if (!r) return;   // уже оплачен
  await B.applyPayment({ kind: r.kind, companyId: r.company_id, userId: r.user_id, months: r.months, amount: Number(r.amount), note: provider }, tg);
}

/* ---------- Payme Merchant API ---------- */
const perr = (code, ru, data) => ({ error: { code, message: { ru, uz: ru, en: ru }, data } });
async function payme(body) {
  const { method, params = {} } = body || {};
  const now = Date.now();
  const orderOf = async () => {
    const id = Number(params.account && params.account.order_id);
    const inv = id ? await db.one(`SELECT * FROM invoices WHERE id=$1`, [id]) : null;
    if (!inv) return perr(-31050, 'Счёт не найден', 'order_id');
    if (inv.status !== 'new') return perr(-31051, 'Счёт уже оплачен или отменён', 'order_id');
    if (Number(params.amount) !== Number(inv.amount) * 100) return perr(-31001, 'Неверная сумма');
    return { inv };
  };
  const txOut = t => ({ create_time: Number(t.create_time), perform_time: Number(t.perform_time), cancel_time: Number(t.cancel_time), transaction: String(t.invoice_id) + '-' + t.id.slice(-6), state: t.state, reason: t.reason == null ? null : t.reason });

  if (method === 'CheckPerformTransaction') {
    const o = await orderOf(); if (o.error) return o;
    return { result: { allow: true } };
  }
  if (method === 'CreateTransaction') {
    const ex = await db.one(`SELECT * FROM payme_tx WHERE id=$1`, [String(params.id)]);
    if (ex) {
      if (ex.state !== 1) return perr(-31008, 'Операцию выполнить нельзя');
      if (now - Number(ex.create_time) > TIMEOUT) {
        await db.q(`UPDATE payme_tx SET state=-1, reason=4, cancel_time=$1 WHERE id=$2`, [now, ex.id]);
        return perr(-31008, 'Время на оплату истекло');
      }
      return { result: { create_time: Number(ex.create_time), transaction: txOut(ex).transaction, state: ex.state } };
    }
    const o = await orderOf(); if (o.error) return o;
    const busy = await db.one(`SELECT id FROM payme_tx WHERE invoice_id=$1 AND state=1`, [o.inv.id]);
    if (busy) return perr(-31052, 'Счёт уже ожидает оплаты в другой транзакции', 'order_id');
    const t = await db.one(`INSERT INTO payme_tx (id, invoice_id, amount, time, state, create_time) VALUES ($1,$2,$3,$4,1,$5) RETURNING *`, [String(params.id), o.inv.id, Number(params.amount), Number(params.time) || now, now]);
    return { result: { create_time: Number(t.create_time), transaction: txOut(t).transaction, state: 1 } };
  }
  if (method === 'PerformTransaction') {
    const t = await db.one(`SELECT * FROM payme_tx WHERE id=$1`, [String(params.id)]);
    if (!t) return perr(-31003, 'Транзакция не найдена');
    if (t.state === 2) return { result: { transaction: txOut(t).transaction, perform_time: Number(t.perform_time), state: 2 } };
    if (t.state !== 1) return perr(-31008, 'Операцию выполнить нельзя');
    if (now - Number(t.create_time) > TIMEOUT) {
      await db.q(`UPDATE payme_tx SET state=-1, reason=4, cancel_time=$1 WHERE id=$2`, [now, t.id]);
      return perr(-31008, 'Время на оплату истекло');
    }
    await db.q(`UPDATE payme_tx SET state=2, perform_time=$1 WHERE id=$2`, [now, t.id]);
    await markPaid(await db.one(`SELECT * FROM invoices WHERE id=$1`, [t.invoice_id]), 'payme');
    return { result: { transaction: txOut(t).transaction, perform_time: now, state: 2 } };
  }
  if (method === 'CancelTransaction') {
    const t = await db.one(`SELECT * FROM payme_tx WHERE id=$1`, [String(params.id)]);
    if (!t) return perr(-31003, 'Транзакция не найдена');
    if (t.state === 1) {
      await db.q(`UPDATE payme_tx SET state=-1, reason=$1, cancel_time=$2 WHERE id=$3`, [Number(params.reason) || null, now, t.id]);
      return { result: { transaction: txOut(t).transaction, cancel_time: now, state: -1 } };
    }
    if (t.state === 2) return perr(-31007, 'Услуга уже оказана — отмена невозможна');
    return { result: { transaction: txOut(t).transaction, cancel_time: Number(t.cancel_time), state: t.state } };
  }
  if (method === 'CheckTransaction') {
    const t = await db.one(`SELECT * FROM payme_tx WHERE id=$1`, [String(params.id)]);
    if (!t) return perr(-31003, 'Транзакция не найдена');
    return { result: txOut(t) };
  }
  if (method === 'GetStatement') {
    const rows = await db.all(`SELECT * FROM payme_tx WHERE time BETWEEN $1 AND $2 ORDER BY time`, [Number(params.from) || 0, Number(params.to) || now]);
    return { result: { transactions: rows.map(t => ({ id: t.id, time: Number(t.time), amount: Number(t.amount), account: { order_id: String(t.invoice_id) }, ...txOut(t) })) } };
  }
  return { error: { code: -32601, message: { ru: 'Метод не найден', uz: 'Metod topilmadi', en: 'Method not found' }, data: method } };
}

/* ---------- Click SHOP-API ---------- */
const md5 = s => crypto.createHash('md5').update(s).digest('hex');
const CERR = { 0: 'Success', '-1': 'SIGN CHECK FAILED!', '-2': 'Incorrect parameter amount', '-3': 'Action not found', '-4': 'Already paid', '-5': 'User does not exist', '-6': 'Transaction does not exist', '-8': 'Error in request from click', '-9': 'Transaction cancelled' };
async function click(b, action) {
  const out = (error, extra = {}) => ({ click_trans_id: b.click_trans_id, merchant_trans_id: b.merchant_trans_id, error, error_note: CERR[error], ...extra });
  const required = ['click_trans_id', 'service_id', 'merchant_trans_id', 'amount', 'action', 'sign_time', 'sign_string'];
  if (required.some(k => b[k] === undefined)) return out(-8);
  const sign = action === 0
    ? md5(`${b.click_trans_id}${b.service_id}${env('CLICK_SECRET_KEY')}${b.merchant_trans_id}${b.amount}${b.action}${b.sign_time}`)
    : md5(`${b.click_trans_id}${b.service_id}${env('CLICK_SECRET_KEY')}${b.merchant_trans_id}${b.merchant_prepare_id}${b.amount}${b.action}${b.sign_time}`);
  if (sign !== String(b.sign_string) || String(b.service_id) !== env('CLICK_SERVICE_ID')) return out(-1);
  if (Number(b.action) !== action) return out(-3);
  const inv = await db.one(`SELECT * FROM invoices WHERE id=$1`, [Number(b.merchant_trans_id) || 0]);
  if (!inv) return out(-5);
  if (Math.abs(Number(b.amount) - Number(inv.amount)) > 0.01) return out(-2);
  if (action === 0) {
    if (inv.status === 'paid') return out(-4);
    if (inv.status !== 'new') return out(-9);
    const t = await db.one(`INSERT INTO click_tx (click_trans_id, invoice_id, amount) VALUES ($1,$2,$3) ON CONFLICT (click_trans_id) DO UPDATE SET amount=EXCLUDED.amount RETURNING id`, [b.click_trans_id, inv.id, b.amount]);
    return out(0, { merchant_prepare_id: t.id });
  }
  const t = await db.one(`SELECT * FROM click_tx WHERE id=$1 AND click_trans_id=$2`, [Number(b.merchant_prepare_id) || 0, b.click_trans_id]);
  if (!t) return out(-6);
  if (t.status === 'completed' || inv.status === 'paid') return out(-4, { merchant_confirm_id: t.id });
  if (t.status === 'cancelled') return out(-9);
  if (Number(b.error) < 0) { await db.q(`UPDATE click_tx SET status='cancelled' WHERE id=$1`, [t.id]); return out(-9); }
  await db.q(`UPDATE click_tx SET status='completed' WHERE id=$1`, [t.id]);
  await markPaid(inv, 'click');
  return out(0, { merchant_confirm_id: t.id });
}

/* ---------- маршруты ---------- */
function routes(app, { auth, wrap }) {
  migrate().catch(e => console.error('[pay] migrate', e.message));

  // создать счёт: компания (руководство) / ИИ-помощник / пакет минут
  app.post('/api/pay/invoice', auth(false), wrap(async (req, res) => {
    await migrate();
    const kind = ['company', 'ai', 'pack'].includes(req.body.kind) ? req.body.kind : null;
    const months = kind === 'pack' ? 1 : [1, 3, 6, 12].includes(Number(req.body.months)) ? Number(req.body.months) : 1;
    if (!kind) return res.status(400).json({ error: 'Неизвестный тип оплаты' });
    let amount, companyId = null, userId = req.s.user.id;
    if (kind === 'company') {
      const me = req.s.member;
      if (!me || !L.isAdmin(me)) return res.status(403).json({ error: 'Оплачивает руководство компании' });
      const info = await B.companyInfo(me.company_id);
      if (!info.sum) return res.status(400).json({ error: 'Счёт пока 0 сум — в компании нет работников' });
      amount = info.sum * months; companyId = me.company_id; userId = null;
    } else amount = B.uzs(kind === 'ai' ? B.PRICE.solo : B.PRICE.pack) * months;
    // переиспользуем неоплаченный счёт с теми же условиями (не плодим счета)
    let inv = await db.one(`SELECT * FROM invoices WHERE status='new' AND kind=$1 AND company_id IS NOT DISTINCT FROM $2 AND user_id IS NOT DISTINCT FROM $3 AND months=$4 AND amount=$5 AND created_at > now() - interval '1 day'
                            AND NOT EXISTS (SELECT 1 FROM payme_tx p WHERE p.invoice_id=invoices.id AND p.state <> 1)`, [kind, companyId, userId, months, amount]);
    if (!inv) inv = await db.one(`INSERT INTO invoices (kind, company_id, user_id, months, amount) VALUES ($1,$2,$3,$4,$5) RETURNING *`, [kind, companyId, userId, months, amount]);
    res.json({ ...view(inv), enabled: { payme: paymeOn(), click: clickOn() }, contact: env('PAY_CONTACT') });
  }));
  app.get('/api/pay/invoice/:id', auth(false), wrap(async (req, res) => {
    await migrate();
    const inv = await db.one(`SELECT * FROM invoices WHERE id=$1`, [Number(req.params.id)]);
    const mine = inv && (inv.user_id === req.s.user.id || (inv.company_id && req.s.member && req.s.member.company_id === inv.company_id));
    if (!mine) return res.status(404).json({ error: 'Счёт не найден' });
    res.json(view(inv));
  }));
  app.get('/api/pay/qr', auth(false), wrap(async (req, res) => {
    const url = String(req.query.u || '');
    if (!/^https:\/\/(checkout(\.test)?\.paycom\.uz|my\.click\.uz)\//.test(url)) return res.status(400).end();
    res.type('image/svg+xml').send(await QR.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#11163A', light: '#FFFFFF' } }));
  }));

  // Payme → наш сервер
  app.post('/pay/payme', async (req, res) => {
    const id = req.body && req.body.id;
    const auth = String(req.headers.authorization || '');
    const ok = paymeOn() && auth === 'Basic ' + Buffer.from('Paycom:' + env('PAYME_KEY')).toString('base64');
    if (!ok) return res.json({ id, error: { code: -32504, message: { ru: 'Недостаточно привилегий', uz: 'Ruxsat yo‘q', en: 'Insufficient privileges' } } });
    try { await migrate(); res.json({ id, ...(await payme(req.body)) }); }
    catch (e) { console.error('[payme]', e); res.json({ id, error: { code: -32400, message: { ru: 'Внутренняя ошибка', uz: 'Ichki xato', en: 'Internal error' } } }); }
  });
  // Click → наш сервер
  for (const [path, action] of [['/pay/click/prepare', 0], ['/pay/click/complete', 1]]) {
    app.post(path, async (req, res) => {
      if (!clickOn()) return res.json({ error: -8, error_note: 'Click is not configured' });
      try { await migrate(); res.json(await click(req.body || {}, action)); }
      catch (e) { console.error('[click]', e); res.json({ error: -7, error_note: 'Failed to update user' }); }
    });
  }
}

module.exports = { routes, payme, click, links, migrate, paymeOn, clickOn };
