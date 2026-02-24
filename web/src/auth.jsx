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

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        register,
        logout,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
    }
