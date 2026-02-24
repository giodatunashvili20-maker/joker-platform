import React, { useMemo, useState } from "react";
import { useAuth } from "../auth.jsx";
import api from "../api.js";

const gamesTabs = ["ჯოკერი", "ბურა", "ნარდი", "დომინო"];
const jokerModes = ["ერთიანები", "ცხრიანები"];

function DotWait({ waiting = 0 }) {
  const filled = Math.max(0, Math.min(4, Number(waiting) || 0));
  const dots = useMemo(() => Array.from({ length: 4 }, (_, i) => i < filled), [filled]);

  return (
    <div style={{ display: "flex", gap: 6 }}>
      {dots.map((on, i) => (
        <span
          key={i}
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: on ? "#111" : "#D9D9D9",
            display: "inline-block",
          }}
        />
      ))}
    </div>
  );
}

function Card({ children }) {
  return (
    <div
      style={{
        border: "1px solid #EAEAEA",
        borderRadius: 16,
        padding: 14,
        background: "#fff",
      }}
    >
      {children}
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();

  const [gameTab, setGameTab] = useState("ჯოკერი");
  const [jokerTab, setJokerTab] = useState("ერთიანები");
  const [waiting, setWaiting] = useState(0);
  const [queueTier, setQueueTier] = useState(null);
  const [err, setErr] = useState("");

  async function joinQueue() {
    setErr("");
    try {
      const res = await api("/matchmaking/join", {
        method: "POST",
        body: { gameType: "joker" },
      });
      setWaiting(res?.waiting ?? 0);
      setQueueTier(res?.tier ?? null);
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Card Games</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            {user ? `${user.username} · ${user.rankName}` : ""}
          </div>
        </div>

        <div style={{ fontSize: 12 }}>
          ქულა: <b>{user?.points ?? 0}</b>
        </div>
      </div>

      <Card>
        <div style={{ fontWeight: 800 }}>{jokerTab}</div>

        <div style={{ marginTop: 12 }}>
          <DotWait waiting={waiting} />
        </div>

        {queueTier ? (
          <div style={{ fontSize: 12, marginTop: 10 }}>
            Tier: <b>{queueTier}</b>
          </div>
        ) : null}

        {err ? (
          <div style={{ color: "crimson", marginTop: 10 }}>
            {err}
          </div>
        ) : null}

        <button
          onClick={joinQueue}
          style={{
            marginTop: 12,
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid #111",
            background: "#111",
            color: "#fff",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          თამაში
        </button>
      </Card>
    </div>
  );
}
