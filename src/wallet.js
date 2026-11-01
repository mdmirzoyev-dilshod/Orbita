// Кошелёк: личные расходы и доходы человека (общие для всех его компаний, видит только он)
const db = require('./db');
const { today, addDays } = require('./time');

const EXPENSE = [
  ['Продукты', '🛒', ['продукт', 'магазин', 'базар', 'korzinka', 'корзинка', 'макро', 'хлеб', 'мясо', 'овощ', 'фрукт']],
  ['Кафе и рестораны', '🍽', ['кафе', 'ресторан', 'обед', 'ужин', 'завтрак', 'кофе', 'плов', 'доставк', 'еда']],
  ['Транспорт и такси', '🚕', ['такси', 'yandex', 'яндекс', 'метро', 'автобус', 'транспорт', 'парковк']],
  ['Бензин и авто', '⛽', ['бензин', 'газ', 'заправк', 'метан', 'пропан', 'мойк', 'авто', 'машин', 'ремонт авто', 'шиномонтаж']],
  ['Дом и коммуналка', '🏠', ['свет', 'электр', 'вода', 'коммунал', 'аренд', 'квартир', 'дом', 'газ дом']],
  ['Связь и интернет', '📱', ['связь', 'интернет', 'телефон', 'мобил', 'uzmobile', 'beeline', 'ucell', 'mobiuz']],
  ['Семья и дети', '👨‍👩‍👧', ['дет', 'школ', 'сад', 'семь', 'дочк', 'сын', 'жена']],
  ['Здоровье', '💊', ['аптек', 'лекарств', 'врач', 'клиник', 'анализ', 'стомат']],
  ['Одежда', '👕', ['одежд', 'обув', 'куртк', 'рубашк']],
  ['Образование', '📚', ['курс', 'книг', 'учеб', 'английск', 'обучен']],
  ['Садака и помощь', '🤲', ['садака', 'закят', 'помощ', 'мечет', 'благотвор']],
  ['Подарки', '🎁', ['подар', 'цвет', 'праздник', 'свадьб', 'той']],
  ['Спорт и отдых', '🏋', ['спорт', 'зал', 'фитнес', 'бассейн', 'кино', 'отдых', 'развлеч']],
  ['Прочее', '📦', []],
];
const INCOME = [
  ['Зарплата', '💼', ['зарплат', 'оклад', 'аванс']],
  ['Бизнес', '📈', ['бизнес', 'дивиденд', 'прибыл', 'выручк']],
  ['Прочий доход', '💰', ['доход', 'возврат', 'подарок мне']],
];
const CATS = { expense: EXPENSE.map(c => c[0]), income: INCOME.map(c => c[0]) };

function guessCategory(text, kind) {
  const t = String(text || '').toLowerCase();
  for (const [name, , keys] of (kind === 'income' ? INCOME : EXPENSE)) if (keys.some(k => t.includes(k))) return name;
  return kind === 'income' ? 'Прочий доход' : 'Прочее';
}
const fmtSum = n => Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/ /g, ' ') + ' сум';
const monthOf = d => String(d).slice(0, 7);
const monthStart = m => `${m}-01`;
const nextMonth = m => { const [y, mo] = m.split('-').map(Number); return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`; };
const prevMonth = m => { const [y, mo] = m.split('-').map(Number); return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, '0')}`; };
const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const monthName = m => MONTHS[Number(m.slice(5, 7)) - 1];

async function totals(userId, m) {
  const r = await db.all(`SELECT kind, COALESCE(sum(amount),0)::bigint AS s FROM wallet_tx WHERE user_id=$1 AND day >= $2 AND day < $3 GROUP BY kind`, [userId, monthStart(m), monthStart(nextMonth(m))]);
  const o = { expense: 0, income: 0 };
  for (const x of r) o[x.kind] = Number(x.s);
  return o;
}

// Разбор сообщения боту: «45000 такси», «45к обед», «1,2 млн аренда», «+5 000 000 зарплата»
function parseQuick(text) {
  const m = String(text || '').trim().match(/^([+\-])?\s*(\d[\d\s]*(?:[.,]\d+)?)\s*(к|k|тыс\.?|т|млн|m|mln)?(?=\s|$)\s*(.*)$/i);
  if (!m) return null;
  let n = parseFloat(m[2].replace(/\s/g, '').replace(',', '.'));
  const mult = (m[3] || '').toLowerCase();
  if (['к', 'k', 'тыс', 'тыс.', 'т'].includes(mult)) n *= 1000;
  if (['млн', 'm', 'mln'].includes(mult)) n *= 1000000;
  n = Math.round(n);
  if (!n || n <= 0 || n > 1e12) return null;
  const note = m[4].trim();
  const kind = m[1] === '+' || /зарплат|доход|аванс|дивиденд|прибыл/i.test(note) ? 'income' : 'expense';
  return { kind, amount: n, note, category: guessCategory(note, kind) };
}

module.exports = { EXPENSE, INCOME, CATS, guessCategory, fmtSum, monthOf, monthStart, nextMonth, prevMonth, monthName, totals, parseQuick, today, addDays };
