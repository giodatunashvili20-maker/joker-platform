import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "./api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // boot: ვამოწმებთ token-ს და თუ არის, /me ვიძახებთ
  useEffect(() => {
    async function loadMe() {
      const token = localStorage.getItem("token");

      // თუ token არ არის — უბრალოდ ვასრულებთ boot-ს
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        // token არის -> ვთხოვთ /me-ს
        const me = await api("/me", { auth: true });
        setUser(me);
      } catch (e) {
        // token არასწორია ან expired -> ვშლით
        localStorage.removeItem("token");
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    loadMe();
  }, []);

  async function login(email, password) {
    const res = await api("/login", {
      method: "POST",
      body: { email, password },
    });

    // server უნდა აბრუნებდეს: { token, user }
    localStorage.setItem("token", res.token);
    setUser(res.user);
  }

  async function register(email, username, password) {
    const res = await api("/auth/register", {
      method: "POST",
      body: { email, username, password },
    });

    localStorage.setItem("token", res.token);
    setUser(res.user);
  }

  function logout() {
    localStorage.removeItem("token");
    setUser(null);
  }

  const isAuthed = !!user;

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthed,
      login,
      register,
      logout,
    }),
    [user, loading, isAuthed]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
