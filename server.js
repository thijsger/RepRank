// RepRank backend — online ranglijst per oefening.
// Scores: Postgres (DATABASE_URL) of lokaal JSON-bestand. Tuning/debug-telemetrie
// blijft in het geheugen (transient).

const express = require("express");
const path = require("path");
const storage = require("./store");
const { detectReps } = require("./detect");

const app = express();
// Garmin-vriendelijk: geen etag (voorkomt lege 304-antwoorden) en geen
// compressie/transform (Cloudflare gzip breekt de Garmin JSON-parser -> -400).
app.set("etag", false);
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store, no-transform");
  next();
});
app.use(express.json({ limit: "64kb" }));
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

    // ANTI-CHEAT: bij rep-oefeningen moet een sensor-golfvorm mee, en het
    // geclaimde aantal mag niet ver boven wat we in het signaal detecteren.
    // (plank is tijd, geen reps -> niet via deze weg te valideren)
    if (exercise !== "plank") {
      const b = req.body;
      const wf = { rx: b.rx, ry: b.ry, rz: b.rz, ax: b.ax, ay: b.ay, az: b.az };
      const useGyro = b.gyro === true || b.gyro === 1;
      const detected = detectReps(wf, useGyro);
      if (detected < 0) {
        return res.status(400).json({ error: "geen bewijs", code: "no_proof" });
      }
      // ruime tolerantie: de server-detectie is grof (gedecimeerde golfvorm),
      // dus alleen duidelijke inflatie (bv. 999 zonder echte beweging) weigeren.
      const allowed = Math.round(detected * 2.5) + 12;
      if (value > allowed) {
        return res.status(400).json({ error: "onaannemelijk", code: "implausible", detected });
      }
    }

    const result = await store.submit(userId, name, exercise, value);
    // week-totaal: tel reps op (plank is seconden, telt niet mee)
    if (exercise !== "plank") { await store.addWeekly(userId, name, value); }
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

// week-ranglijst: totaal reps deze week (alle rep-oefeningen samen)
app.get("/api/week", async (req, res) => {
  try {
    const userId = req.query.userId;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const top = await store.topWeekly(limit);
    let me = null;
    if (userId) {
      const r = await store.rankWeekly(userId);
      if (r.rank) me = { rank: r.rank, value: r.value };
    }
    res.json({ total: await store.totalWeekly(), top, me });
  } catch (e) {
    console.error("week fout:", e.message);
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
  const arr = (k) => (Array.isArray(b[k]) ? b[k].slice(0, 400).map((n) => Math.round(Number(n) || 0)) : []);
  tune.unshift({
    at: Date.now(), name: storage.cleanName(b.name),
    exercise: String(b.exercise || "?").slice(0, 20),
    auto: Number(b.auto) || 0, final: Number(b.final) || 0,
    rx: arr("rx"), ry: arr("ry"), rz: arr("rz"),
    ax: arr("ax"), ay: arr("ay"), az: arr("az"),
  });
  if (tune.length > 60) tune.length = 60;
  res.json({ ok: true });
});
app.get("/api/tune", (_req, res) => res.json(tune.slice(0, 30)));
app.post("/api/tune/clear", (_req, res) => { tune.length = 0; res.json({ ok: true }); });

app.post("/api/debug", (req, res) => {
  const b = req.body || {};
  const arr = (k) => (Array.isArray(b[k]) ? b[k].slice(0, 400).map((n) => Math.round(Number(n) || 0)) : []);
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

// ---- sensor-test: 4 signalen tegelijk (kanteling/accel/gyro/hr) ----
const sensortest = [];
app.post("/api/sensortest", (req, res) => {
  const b = req.body || {};
  const arr = (k) => (Array.isArray(b[k]) ? b[k].slice(0, 400).map((n) => Math.round(Number(n) || 0)) : []);
  sensortest.unshift({
    at: Date.now(), name: storage.cleanName(b.name), hasGyro: Number(b.hasGyro) || 0,
    tilt: arr("tilt"), accel: arr("accel"), gyro: arr("gyro"), hr: arr("hr"),
  });
  if (sensortest.length > 20) sensortest.length = 20;
  res.json({ ok: true });
});
app.get("/api/sensortest", (_req, res) => res.json(sensortest.slice(0, 10)));
app.post("/api/sensortest/clear", (_req, res) => { sensortest.length = 0; res.json({ ok: true }); });

// privacy policy (vereist voor Connect IQ Store)
app.get("/privacy", (_req, res) => res.sendFile(path.join(__dirname, "public", "privacy.html")));

app.get("/api/health", (_req, res) => res.json({ ok: true, store: store.kind }));

store.init().then(() => {
  app.listen(PORT, () => console.log(`RepRank backend (${store.kind}) op poort ${PORT}`));
}).catch((e) => {
  console.error("init fout:", e.message);
  process.exit(1);
});
