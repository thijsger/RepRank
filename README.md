# RepRank backend

Online ranglijst + tuning-data voor de RepRank Garmin-app.
Node + Express, opslag in één `data.json` (persistente schijf in productie).

## Lokaal draaien

```bash
npm install
PORT=3100 node server.js
```

Webpagina (ranglijst): http://localhost:3100

## Endpoints

- `POST /api/score`          — score insturen (bewaart alleen PB-verbetering)
- `GET  /api/leaderboard?exercise=&userId=` — ranglijst per oefening
- `GET  /api/leaderboards`   — alle ranglijsten (voor de webpagina)
- `POST /api/tune`           — telsessie (golfvorm + auto + correctie) voor tuning
- `GET  /api/tune`           — tuning-data uitlezen
- `GET  /api/health`

## Deployen op Render (gratis)

1. Maak een git-repo van deze map en push naar GitHub.
2. Render.com → New → Blueprint → kies de repo. `render.yaml` doet de rest
   (Node web service + 1 GB persistente schijf op `/data`).
3. Na deploy krijg je een URL zoals `https://reprank.onrender.com`.
4. Zet die URL in de Garmin-app: `source/Store.mc` → `getServerUrl()` → `dev`,
   en herbouw. (Of laat 'm via app-instellingen in Garmin Connect zetten.)

> Gratis Render-service slaapt na 15 min inactiviteit; eerste request daarna
> duurt ~30s. Voor een altijd-aan ranglijst: betaald plan of een ping-service.
