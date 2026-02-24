const API_URL = "https://joker-platform.onrender.com";

const api = {
  async request(path, options = {}) {
    const token = localStorage.getItem("token");

    const res = await fetch(API_URL + path, {
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      ...options
    });

    if (!res.ok) {
      throw new Error("API error");
    }

    return res.json();
  },

  get(path) {
    return this.request(path, { method: "GET" });
  },

  post(path, body) {
    return this.request(path, {
      method: "POST",
      body: JSON.stringify(body)
    });
  }
};

export default api;
