import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";

export default function Login() {
  const { login, loading } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    try {
      await login(email.trim(), password);
      const go = loc.state?.from || "/";
      nav(go, { replace: true });
    } catch (e2) {
      setErr(e2?.message || "Login failed");
    }
  }

  return (
    <div className="card">
      <div className="h3">Login</div>
      <p className="muted">შედი ანგარიშზე</p>

      <form className="form" onSubmit={onSubmit}>
        <div>
          <label>Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email"
            autoComplete="email"
          />
        </div>

        <div>
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="password"
            autoComplete="current-password"
          />
        </div>

        {err ? <div className="err">{err}</div> : null}

        <div className="actions">
          <button className="btn" disabled={loading}>
            {loading ? "..." : "Login"}
          </button>

          <div className="muted">
            No account?{" "}
            <Link to="/register">
              <b>Register</b>
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
