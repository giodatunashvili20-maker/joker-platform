import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

/* ============================= */

router.get("/shop/items", requireAuth, async (_req, res) => {
  const r = await pool.query(
    "SELECT id,type,name,description,price_crystals,asset_url FROM shop_items WHERE is_active=TRUE ORDER BY created_at DESC"
  );
  return res.json({ items: r.rows });
});

router.get("/shop/inventory", requireAuth, async (req, res) => {
  const r = await pool.query(
    `
    SELECT si.id, si.type, si.name, si.description, si.asset_url, ui.acquired_at
    FROM user_inventory ui
    JOIN shop_items si ON si.id = ui.item_id
    WHERE ui.user_id=$1
    ORDER BY ui.acquired_at DESC
    `,
    [req.user.id]
  );
  return res.json({ items: r.rows });
});

router.post("/shop/buy", requireAuth, async (req, res) => {
  const { itemId } = req.body || {};
  if (!itemId) return res.status(400).json({ error: "MISSING_ITEM_ID" });

  const itemR = await pool.query(
    "SELECT id, price_crystals, is_active FROM shop_items WHERE id=$1",
    [itemId]
  );
  if (itemR.rowCount === 0) return res.status(404).json({ error: "ITEM_NOT_FOUND" });
  if (!itemR.rows[0].is_active) return res.status(400).json({ error: "ITEM_INACTIVE" });

  const price = Number(itemR.rows[0].price_crystals || 0);

  const ur = await pool.query("SELECT crystals FROM users WHERE id=$1", [req.user.id]);
  const crystals = Number(ur.rows[0]?.crystals || 0);
  if (crystals < price) return res.status(400).json({ error: "NOT_ENOUGH_CRYSTALS" });

  const own = await pool.query(
    "SELECT 1 FROM user_inventory WHERE user_id=$1 AND item_id=$2",
    [req.user.id, itemId]
  );
  if (own.rowCount) return res.status(409).json({ error: "ALREADY_OWNED" });

  await pool.query("UPDATE users SET crystals=crystals-$2 WHERE id=$1", [req.user.id, price]);
  await pool.query("INSERT INTO user_inventory (user_id,item_id) VALUES ($1,$2)", [req.user.id, itemId]);

  const me = await pool.query("SELECT crystals FROM users WHERE id=$1", [req.user.id]);
  return res.json({ ok: true, crystals: me.rows[0].crystals });
});

/* ============================= */

export default router;
