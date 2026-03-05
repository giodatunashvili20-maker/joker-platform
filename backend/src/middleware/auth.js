import jwt from "jsonwebtoken";
import { pool } from "../db.js";

const JWT_SECRET = process.env.JWT_SECRET || "change_me";

export function signToken(userId) {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: "7d" });
}

export function requireAuth(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: "NO_TOKEN" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: "BAD_TOKEN" });
  }
}

export async function requireNotBanned(req, res, next) {
  const r = await pool.query("SELECT ban_until FROM users WHERE id=$1", [
    req.user.id,
  ]);
  const banUntil = r.rows[0]?.ban_until;
  if (banUntil && new Date(banUntil).getTime() > Date.now()) {
    return res.status(403).json({ error: "BANNED", banUntil });
  }
  return next();
}
