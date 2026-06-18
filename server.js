// RepRank backend — online ranglijst per oefening.
// Scores: Postgres (DATABASE_URL) of lokaal JSON-bestand. Tuning/debug-telemetrie
// blijft in het geheugen (transient).

const express = require("express");
const path = require("path");
const storage = require("./store");

const app = express();
app.use(express.json({ limit: "16kb" }));
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
const store = storage.create();

const EXERCISES = {
  pushups: { label: "Push-ups", unit: "reps" },
  squats: { label: "Squats", unit: "reps" },
  pullups: { label: "Pull-ups", unit: "reps" },
  plank: { label: "Plank", unit: "sec" },
  situps: { label: "Sit-ups", unit: "reps" },
};

// ---- scores / ranglijst ----
app.post("/api/score", async (req, res) => {
  try {
    const { userId, name, exercise } = req.body || {};
    const value = parseInt(req.body && req.body.value, 10);
    if (!userId || typeof userId !== "string" || userId.length > 40) {
      return res.status(400).json({ error: "userId ongeldig" });
    }
    if (!EXERCISES[exercise]) return res.status(400).json({ error: "onbekende oefening" });
    if (!Number.isFinite(value) || value <= 0 || value > 100000) {
      return res.status(400).json({ error: "value ongeldig" });
    }
    const result = await store.submit(userId, name, exercise, value);
    const r = await store.rankOf(exercise, userId);
    res.json({ ok: true, improved: result.improved, value: r.value, rank: r.rank, total: await store.total(exercise) });
  } catch (e) {
    console.error("score fout:", e.message);
    res.status(500).json({ error: "server" });
  }
});

app.get("/api/leaderboard", async (req, res) => {
  try {
    const exercise = req.query.exercise;
    if (!EXERCISES[exercise]) return res.status(400).json({ error: "onbekende oefening" });
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const userId = req.query.userId;
    const top = await store.top(exercise, limit);
    let me = null;
    if (userId) {
      const r = await store.rankOf(exercise, userId);
      if (r.rank) me = { rank: r.rank, value: r.value };
    }
    res.json({ exercise, unit: EXERCISES[exercise].unit, total: await store.total(exercise), top, me });
  } catch (e) {
    console.error("leaderboard fout:", e.message);
    res.status(500).json({ error: "server" });
  }
});

app.get("/api/leaderboards", async (_req, res) => {
  try {
    const out = {};
    for (const ex in EXERCISES) {
      out[ex] = { label: EXERCISES[ex].label, unit: EXERCISES[ex].unit, top: await store.top(ex, 20) };
    }
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: "server" });
  }
});

// ---- tuning / debug telemetrie (in-memory) ----
const tune = [];
const debug = [];

app.post("/api/tune", (req, res) => {
  const b = req.body || {};
  const arr = (k) => (Array.isArray(b[k]) ? b[k].slice(0, 300).map((n) => Math.round(Number(n) || 0)) : []);
  tune.unshift({
    at: Date.now(), name: storage.cleanName(b.name),
    exercise: String(b.exercise || "?").slice(0, 20),
    axis: Number(b.axis) || 0, auto: Number(b.auto) || 0, final: Number(b.final) || 0,
    hz: Number(b.hz) || 0, gx: arr("gx"), gy: arr("gy"), gz: arr("gz"),
  });
  if (tune.length > 60) tune.length = 60;
  res.json({ ok: true });
});
app.get("/api/tune", (_req, res) => res.json(tune.slice(0, 30)));
app.post("/api/tune/clear", (_req, res) => { tune.length = 0; res.json({ ok: true }); });

app.post("/api/debug", (req, res) => {
  const b = req.body || {};
  const arr = (k) => (Array.isArray(b[k]) ? b[k].slice(0, 300).map((n) => Math.round(Number(n) || 0)) : []);
  debug.unshift({
    at: Date.now(), name: storage.cleanName(b.name), exercise: String(b.exercise || "?").slice(0, 20),
    hz: Number(b.hz) || 0, samples: Number(b.samples) || 0, min: Number(b.min) || 0,
    max: Number(b.max) || 0, reps: Number(b.reps) || 0, s: arr("s"), gx: arr("gx"), gy: arr("gy"), gz: arr("gz"),
  });
  if (debug.length > 30) debug.length = 30;
  res.json({ ok: true });
});
app.get("/api/debug", (_req, res) => res.json(debug.slice(0, 10)));
app.post("/api/debug/clear", (_req, res) => { debug.length = 0; res.json({ ok: true }); });

app.get("/api/health", (_req, res) => res.json({ ok: true, store: store.kind }));

store.init().then(() => {
  app.listen(PORT, () => console.log(`RepRank backend (${store.kind}) op poort ${PORT}`));
}).catch((e) => {
  console.error("init fout:", e.message);
  process.exit(1);
});
