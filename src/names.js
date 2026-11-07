// Фамилия и имя сотрудника: обязательны при входе в команду, вместо ника из Telegram
const PART = /^[A-Za-zА-Яа-яЁёЎўҚқҒғҲҳʻʼ'’`-]{2,30}$/;
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const norm = s => String(s || '').trim().replace(/\s+/g, ' ');
// проверка одной части; ошибка — понятным текстом
function checkPart(v, what, label) {
  const s = norm(v);
  if (!s) return { error: `Укажите ${what}` };
  if (s.split(' ').some(w => !PART.test(w))) return { error: `${label}: только буквы, от 2 символов, без цифр и смайликов` };
  return { value: s.split(' ').map(w => cap(w.toLowerCase().replace(/(^|-)(\p{L})/gu, (m, a, b) => a + b.toUpperCase()))).join(' ') };
}
function fullName(firstName, lastName) {
  const f = checkPart(firstName, 'имя', 'Имя'); if (f.error) return f;
  const l = checkPart(lastName, 'фамилию', 'Фамилия'); if (l.error) return l;
  return { first: f.value, last: l.value, name: `${f.value} ${l.value}` };
}
// из одного сообщения в боте: «Каримов Азиз» → фамилия, имя
function fromText(text) {
  const w = norm(text).split(' ');
  if (w.length < 2 || w.length > 3) return { error: 'Напишите фамилию и имя через пробел, например: Каримов Азиз' };
  return fullName(w.slice(1).join(' '), w[0]);
}
module.exports = { fullName, fromText };
