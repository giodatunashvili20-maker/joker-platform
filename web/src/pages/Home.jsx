import React, { useMemo, useState } from "react";
import { useAuth } from "../auth.jsx";
import api from "../api.js"; // default import (api.js-ში default export დავამატეთ)

const gamesTabs = ["ჯოკერი", "ბურა", "ნარდი", "დომინო"];
const jokerModes = ["ერთიანები", "ცხრიანები"];

function DotWait({ waiting = 0 }) {
  const filled = Math.max(0, Math.min(4, Number(waiting) || 0));
  const dots = useMemo(
    () => Array.from({ length: 4 }, (_, i) => i < filled),
    [filled]
  );

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
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
        boxShadow: "0 6px 18px rgba(0,0,0,0.04)",
      }}
    >
      {children}
    </div>
  );
}

function PillTabs({ tabs, value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {tabs.map((t) => {
        const active = t === value;
        return (
          <button
            key={t}
            onClick={() => onChange(t)}
            style={{
              border: "1px solid #E6E6E6",
              background: active ? "#111" : "#fff",
              color: active ? "#fff" : "#111",
              padding: "10px 12px",
              borderRadius: 999,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {t}
          </button>
        );
      })}
    </div>
  );
}

export default function Home() {
  // შენს პროექტში სწორად "me" არის
  const { me } = useAuth();

  const [gameTab, setGameTab] = useState("ჯოკერი");
  const [jokerTab, setJokerTab] = useState("ერთიანები");

  const [joining, setJoining] = useState(false);
  const [waiting, setWaiting] = useState(0);
  const [queueTier, setQueueTier] = useState(null);
  const [err, setErr] = useState("");

  async function joinQueue() {
    setErr("");
    setJoining(true);
    try {
      const res = await api("/matchmaking/join", {
        method: "POST",
        body: {
          gameType:
            gameTab === "ჯოკერი"
              ? "joker"
              : gameTab === "ბურა"
              ? "bura"
              : gameTab === "ნარდი"
              ? "nardi"
              : "domino",
          mode: gameTab === "ჯოკერი" ? (jokerTab === "ერთიანები" ? "ones" : "nines") : "default",
        },
        auth: true, // <-- ეს აუცილებელია თუ endpoint ტოკენს ითხოვს
      });

      setWaiting(res?.waiting ?? 0);
      setQueueTier(res?.tier ?? null);
    } catch (e) {
      setErr(e?.message || "JOIN_FAILED");
    } finally {
      setJoining(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Card Games</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            {me ? `${me.username} · ${me.rankName}` : ""}
          </div>
        </div>

        <div style={{ fontSize: 12 }}>
          ქულა: <b>{me?.points ?? 0}</b>
        </div>
      </div>

      {/* Tabs */}
      <Card>
        <PillTabs
          tabs={gamesTabs}
          value={gameTab}
          onChange={(t) => {
            setGameTab(t);
            setErr("");
            setWaiting(0);
            setQueueTier(null);
          }}
        />
      </Card>

      {gameTab === "ჯოკერი" ? (
        <Card>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>რეჟიმი</div>
          <PillTabs tabs={jokerModes} value={jokerTab} onChange={setJokerTab} />

          <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 800 }}>{jokerTab}</div>
            <DotWait waiting={waiting} />
          </div>

          {queueTier ? (
            <div style={{ fontSize: 12, marginTop: 10 }}>
              Tier: <b>{queueTier}</b>
            </div>
          ) : null}

          {err ? (
            <div style={{ color: "crimson", marginTop: 10, fontWeight: 700 }}>
              {err}
            </div>
          ) : null}

          <button
            onClick={joinQueue}
            disabled={joining}
            style={{
              marginTop: 12,
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #111",
              background: "#111",
              color: "#fff",
              fontWeight: 800,
              cursor: joining ? "not-allowed" : "pointer",
              opacity: joining ? 0.7 : 1,
            }}
          >
            {joining ? "მიმდინარეობს..." : "თამაში"}
          </button>
        </Card>
      ) : (
        <Card>
          <div style={{ fontWeight: 900 }}>{gameTab}</div>
          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>
            UI მოგვიანებით. ახლა core ჯოკერია.
          </div>
        </Card>
      )}
    </div>
  );
}
