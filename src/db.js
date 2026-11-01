// База данных: подключение и создание таблиц
const { Pool, types } = require('pg');

// DATE и TIMESTAMP (без пояса) отдаём строками — все даты в приложении «местные»
types.setTypeParser(1082, v => v);
types.setTypeParser(1114, v => v.slice(0, 16).replace(' ', 'T'));
types.setTypeParser(20, v => Number(v));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === '1' || /proxy\.rlwy\.net/.test(process.env.DATABASE_URL || '') ? { rejectUnauthorized: false } : undefined,
  max: 10,
});

const q = (text, params) => pool.query(text, params);
const one = async (text, params) => (await pool.query(text, params)).rows[0] || null;
const all = async (text, params) => (await pool.query(text, params)).rows;

async function tx(fn) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const r = await fn(c);
    await c.query('COMMIT');
    return r;
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  tg_id       BIGINT UNIQUE,
  name        TEXT NOT NULL,
  username    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS companies (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  plan        TEXT NOT NULL DEFAULT 'trial',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS depts (
  id          SERIAL PRIMARY KEY,
  company_id  INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#6F8BFF',
  UNIQUE (company_id, name)
);

CREATE TABLE IF NOT EXISTS members (
  id          SERIAL PRIMARY KEY,
  company_id  INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL,
  dept_id     INT REFERENCES depts(id) ON DELETE SET NULL,
  title       TEXT NOT NULL DEFAULT '',
  boss_id     INT REFERENCES members(id) ON DELETE SET NULL,
  active      BOOLEAN NOT NULL DEFAULT true,
  settings    JSONB NOT NULL DEFAULT '{"tg":true,"morning":"08:00","evening":"21:00","before":"2","onAssign":true,"onDone":true}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id)
);

CREATE TABLE IF NOT EXISTS invites (
  code        TEXT PRIMARY KEY,
  company_id  INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'worker',
  dept_id     INT REFERENCES depts(id) ON DELETE SET NULL,
  title       TEXT NOT NULL DEFAULT '',
  boss_id     INT REFERENCES members(id) ON DELETE SET NULL,
  created_by  INT REFERENCES members(id) ON DELETE SET NULL,
  used_by     INT REFERENCES members(id) ON DELETE SET NULL,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT now() + interval '14 days',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
  id          SERIAL PRIMARY KEY,
  company_id  INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  descr       TEXT NOT NULL DEFAULT '',
  assignee_id INT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  author_id   INT REFERENCES members(id) ON DELETE SET NULL,
  priority    TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high','medium','low')),
  status      TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','progress','review','done')),
  created_on  DATE NOT NULL,
  due         DATE NOT NULL,
  remind_at   TIMESTAMP,
  remind_sent BOOLEAN NOT NULL DEFAULT false,
  before_sent BOOLEAN NOT NULL DEFAULT false,
  done_on     DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tasks_company ON tasks(company_id);
CREATE INDEX IF NOT EXISTS tasks_assignee ON tasks(assignee_id);

CREATE TABLE IF NOT EXISTS comments (
  id          SERIAL PRIMARY KEY,
  task_id     INT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  member_id   INT REFERENCES members(id) ON DELETE SET NULL,
  text        TEXT NOT NULL,
  at          TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS plan_items (
  id          SERIAL PRIMARY KEY,
  member_id   INT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  day         DATE NOT NULL,
  text        TEXT NOT NULL,
  done        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS plan_member_day ON plan_items(member_id, day);

CREATE TABLE IF NOT EXISTS habits (
  id          SERIAL PRIMARY KEY,
  member_id   INT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS habit_marks (
  habit_id    INT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  day         DATE NOT NULL,
  PRIMARY KEY (habit_id, day)
);

CREATE TABLE IF NOT EXISTS notifs (
  id          SERIAL PRIMARY KEY,
  member_id   INT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  text        TEXT NOT NULL,
  at          TIMESTAMP NOT NULL,
  read        BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS notifs_member ON notifs(member_id, id DESC);

CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_id   INT REFERENCES members(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS login_nonces (
  nonce       TEXT PRIMARY KEY,
  user_id     INT REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS login_tokens (
  token       TEXT PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sent_digests (
  member_id   INT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,
  day         DATE NOT NULL,
  PRIMARY KEY (member_id, kind, day)
);

CREATE TABLE IF NOT EXISTS kv (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL
);
`;

async function migrate() {
  await q(SCHEMA);
  await q(`ALTER TABLE login_nonces ADD COLUMN IF NOT EXISTS join_code TEXT`);
  for (const col of ["time TEXT", "note TEXT NOT NULL DEFAULT ''", "series_id TEXT", "repeat TEXT", "remind BOOLEAN NOT NULL DEFAULT false", "reminded BOOLEAN NOT NULL DEFAULT false", "important BOOLEAN NOT NULL DEFAULT false"])
    await q(`ALTER TABLE plan_items ADD COLUMN IF NOT EXISTS ${col}`);
  for (const col of ["note TEXT NOT NULL DEFAULT ''", "wdays TEXT NOT NULL DEFAULT '0123456'", "start_on DATE", "until DATE", "time TEXT", "remind BOOLEAN NOT NULL DEFAULT false", "last_reminded DATE"])
    await q(`ALTER TABLE habits ADD COLUMN IF NOT EXISTS ${col}`);
  // планы и привычки принадлежат человеку (user), а не компании — общие во всех его компаниях
  for (const t of ['plan_items', 'habits']) {
    await q(`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(id) ON DELETE CASCADE`);
    await q(`ALTER TABLE ${t} ALTER COLUMN member_id DROP NOT NULL`);
    await q(`UPDATE ${t} x SET user_id = m.user_id FROM members m WHERE m.id = x.member_id AND x.user_id IS NULL`);
    await q(`CREATE INDEX IF NOT EXISTS ${t}_user ON ${t}(user_id)`);
  }
  // объединить одинаковые привычки из разных компаний (отметки переносятся)
  await q(`INSERT INTO habit_marks (habit_id, day)
           SELECT k.keep, hm.day FROM habit_marks hm JOIN habits h ON h.id = hm.habit_id
           JOIN (SELECT user_id, lower(name) AS n, min(id) AS keep FROM habits GROUP BY user_id, lower(name)) k ON k.user_id = h.user_id AND k.n = lower(h.name)
           WHERE h.id <> k.keep ON CONFLICT DO NOTHING`);
  await q(`DELETE FROM habits h USING habits h2 WHERE h.user_id = h2.user_id AND lower(h.name) = lower(h2.name) AND h.id > h2.id`);
  await q(`DELETE FROM plan_items p USING plan_items p2 WHERE p.user_id = p2.user_id AND p.day = p2.day AND p.text = p2.text
           AND p.time IS NOT DISTINCT FROM p2.time AND p.id > p2.id`);
  await q(`ALTER TABLE members DROP CONSTRAINT IF EXISTS members_role_check`);
  await q(`ALTER TABLE members ADD CONSTRAINT members_role_check CHECK (role IN ('owner','founder','director','manager','worker'))`);
}

module.exports = { pool, q, one, all, tx, migrate };
