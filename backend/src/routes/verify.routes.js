import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { nowISO, todayISO } from "../utils/time.js";
import { randCode6, sha256 } from "../utils/crypto.js";
import { clientIp, userAgent } from "../utils/request.js";

const router = Router();

const NODE_ENV = process.env.NODE_ENV || "development";

/* ============================= */

// DEV-ში code დაბრუნდება response-ში; PROD-ში ჩაანაცვლებ provider-ით
router.post("/verify/request-email", requireAuth, async (req, res) => {
  const userR = await pool.query("SELECT email FROM users WHERE id=$1", [
    req.user.id,
  ]);
  const email = userR.rows[0]?.email;
  if (!email) return res.status(400).json({ error: "NO_EMAIL" });

  const code = randCode6();
  const id = uuidv4();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await pool.query(
    "INSERT INTO verifications (id,user_id,kind,target,code_hash,expires_at) VALUES ($1,$2,'email',$3,$4,$5)",
    [id, req.user.id, email, sha256(code), expiresAt]
  );

  return res.json({
    ok: true,
    expiresAt,
    ...(NODE_ENV !== "production" ? { devCode: code } : {}),
  });
});

router.post("/verify/confirm-email", requireAuth, async (req, res) => {
  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: "MISSING_CODE" });

  const v = await pool.query(
    `
    SELECT * FROM verifications
    WHERE user_id=$1 AND kind='email' AND used=FALSE AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [req.user.id]
  );
  if (v.rowCount === 0)
    return res.status(400).json({ error: "NO_ACTIVE_VERIFICATION" });

  const row = v.rows[0];
  if (sha256(String(code)) !== row.code_hash)
    return res.status(400).json({ error: "BAD_CODE" });

  await pool.query("UPDATE verifications SET used=TRUE WHERE id=$1", [row.id]);
  await pool.query("UPDATE users SET email_verified=TRUE WHERE id=$1", [
    req.user.id,
  ]);

  return res.json({ ok: true });
});

router.post("/verify/request-phone", requireAuth, async (req, res) => {
  const { phone } = req.body || {};
  if (!phone) return res.status(400).json({ error: "MISSING_PHONE" });

  await pool.query("UPDATE users SET phone=$2, phone_verified=FALSE WHERE id=$1", [
    req.user.id,
    phone,
  ]);

  const code = randCode6();
  const id = uuidv4();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await pool.query(
    "INSERT INTO verifications (id,user_id,kind,target,code_hash,expires_at) VALUES ($1,$2,'phone',$3,$4,$5)",
    [id, req.user.id, phone, sha256(code), expiresAt]
  );

  return res.json({
    ok: true,
    expiresAt,
    ...(NODE_ENV !== "production" ? { devCode: code } : {}),
  });
});

router.post("/verify/confirm-phone", requireAuth, async (req, res) => {
  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: "MISSING_CODE" });

  const v = await pool.query(
    `
    SELECT * FROM verifications
    WHERE user_id=$1 AND kind='phone' AND used=FALSE AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [req.user.id]
  );
  if (v.rowCount === 0)
    return res.status(400).json({ error: "NO_ACTIVE_VERIFICATION" });

  const row = v.rows[0];
  if (sha256(String(code)) !== row.code_hash)
    return res.status(400).json({ error: "BAD_CODE" });

  await pool.query("UPDATE verifications SET used=TRUE WHERE id=$1", [row.id]);
  await pool.query("UPDATE users SET phone_verified=TRUE WHERE id=$1", [
    req.user.id,
  ]);

  return res.json({ ok: true });
});

/* ============================= */

export default router;
