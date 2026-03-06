import crypto from "crypto";

export function randCode6() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function sha256(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}
