import React, { createContext, useContext, useEffect, useState } from "react";
import api from "./api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  // booting = აპი სტარტზე ამოწმებს token/me-ს
  const [booting, setBooting] = useState(true);

  // loading = login/register პროცესის დროს
  const [loading, setLoading] = useState(false);

  useEffect(() => {
  async function loadMe() {
    const token = localStorage.getItem("token");

    if (!token) {
      setUser(null);
      setBooting(false);
      return;
    }

    try {
      const me = await api("/me", { auth: true });

      alert("ME RESPONSE: " + JSON.stringify(me));

      setUser(me);
    } catch (e) {
      alert("ME ERROR: " + e.message);

      localStorage.removeItem("token");
      setUser(null);
    } finally {
      setBooting(false);
    }
  }

  loadMe();
}, []);

  async function login(email, password) {
    setLoading(true);
    try {
      const res = await api("/auth/login", {
        method: "POST",
        body: { email, password },
      });

      localStorage.setItem("token", res.token);
      setUser(res.user);
      return res.user;
    } finally {
      setLoading(false);
    }
  }

  async function register(email, username, password) {
    setLoading(true);
    try {
      const res = await api("/auth/register", {
        method: "POST",
        body: { email, username, password },
      });

      localStorage.setItem("token", res.token);
      setUser(res.user);
      return res.user;
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("token");
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        register,
        logout,
        loading, // ✅ მხოლოდ action loading
        booting, // ✅ initial check
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
