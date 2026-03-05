import app from "./app.js";
import { initDb } from "./db/initDb.js";

const PORT = process.env.PORT || 10000;

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`API listening on :${PORT}`);
    });
  })
  .catch((err) => {
    console.error("DB init failed:", err);
    process.exit(1);
  });
