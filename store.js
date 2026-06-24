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

// ISO-weeknummer (maandag-start), bv "2026-W25"
function weekKey(d = new Date()) {
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const wk = Math.ceil(((dt - yearStart) / 86400000 + 1) / 7);
  return dt.getUTCFullYear() + "-W" + String(wk).padStart(2, "0");
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
    await pool.query(`
      CREATE TABLE IF NOT EXISTS weekly (
        user_id TEXT NOT NULL,
        week    TEXT NOT NULL,
        name    TEXT NOT NULL,
        total   INTEGER NOT NULL,
        PRIMARY KEY (user_id, week)
      )`);
    // blijvende tune-data (golfvorm + correctie) voor model-training
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tune (
        id   SERIAL PRIMARY KEY,
        at   BIGINT NOT NULL,
        data JSONB NOT NULL
      )`);
  }

  async function saveTune(rec) {
    await pool.query(`INSERT INTO tune (at, data) VALUES ($1, $2)`, [rec.at || Date.now(), rec]);
  }
  async function getTune(limit) {
    const r = await pool.query(`SELECT data FROM tune ORDER BY at DESC LIMIT $1`, [limit || 1000]);
    return r.rows.map((x) => x.data);
  }
  async function countTune() {
    const r = await pool.query(`SELECT COUNT(*)::int AS c FROM tune`);
    return r.rows[0].c;
  }

  // tel reps op bij het week-totaal van deze gebruiker
  async function addWeekly(userId, name, reps) {
    name = cleanName(name);
    await pool.query(
      `INSERT INTO weekly (user_id, week, name, total)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id, week) DO UPDATE
         SET total = weekly.total + EXCLUDED.total, name = EXCLUDED.name`,
      [userId, weekKey(), name, reps]
    );
  }

  async function topWeekly(limit) {
    const r = await pool.query(
      `SELECT name, total FROM weekly WHERE week=$1
       ORDER BY total DESC LIMIT $2`,
      [weekKey(), limit]
    );
    return r.rows.map((row, i) => ({ rank: i + 1, name: row.name, value: row.total }));
  }

  async function rankWeekly(userId) {
    const r = await pool.query(
      `SELECT rank, total FROM (
         SELECT user_id, total, RANK() OVER (ORDER BY total DESC) AS rank
         FROM weekly WHERE week=$1
       ) t WHERE user_id=$2`,
      [weekKey(), userId]
    );
    if (r.rows.length === 0) return { rank: null, value: null };
    return { rank: Number(r.rows[0].rank), value: r.rows[0].total };
  }

  async function totalWeekly() {
    const r = await pool.query(`SELECT COUNT(*)::int c FROM weekly WHERE week=$1`, [weekKey()]);
    return r.rows[0].c;
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

  return { kind: "postgres", init, submit, top, total, rankOf, addWeekly, topWeekly, rankWeekly, totalWeekly, saveTune, getTune, countTune };
}

/* ------------------------------- JSON -------------------------------- */
function jsonStore() {
  const DATA_DIR = process.env.DATA_DIR || __dirname;
  const DATA_PATH = path.join(DATA_DIR, "data.json");
  let db = { scores: {}, weekly: {} };
  try {
    db = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
    if (!db.scores) db.scores = {};
    if (!db.weekly) db.weekly = {};
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
  function weekEntries() {
    const wk = weekKey();
    return Object.values(db.weekly)
      .filter((w) => w.week === wk)
      .sort((a, b) => b.total - a.total);
  }
  async function addWeekly(userId, name, reps) {
    name = cleanName(name);
    const wk = weekKey();
    const key = `${userId}|${wk}`;
    const ex = db.weekly[key];
    if (ex) { ex.total += reps; ex.name = name; }
    else { db.weekly[key] = { userId, week: wk, name, total: reps }; }
    save();
  }
  async function topWeekly(limit) {
    return weekEntries().slice(0, limit).map((w, i) => ({ rank: i + 1, name: w.name, value: w.total }));
  }
  async function rankWeekly(userId) {
    const list = weekEntries();
    for (let i = 0; i < list.length; i++) {
      if (list[i].userId === userId) return { rank: i + 1, value: list[i].total };
    }
    return { rank: null, value: null };
  }
  async function totalWeekly() { return weekEntries().length; }

  const _tune = [];
  async function saveTune(rec) { _tune.unshift(rec); }
  async function getTune(limit) { return _tune.slice(0, limit || 1000); }
  async function countTune() { return _tune.length; }
  return { kind: "json", init, submit, top, total, rankOf, addWeekly, topWeekly, rankWeekly, totalWeekly, saveTune, getTune, countTune };
}

module.exports = {
  cleanName,
  create: () => (DATABASE_URL ? pgStore() : jsonStore()),
};
