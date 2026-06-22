// Server-side rep-detectie voor anti-cheat. Telt grofweg hoeveel reps er in de
// meegestuurde sensor-golfvorm zitten, zodat een verzonnen score (zonder echte
// beweging) geweigerd kan worden. Hoeft niet exact te matchen met het horloge —
// alleen genoeg om "999 zonder beweging" van "echt 50" te onderscheiden.

function absf(v) { return v < 0 ? -v : v; }

// accel-kanteling: één oscillatie per rep, meebewegende middellijn + as-keuze
function countAccelTilt(ax, ay, az) {
  const n = ax.length;
  if (n < 6) return 0;
  let tx = ax[0], ty = ay[0], tz = az[0];
  let gx = tx, gy = ty, gz = tz, sx = 0, sy = 0, sz = 0;
  let uA = -1, mid = 0, amp = 20, st = 0, last = -999, hm = false, reps = 0;
  const REFR = 4;
  for (let i = 0; i < n; i++) {
    tx = tx * 0.85 + ax[i] * 0.15; ty = ty * 0.85 + ay[i] * 0.15; tz = tz * 0.85 + az[i] * 0.15;
    gx = gx * 0.97 + tx * 0.03; gy = gy * 0.97 + ty * 0.03; gz = gz * 0.97 + tz * 0.03;
    sx = sx * 0.99 + absf(tx - gx) * 0.01; sy = sy * 0.99 + absf(ty - gy) * 0.01; sz = sz * 0.99 + absf(tz - gz) * 0.01;
    if (st === 0) {
      const b = (sx >= sy && sx >= sz) ? 0 : (sy >= sz ? 1 : 2);
      const bV = [sx, sy, sz][b], cV = uA < 0 ? -1 : [sx, sy, sz][uA];
      if (!hm || bV > cV * 1.2) { if (b !== uA) { uA = b; mid = b === 0 ? tx : (b === 1 ? ty : tz); amp = 20; hm = true; } }
    }
    const v = uA === 0 ? tx : (uA === 1 ? ty : tz);
    if (!hm) { mid = v; hm = true; }
    mid = mid * 0.94 + v * 0.06; const dev = absf(v - mid); amp = amp * 0.96 + dev * 0.04;
    let h = amp * 0.45; if (h < 12) h = 12;
    if (v > mid + h && st <= 0) st = 1;
    else if (v < mid - h && st === 1 && i - last >= REFR) { st = 0; reps++; last = i; }
  }
  return reps;
}

// gyro-richting: cyclus (+dan−) per rep
function countGyroDir(rx, ry, rz) {
  const n = rx.length;
  if (n < 6) return 0;
  function absum(s) { let t = 0; for (const v of s) t += absf(v); return t; }
  const sums = [absum(rx), absum(ry), absum(rz)];
  const dom = sums[2] >= sums[1] && sums[2] >= sums[0] ? rz : (sums[1] >= sums[0] ? ry : rx);
  let sm = 0, st = 0, last = -999, reps = 0;
  const REFR = 4;
  for (let i = 0; i < n; i++) {
    sm = sm * 0.65 + dom[i] * 0.35;
    if (sm > 10 && st <= 0) st = 1;
    else if (sm < -10 && st === 1 && i - last >= REFR) { st = 0; reps++; last = i; }
  }
  return reps;
}

// hoeveel reps zitten er plausibel in de golfvorm?
function detectReps(wf, useGyro) {
  const ax = wf.ax || [], ay = wf.ay || [], az = wf.az || [];
  const rx = wf.rx || [], ry = wf.ry || [], rz = wf.rz || [];
  if (ax.length < 6) return -1; // geen bruikbare golfvorm
  const a = countAccelTilt(ax, ay, az);
  if (!useGyro) return a;
  const g = countGyroDir(rx, ry, rz);
  return Math.max(a, g);
}

module.exports = { detectReps };
