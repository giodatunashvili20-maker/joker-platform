import React, { createContext, useContext, useEffect, useState } from "react";
import api from "./api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMe() {
      try {
        const me = await api("/me", { auth: true });
        setUser(me);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    loadMe();
  }, []);

  async function login(email, password) {
    const res = await api("/auth/login", {
      method: "POST",
      body: { email, password },
    });

    localStorage.setItem("token", res.token);

    // ⚠️ ბევრი backend /auth/login-ზე user არ აბრუნებს.
    // ამიტომ უფრო სტაბილურია /me-ით წამოღება:
    const me = await api("/me", { auth: true });
    setUser(me);

    return me;
  }

  async function register(email, username, password) {
    const res = await api("/auth/register", {
      method: "POST",
      body: { email, username, password },
    });

    localStorage.setItem("token", res.token);

    const me = await api("/me", { auth: true });
    setUser(me);

    return me;
  }

  function logout() {
    localStorage.removeItem("token");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  return ctx;
}
