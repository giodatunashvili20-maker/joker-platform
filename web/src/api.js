const BASE =
  import.meta.env.VITE_API_BASE || "https://joker-platform.onrender.com";

export default async function api(path, opts = {}) {
  const {
    method = "GET",
    body,
    auth = false,
    headers = {},
    timeoutMs = 12000,
  } = opts;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const h = { "Content-Type": "application/json", ...headers };

    if (auth) {
      const token = localStorage.getItem("token");
      if (token) h.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: h,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }

    if (!res.ok) {
      const msg = data?.error || data?.message || `HTTP_${res.status}`;
      throw new Error(msg);
    }

    return data;
  } catch (e) {
    if (e?.name === "AbortError") {
      throw new Error("REQUEST_TIMEOUT");
    }
    throw e;
  } finally {
    clearTimeout(t);
  }
}
