const BASE =
  import.meta.env.VITE_API_BASE || "https://joker-platform.onrender.com";

export async function api(path, opts = {}) {
  const {
    method = "GET",
    body,
    auth = false,
    headers = {},
  } = opts;

  const h = { ...headers };

  // JSON body
  if (body !== undefined) {
    h["Content-Type"] = "application/json";
  }

  // Auth token
  if (auth) {
    const token = localStorage.getItem("token");
    if (token) h["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: h,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Try parse json/text
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg =
      (data && data.error) ||
      (typeof data === "string" ? data : null) ||
      `HTTP_${res.status}`;
    throw new Error(msg);
  }

  return data;
}

// default export-იც რომ გქონდეს (შენს Home.jsx-ში import api from ...)
export default api;
