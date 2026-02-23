import React, { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL;

async function api(path, { token, method = "GET", body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw data;
  return data;
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [me, setMe] = useState(null);
  const [mode, setMode] = useState(token ? "profile" : "login");
  const [form, setForm] = useState({ email: "", username: "", password: "" });
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!token) return;
    api("/me", { token })
      .then(setMe)
      .catch(() => {
        localStorage.removeItem("token");
        setToken("");
        setMode("login");
      });
  }, [token]);

  async function login() {
    const out = await api("/auth/login", {
      method: "POST",
      body: { email: form.email, password: form.password },
    });
    localStorage.setItem("token", out.token);
    setToken(out.token);
    setMode("profile");
  }

  async function register() {
    const out = await api("/auth/register", {
      method: "POST",
      body: { email: form.email, username: form.username, password: form.password },
    });
    localStorage.setItem("token", out.token);
    setToken(out.token);
    setMode("profile");
  }

  function logout() {
    localStorage.removeItem("token");
    setToken("");
    setMe(null);
    setMode("login");
  }

  if (!API) {
    return <div style={{ padding: 20 }}>Set VITE_API_URL in Render.</div>;
  }

  return (
    <div style={{ maxWidth: 420, margin: "20px auto", fontFamily: "system-ui" }}>
      <h2>Card Games</h2>
<div style={{ fontSize: 12, opacity: 0.7 }}>API: {API || "MISSING"}</div>
      
      {mode !== "profile" && (
        <div style={{ display: "grid", gap: 8 }}>
          <input placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} />

          {mode === "register" && (
            <input placeholder="Username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })} />
          )}

          <input type="password"
            placeholder="Password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} />

          {mode === "login" ? (
            <>
              <button onClick={login}>Login</button>
              <button onClick={() => setMode("register")}>Register</button>
            </>
          ) : (
            <>
              <button onClick={register}>Create account</button>
              <button onClick={() => setMode("login")}>Back to login</button>
            </>
          )}
        </div>
      )}

      {mode === "profile" && me && (
        <div style={{ marginTop: 20 }}>
          <div><b>{me.username}</b></div>
          <div>Points: {me.points}</div>
          <div>Crystals: {me.crystals}</div>
          <button onClick={logout}>Logout</button>
        </div>
      )}
    </div>
  );
                                    }
