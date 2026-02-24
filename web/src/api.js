const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_BASE) ||
  "https://joker-platform.onrender.com";

async function request(path, { method = "GET", token, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // ზოგჯერ API 200-ზე ცარიელ ბოდსაც აბრუნებს - უსაფრთხოდ ვამუშავებთ
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text || null;
  }

  if (!res.ok) {
    const msg = data?.error || data?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

const api = {
  base: API_BASE,

  register(payload) {
    return request("/auth/register", { method: "POST", body: payload });
  },
  login(payload) {
    return request("/auth/login", { method: "POST", body: payload });
  },
  me(token) {
    return request("/me", { token });
  },

  // Leaderboard endpoints თუ ჯერ არ გაქვს — დროებით mock-ს დავტოვებთ Leaderboard.jsx-ში
  leaderboardWins(year) {
    return request(`/leaderboard/wins?year=${encodeURIComponent(year)}`);
  },
  leaderboardEarned(year) {
    return request(`/leaderboard/earned?year=${encodeURIComponent(year)}`);
  },
};

export default api;
