// Opslag voor scores. Gebruikt Postgres als DATABASE_URL gezet is (blijvend op
// Render/Neon), anders een lokaal JSON-bestand (handig voor ontwikkelen).
const fs = require("fs");
const path = require("path");

const DATABASE_URL = process.env.DATABASE_URL;

function cleanName(n) {
  return String(n || "Athlete")
    .replace(/[^\p{L}\p{N}_\- ]/gu, "")
    .trim()
    .slice(0, 20) || "Athlete";
}

/* ----------------------------- Postgres ----------------------------- */
function pgStore() {
  const { Pool } = require("pg");
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  async function init() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS scores (
        user_id    TEXT NOT NULL,
        exercise   TEXT NOT NULL,
        name       TEXT NOT NULL,
        value      INTEGER NOT NULL,
        updated_at BIGINT NOT NULL,
        PRIMARY KEY (user_id, exercise)
      )`);
  }

  // bewaart alleen als het een verbetering is; geeft {improved, value}
  async function submit(userId, name, exercise, value) {
    name = cleanName(name);
    const r = await pool.query(
      `INSERT INTO scores (user_id, exercise, name, value, updated_at)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (user_id, exercise) DO UPDATE
         SET value = GREATEST(scores.value, EXCLUDED.value),
             name  = EXCLUDED.name,
             updated_at = CASE WHEN EXCLUDED.value > scores.value
                               THEN EXCLUDED.updated_at ELSE scores.updated_at END
       RETURNING value, (xmax = 0) AS inserted`,
      [userId, exercise, name, value, Date.now()]
    );
    // naam op alle oefeningen van deze user gelijktrekken
    await pool.query(`UPDATE scores SET name=$2 WHERE user_id=$1`, [userId, name]);
    const newValue = r.rows[0].value;
    const improved = r.rows[0].inserted || newValue === value;
    return { improved: improved && value >= newValue, value: newValue };
  }

  async function top(exercise, limit) {
    const r = await pool.query(
      `SELECT name, value FROM scores WHERE exercise=$1
       ORDER BY value DESC, updated_at ASC LIMIT $2`,
      [exercise, limit]
    );
    return r.rows.map((row, i) => ({ rank: i + 1, name: row.name, value: row.value }));
  }

  async function total(exercise) {
    const r = await pool.query(`SELECT COUNT(*)::int AS c FROM scores WHERE exercise=$1`, [exercise]);
    return r.rows[0].c;
  }

  async function rankOf(exercise, userId) {
    const r = await pool.query(
      `SELECT rank, value FROM (
         SELECT user_id, value,
                RANK() OVER (ORDER BY value DESC) AS rank
         FROM scores WHERE exercise=$1
       ) t WHERE user_id=$2`,
      [exercise, userId]
    );
    if (r.rows.length === 0) return { rank: null, value: null };
    return { rank: Number(r.rows[0].rank), value: r.rows[0].value };
  }

  return { kind: "postgres", init, submit, top, total, rankOf };
}

/* ------------------------------- JSON -------------------------------- */
function jsonStore() {
  const DATA_DIR = process.env.DATA_DIR || __dirname;
  const DATA_PATH = path.join(DATA_DIR, "data.json");
  let db = { scores: {} };
  try {
    db = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
    if (!db.scores) db.scores = {};
  } catch {}
  let timer = null;
  function save() {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      try { fs.writeFileSync(DATA_PATH, JSON.stringify(db)); } catch {}
    }, 300);
  }
  function entries(exercise) {
    return Object.values(db.scores)
      .filter((s) => s.exercise === exercise)
      .sort((a, b) => b.value - a.value || a.updatedAt - b.updatedAt);
  }

  async function init() {}
  async function submit(userId, name, exercise, value) {
    name = cleanName(name);
    const key = `${userId}|${exercise}`;
    const existing = db.scores[key];
    let improved = false;
    if (!existing || value > existing.value) {
      db.scores[key] = { userId, name, exercise, value, updatedAt: Date.now() };
      improved = true;
    }
    for (const k in db.scores) if (db.scores[k].userId === userId) db.scores[k].name = name;
    save();
    return { improved, value: db.scores[key].value };
  }
  async function top(exercise, limit) {
    return entries(exercise).slice(0, limit).map((s, i) => ({ rank: i + 1, name: s.name, value: s.value }));
  }
  async function total(exercise) {
    return entries(exercise).length;
  }
  async function rankOf(exercise, userId) {
    const list = entries(exercise);
    for (let i = 0; i < list.length; i++) {
      if (list[i].userId === userId) return { rank: i + 1, value: list[i].value };
    }
    return { rank: null, value: null };
  }
  return { kind: "json", init, submit, top, total, rankOf };
}

module.exports = {
  cleanName,
  create: () => (DATABASE_URL ? pgStore() : jsonStore()),
};
