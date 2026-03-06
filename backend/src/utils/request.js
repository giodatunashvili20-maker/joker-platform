export function clientIp(req) {
  return (
    req.headers["x-forwarded-for"]?.toString().split(",")[0] ||
    req.socket.remoteAddress ||
    ""
  ).trim();
}

export function userAgent(req) {
  return String(req.headers["user-agent"] || "");
}
