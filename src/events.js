// Шина событий «Орбиты 2.0»: любое изменение данных → событие → сайт и Mini App обновляются сами (SSE).
// Один экземпляр сервера — внутренняя шина. Для нескольких экземпляров можно добавить PostgreSQL LISTEN/NOTIFY.
const { EventEmitter } = require('events');
const bus = new EventEmitter();
bus.setMaxListeners(0);

// склеиваем всплески: несколько изменений одной компании/человека за 300 мс → одно событие
const pending = new Map();
function publish({ type = 'changed', companyId = null, userId = null, entity = null, id = null } = {}) {
  const key = `${companyId || ''}|${userId || ''}`;
  const prev = pending.get(key);
  if (prev) { prev.types.add(type); return; }
  const rec = { types: new Set([type]), companyId, userId, entity, id };
  pending.set(key, rec);
  setTimeout(() => {
    pending.delete(key);
    bus.emit('event', { types: [...rec.types], companyId: rec.companyId, userId: rec.userId, entity: rec.entity, id: rec.id, at: Date.now() });
  }, 300);
}
const subscribe = fn => { bus.on('event', fn); return () => bus.off('event', fn); };

module.exports = { publish, subscribe };
