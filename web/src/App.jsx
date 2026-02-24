import React from "react";
import { Navigate, Route, Routes, Link, useLocation } from "react-router-dom";
import { useAuth } from "./auth.jsx";

import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Home from "./pages/Home.jsx";
import Game from "./pages/Game.jsx";
import Leaderboard from "./pages/Leaderboard.jsx";

function RequireAuth({ children }) {
  const { isAuthed, loading } = useAuth();
  const loc = useLocation();

  if (loading) return <div className="wrap"><div className="card">Loading...</div></div>;
  if (!isAuthed) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return children;
}

export default function App() {
  const { isAuthed, user, logout } = useAuth();

  return (
    <div className="wrap">
      <header className="topbar">
        <div className="brand">
          <div className="logo">♠</div>
          <div>
            <div className="title">Card Games</div>
            <div className="sub">Joker Platform</div>
          </div>
        </div>

        <nav className="nav">
          {isAuthed ? (
            <>
              <Link to="/">Home</Link>
              <Link to="/game">Game</Link>
              <Link to="/leaderboard">Leaderboard</Link>
              <button className="btn" onClick={logout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login">Login</Link>
              <Link to="/register">Register</Link>
            </>
          )}
        </nav>
      </header>

      {isAuthed && user ? (
        <div className="card slim">
          <div className="row">
            <div>
              <div className="h3">{user.username}</div>
              <div className="muted">Points: <b>{user.points ?? 0}</b> · Crystals: <b>{user.crystals ?? 0}</b></div>
            </div>
            <div className="pill">Tier: <b>{user.tier || "beginner"}</b></div>
          </div>
        </div>
      ) : null}

      <Routes>
        <Route path="/" element={<RequireAuth><Home /></RequireAuth>} />
        <Route path="/game" element={<RequireAuth><Game /></RequireAuth>} />
        <Route path="/leaderboard" element={<RequireAuth><Leaderboard /></RequireAuth>} />
        <Route path="/login" element={isAuthed ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/register" element={isAuthed ? <Navigate to="/" replace /> : <Register />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
