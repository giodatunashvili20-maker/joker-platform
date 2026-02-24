import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";

export default function Login() {
  const Hr = useAuth(); // სპეციალურად Hr დავარქვი რომ დავინახოთ რას აბრუნებს
  const nav = useNavigate();
  const loc = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    try {
      // debug
      if (!Hr || typeof Hr.login !== "function") {
        throw new Error("Hr.login is not a function (AuthProvider/useAuth არ მუშაობს სწორად)");
      }

      await Hr.login(email.trim(), password);

      const go = loc.state?.from || "/";
      nav(go, { replace: true });
    } catch (e2) {
      setErr(e2?.message || "Login failed");
    }
  }

  const tokenExists = !!localStorage.getItem("token");

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: 16 }}>
      <h2 style={{ margin: "10px 0" }}>Login</h2>



      <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "grid", gap: 6 }}>
          <label style={{ color: "white", opacity: 0.9 }}>Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email"
            style={{ padding: 12, borderRadius: 12, border: "1px solid #ccc" }}
          />
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <label style={{ color: "white", opacity: 0.9 }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="password"
            style={{ padding: 12, borderRadius: 12, border: "1px solid #ccc" }}
          />
        </div>

        {err ? (
          <div style={{ color: "#ffb3b3", fontWeight: 700 }}>{err}</div>
        ) : null}

        <button
          type="submit"
          disabled={!!Hr?.loading}
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid #111",
            background: "#111",
            color: "#fff",
            fontWeight: 800,
            cursor: "pointer",
            opacity: Hr?.loading ? 0.7 : 1,
          }}
        >
          {Hr?.loading ? "..." : "Login"}
        </button>

        <div style={{ color: "white", opacity: 0.85 }}>
          No account? <Link to="/register" style={{ color: "white" }}><b>Register</b></Link>
        </div>
      </form>
    </div>
  );
    }
