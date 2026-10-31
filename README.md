# Орбита

Задачи, личные планы и дисциплина команды + Telegram-бот уведомлений.

- **Сервер:** Node.js 20+, Express.
- **База:** PostgreSQL. Таблицы создаются сами при первом запуске.
- **Вход:** через Telegram-бота, без паролей.
- **Бот:**
  - уведомления о задачах с кнопкой «✅ Выполнено»;
  - утренняя сводка и вечерние итоги;
  - напоминания;
  - команды `/tasks` и `/plan`.
- **Роли:**
  - владелец видит всю компанию;
  - руководитель видит свой отдел и подчинённых;
  - сотрудник видит свои задачи.
- **Компании:** каждая видит только свои данные, приложение готово к продаже.

## Запуск на Railway

1. **New Project → Deploy from GitHub repo** → выбрать репозиторий `orbita`.
2. В проекте: **+ New → Database → Add PostgreSQL**.
3. Откройте сервис `orbita` → **Variables** и добавьте:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (ссылка на базу);
   - `BOT_TOKEN` = токен от @BotFather;
   - `APP_TZ` = `Asia/Tashkent`.
4. **Settings → Networking → Generate Domain**. Появится адрес вида `orbita-production.up.railway.app`.
5. Откройте адрес → «Войти через Telegram» → создайте компанию → пригласите сотрудников.

Проверка работы сервера: `https://<адрес>/healthz` должен ответить `{"ok":true,"bot":"ИмяБота"}`.

### Свой домен

**Settings → Networking → Custom Domain** → добавить, например, `app.orbita.uz` и прописать CNAME у регистратора. Затем в Variables указать `APP_URL=https://app.orbita.uz`. Он нужен, чтобы ссылки-приглашения и кнопки в боте вели на ваш домен.

## Локальный запуск

```bash
npm install
DATABASE_URL=postgres://... BOT_TOKEN=... npm start
# без Telegram, только для проверки:
DATABASE_URL=postgres://... npm run dev   # появится «Тестовый вход»
```

## Переменные

| Переменная | Что это |
|---|---|
| `DATABASE_URL` | Подключение к PostgreSQL (Railway даёт сам) |
| `BOT_TOKEN` | Токен Telegram-бота от @BotFather |
| `APP_URL` | Адрес сайта. По умолчанию берётся `RAILWAY_PUBLIC_DOMAIN` |
| `APP_TZ` | Часовой пояс сводок и сроков, по умолчанию `Asia/Tashkent` |
| `DEV_LOGIN` | `1` включает тестовый вход без Telegram. На рабочем сервере не включать |

## Устройство

```
src/server.js   API, вход, приглашения, раздача интерфейса
src/logic.js    права, уведомления, сводки, напоминания (проверка раз в 30 с)
src/tg.js       Telegram-бот (long polling), вход через бота, кнопка «Выполнено»
src/db.js       подключение и схема базы
src/time.js     даты по часовому поясу
public/         интерфейс (index.html + app.js)
```

Бот работает в режиме long polling, поэтому сервис должен быть запущен **в одном экземпляре**. В Railway так по умолчанию.
