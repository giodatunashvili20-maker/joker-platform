import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "./api.js";

const AuthContext = createContext(null);

function extractToken(res) {
  return (
    res?.token ||
    res?.accessToken ||
    res?.access_token ||
    res?.jwt ||
    ""
  );
}

function extractUser(res) {
  if (!res) return null;

  // ყველაზე გავრცელებული ვარიანტები
  if (res.user) return res.user;
  if (res.me) return res.me;
  if (res.profile) return res.profile;
  if (res.data?.user) return res.data.user;
  if (res.data?.me) return res.data.me;

  // ზოგჯერ backend აბრუნებს user fields-ს პირდაპირ + token
  if (typeof res === "object") {
    const u = { ...res };
    delete u.token;
    delete u.accessToken;
    delete u.access_token;
    delete u.jwt;

    // თუ მაინც user-ის ტიპის ველები აქვს, დავაბრუნოთ
    if (u.id || u.email || u.username) return u;
  }

  return null;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function loadMe() {
      const token = localStorage.getItem("token");

      if (!token) {
        if (!alive) return;
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const me = await api("/me", { auth: true });
        if (!alive) return;
        setUser(me);
      } catch (e) {
        localStorage.removeItem("token");
        if (!alive) return;
        setUser(null);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    loadMe();
    return () => { alive = false; };
  }, []);

  async function login(email, password) {
    const res = await api("/auth/login", {
      method: "POST",
      body: { email, password },
    });

    const token = extractToken(res);
    if (token) localStorage.setItem("token", token);

    // თუ login response-ში user არ არის, token-ის შემდეგ /me გამოვიძახოთ
    let u = extractUser(res);
    if (!u && token) {
      u = await api("/me", { auth: true });
    }

    setUser(u);
  }

  async function register(email, username, password) {
    const res = await api("/auth/register", {
      method: "POST",
      body: { email, username, password },
    });

    const token = extractToken(res);
    if (token) localStorage.setItem("token", token);

    let u = extractUser(res);
    if (!u && token) {
      u = await api("/me", { auth: true });
    }

    setUser(u);
  }

  function logout() {
    localStorage.removeItem("token");
    setUser(null);
  }

  const isAuthed = useMemo(() => !!user, [user]);

  const value = useMemo(
    () => ({ user, loading, isAuthed, login, register, logout }),
    [user, loading, isAuthed]
