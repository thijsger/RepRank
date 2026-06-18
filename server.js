// RepRank backend — online ranglijst per oefening.
// Opslag: één JSON-bestand (data.json). Simpel en zonder native deps; prima voor
// persoonlijk gebruik. Let op: op Render free is de schijf vluchtig — voor blijvende
// data later een persistent disk of een echte database (Postgres) gebruiken.

const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json({ limit: "16kb" }));
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
// In productie (Render) schrijven naar de blijvende schijf via DATA_DIR.
const DATA_DIR = process.env.DATA_DIR || __dirname;
const DATA_PATH = path.join(DATA_DIR, "data.json");

// Toegestane oefeningen + meeteenheid. plank = seconden (hoger = beter), rest = reps.
const EXERCISES = {
  pushups: { label: "Push-ups", unit: "reps" },
  squats: { label: "Squats", unit: "reps" },
  pullups: { label: "Pull-ups", unit: "reps" },
  plank: { label: "Plank", unit: "sec" },
  situps: { label: "Sit-ups", unit: "reps" },
};

// ---- opslag ----
let db = { scores: {} }; // key = `${userId}|${exercise}` -> {userId,name,exercise,value,updatedAt}
function load() {
  try {
    db = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
    if (!db.scores) db.scores = {};
  } catch {
    db = { scores: {} };
  }
}
let saveTimer = null;
function save() {
  // debounce schrijven
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      fs.writeFileSync(DATA_PATH, JSON.stringify(db));
    } catch (e) {
      console.error("save fout:", e.message);
    }
  }, 300);
}
load();

// ---- helpers ----
function cleanName(n) {
  return String(n || "Athlete").replace(/[^\p{L}\p{N}_\- ]/gu, "").trim().slice(0, 20) || "Athlete";
}
function entriesFor(exercise) {
  const out = [];
  for (const k in db.scores) {
    const s = db.scores[k];
    if (s.exercise === exercise) out.push(s);
  }
  out.sort((a, b) => b.value - a.value || a.updatedAt - b.updatedAt);
  return out;
}
function rankOf(exercise, userId) {
  const list = entriesFor(exercise);
  for (let i = 0; i < list.length; i++) {
    if (list[i].userId === userId) return { rank: i + 1, total: list.length, value: list[i].value };
  }
  return { rank: null, total: list.length, value: null };
}

// ---- API ----

// Score insturen (alleen opgeslagen als het je PB verbetert)
app.post("/api/score", (req, res) => {
  const { userId, name, exercise } = req.body || {};
  let value = parseInt(req.body && req.body.value, 10);
  if (!userId || typeof userId !== "string" || userId.length > 40) {
    return res.status(400).json({ error: "userId ongeldig" });
  }
  if (!EXERCISES[exercise]) {
    return res.status(400).json({ error: "onbekende oefening" });
  }
  if (!Number.isFinite(value) || value <= 0 || value > 100000) {
    return res.status(400).json({ error: "value ongeldig" });
  }
  const key = `${userId}|${exercise}`;
  const existing = db.scores[key];
  const display = cleanName(name);
  let improved = false;
  if (!existing || value > existing.value) {
    db.scores[key] = { userId, name: display, exercise, value, updatedAt: Date.now() };
    improved = true;
  } else if (existing.name !== display) {
    existing.name = display; // naam bijwerken zonder PB te wijzigen
  }
  // naam ook op andere oefeningen van deze user gelijktrekken
  for (const k in db.scores) {
    if (db.scores[k].userId === userId) db.scores[k].name = display;
  }
  save();
  const r = rankOf(exercise, userId);
  res.json({ ok: true, improved, value: r.value, rank: r.rank, total: r.total });
});

// Ranglijst per oefening (+ eigen positie als userId meegegeven)
app.get("/api/leaderboard", (req, res) => {
  const exercise = req.query.exercise;
  if (!EXERCISES[exercise]) return res.status(400).json({ error: "onbekende oefening" });
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const userId = req.query.userId;
  const list = entriesFor(exercise);
  const top = list.slice(0, limit).map((s, i) => ({ rank: i + 1, name: s.name, value: s.value }));
  let me = null;
  if (userId) {
    const r = rankOf(exercise, userId);
    if (r.rank) me = { rank: r.rank, value: r.value };
  }
  res.json({ exercise, unit: EXERCISES[exercise].unit, total: list.length, top, me });
});

// Alle ranglijsten in één keer (voor de webpagina)
app.get("/api/leaderboards", (_req, res) => {
  const out = {};
  for (const ex in EXERCISES) {
    out[ex] = {
      label: EXERCISES[ex].label,
      unit: EXERCISES[ex].unit,
      top: entriesFor(ex).slice(0, 20).map((s, i) => ({ rank: i + 1, name: s.name, value: s.value })),
    };
  }
  res.json(out);
});

// ---- debug: sensor-golfvorm vanaf het horloge ontvangen + uitlezen ----
app.post("/api/debug", (req, res) => {
  const b = req.body || {};
  const entry = {
    at: Date.now(),
    name: cleanName(b.name),
    exercise: String(b.exercise || "?").slice(0, 20),
    hz: Number(b.hz) || 0,
    samples: Number(b.samples) || 0,
    min: Number(b.min) || 0,
    max: Number(b.max) || 0,
    reps: Number(b.reps) || 0,
    s: Array.isArray(b.s) ? b.s.slice(0, 300).map((n) => Math.round(Number(n) || 0)) : [],
    gx: Array.isArray(b.gx) ? b.gx.slice(0, 300).map((n) => Math.round(Number(n) || 0)) : [],
    gy: Array.isArray(b.gy) ? b.gy.slice(0, 300).map((n) => Math.round(Number(n) || 0)) : [],
    gz: Array.isArray(b.gz) ? b.gz.slice(0, 300).map((n) => Math.round(Number(n) || 0)) : [],
  };
  if (!db.debug) db.debug = [];
  db.debug.unshift(entry);
  db.debug = db.debug.slice(0, 30);
  save();
  res.json({ ok: true });
});

app.get("/api/debug", (_req, res) => {
  res.json((db.debug || []).slice(0, 10));
});

app.post("/api/debug/clear", (_req, res) => {
  db.debug = [];
  save();
  res.json({ ok: true });
});

// ---- tune: echte telsessies (golfvorm + auto-telling + correctie) ----
app.post("/api/tune", (req, res) => {
  const b = req.body || {};
  const arr = (k) => (Array.isArray(b[k]) ? b[k].slice(0, 300).map((n) => Math.round(Number(n) || 0)) : []);
  const entry = {
    at: Date.now(),
    name: cleanName(b.name),
    exercise: String(b.exercise || "?").slice(0, 20),
    axis: Number(b.axis) || 0,
    auto: Number(b.auto) || 0, // wat de teller vond
    final: Number(b.final) || 0, // na correctie van de gebruiker
    hz: Number(b.hz) || 0,
    gx: arr("gx"),
    gy: arr("gy"),
    gz: arr("gz"),
  };
  if (!db.tune) db.tune = [];
  db.tune.unshift(entry);
  db.tune = db.tune.slice(0, 60);
  save();
  res.json({ ok: true });
});

app.get("/api/tune", (_req, res) => res.json((db.tune || []).slice(0, 30)));

app.post("/api/tune/clear", (_req, res) => {
  db.tune = [];
  save();
  res.json({ ok: true });
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`RepRank backend op poort ${PORT}`));
