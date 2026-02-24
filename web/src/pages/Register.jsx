import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";

export default function Register() {
  const { register, loading } = useAuth();
  const nav = useNavigate();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    try {
      await register(email.trim(), username.trim(), password);
      nav("/", { replace: true });
    } catch (e2) {
      setErr(e2.message || "Register failed");
    }
  }

  return (
    <div className="card">
      <div className="h3">Register</div>
      <p className="muted">შექმენი ანგარიში</p>

      <form className="form" onSubmit={onSubmit}>
        <div>
          <label>Email</label>
          <input value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="email" />
        </div>
        <div>
          <label>Username</label>
          <input value={username} onChange={(e)=>setUsername(e.target.value)} placeholder="username" />
        </div>
        <div>
          <label>Password</label>
          <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="password" />
        </div>

        {err ? <div className="err">{err}</div> : null}

        <div className="actions">
          <button className="btn" disabled={loading}>
            {loading ? "..." : "Create"}
          </button>
          <div className="muted">
            Already have account? <Link to="/login"><b>Login</b></Link>
          </div>
        </div>
      </form>
    </div>
  );
}
