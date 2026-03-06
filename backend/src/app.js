import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth.routes.js";
import meRoutes from "./routes/me.routes.js";
import penaltiesRoutes from "./routes/penalties.routes.js";
import verifyRoutes from "./routes/verify.routes.js";
import adsRoutes from "./routes/ads.routes.js";
import matchmakingRoutes from "./routes/matchmaking.routes.js";
import gameRoutes from "./routes/game.routes.js";
import leaderboardRoutes from "./routes/leaderboard.routes.js";
import shopRoutes from "./routes/shop.routes.js";
import socialRoutes from "./routes/social.routes.js";
import roomsRoutes from "./routes/rooms.routes.js";
import matchesRoutes from "./routes/matches.routes.js";

const app = express();

app.use(cors({
  origin: [
    "https://joker-platform-1.onrender.com",
    "http://localhost:5173"
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json());

app.get("/health", (_, res) => res.json({ ok: true }));

// Routers keep the original absolute paths (e.g. /auth/login, /ads/points/claim)
app.use(authRoutes);
app.use(meRoutes);
app.use(penaltiesRoutes);
app.use(verifyRoutes);
app.use(adsRoutes);
app.use(matchmakingRoutes);
app.use(gameRoutes);
app.use(leaderboardRoutes);
app.use(shopRoutes);
app.use(socialRoutes);
app.use(roomsRoutes);
app.use(matchesRoutes);

export default app;
