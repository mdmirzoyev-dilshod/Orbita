// Время и даты по часовому поясу компании (по умолчанию Ташкент)
const TZ = process.env.APP_TZ || 'Asia/Tashkent';

function parts(d = new Date()) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const p = Object.fromEntries(f.formatToParts(d).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}
const today = () => parts().date;
const nowLocal = () => { const p = parts(); return `${p.date}T${p.time}`; };   // «местное» время без пояса
const addDays = (s, n) => { const d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const MON = ['янв.', 'февр.', 'марта', 'апр.', 'мая', 'июня', 'июля', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'];
const fmt = s => { if (!s) return '—'; const d = new Date(String(s).slice(0, 10) + 'T12:00:00Z'); return d.getUTCDate() + ' ' + MON[d.getUTCMonth()]; };
const fmtDue = s => (String(s).slice(0, 10) === today() ? 'сегодня' : String(s).slice(0, 10) === addDays(today(), 1) ? 'завтра' : fmt(s));
const isoDate = v => (v instanceof Date ? `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}` : v ? String(v).slice(0, 10) : null);
const isoLocal = v => {
  if (!v) return null;
  if (v instanceof Date) { const p = n => String(n).padStart(2, '0'); return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}T${p(v.getHours())}:${p(v.getMinutes())}`; }
  return String(v).slice(0, 16).replace(' ', 'T');
};

module.exports = { TZ, parts, today, nowLocal, addDays, fmt, fmtDue, isoDate, isoLocal };
