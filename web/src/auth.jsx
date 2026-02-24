import React, { createContext, useContext, useEffect, useState } from "react";
import api from "./api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  // loading = სანამ აპი ცდილობს გაიგოს უკვე ლოგინში ვართ თუ არა
  const [loading, setLoading] = useState(true);

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
    const res = await api("/auth/login", {
      method: "POST",
      body: { email, password },
    });

    // ელოდება რომ backend დააბრუნებს { token, user }
    localStorage.setItem("token", res.token);
    setUser(res.user);
  }

  async function register(email, username, password) {
    const res = await api("/auth/register", {
      method: "POST",
      body: { email, username, password },
    });

    // ელოდება რომ backend დააბრუნებს { token, user }
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
        loading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
