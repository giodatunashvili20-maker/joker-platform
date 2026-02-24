import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("token") || "");
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  const isAuthed = !!token;

  async function refreshMe(t = token) {
    if (!t) {
      setUser(null);
      return;
    }
    setLoading(true);
    try {
      const me = await api.me(t);
      setUser(me);
    } catch (e) {
      // ტოკენი ცუდია/დაიძველა
      localStorage.removeItem("token");
      setToken("");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function login(email, password) {
    setLoading(true);
    try {
      const data = await api.login({ email, password });
      // backend აბრუნებს {token}
      const t = data?.token;
      if (!t) throw new Error("Token missing");
      localStorage.setItem("token", t);
      setToken(t);
      await refreshMe(t);
      return true;
    } finally {
      setLoading(false);
    }
  }

  async function register(email, username, password) {
    setLoading(true);
    try {
      const data = await api.register({ email, username, password });
      const t = data?.token;
      if (!t) throw new Error("Token missing");
      localStorage.setItem("token", t);
      setToken(t);
      await refreshMe(t);
      return true;
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("token");
    setToken("");
    setUser(null);
  }

  useEffect(() => {
    refreshMe(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({ token, user, isAuthed, loading, login, register, logout, refreshMe }),
    [token, user, isAuthed, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
