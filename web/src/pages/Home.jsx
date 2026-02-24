import React, { useMemo, useState } from "react";
import { useAuth } from "../auth.jsx";
import api from "../api.js";

const gamesTabs = ["ჯოკერი", "ბურა", "ნარდი", "დომინო"];
const jokerModes = ["ერთიანები", "ცხრიანები"];

function Dots({ waiting = 0 }) {
  const filled = Math.max(0, Math.min(4, Number(waiting) || 0));
  const dots = useMemo(() => Array.from({ length: 4 }, (_, i) => i < filled), [filled]);

  return (
    <div className="dots" aria-label="waiting-indicator">
      {dots.map((on, i) => (
        <span key={i} className={`dot ${on ? "on" : ""}`} />
      ))}
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();

  const [gameTab, setGameTab] = useState("ჯოკერი");
  const [jokerTab, setJokerTab] = useState("ერთიანები");

  const [lastTakenDeletes, setLastTakenDeletes] = useState(false);
  const [waiting, setWaiting] = useState(0);

  const [joining, setJoining] = useState(false);
  const [inQueue, setInQueue] = useState(false);
  const [queueTier, setQueueTier] = useState(null);
  const [err, setErr] = useState("");

  const mode = jokerTab === "ერთიანები" ? "ones" : "nines";
  const deleteScope = lastTakenDeletes ? "last" : "all";

  async function joinQueue() {
    setErr("");
    setJoining(true);
    try {
      const r = await api("/matchmaking/join", {
        method: "POST",
        body: {
          gameType:
            gameTab === "ჯოკერი" ? "joker" :
            gameTab === "ბურა" ? "bura" :
            gameTab === "ნარდი" ? "nardi" : "domino",
          mode: gameTab === "ჯოკერი" ? mode : "default",
          deleteScope,
        },
        auth: true,
      });

      setInQueue(true);
      setWaiting(r?.waiting ?? 0);
      setQueueTier(r?.tier ?? null);
    } catch (e) {
      setErr(e?.message || "JOIN_FAILED");
      setInQueue(false);
    } finally {
      setJoining(false);
    }
  }

  async function leaveQueue() {
    setErr("");
    setJoining(true);
    try {
      await api("/matchmaking/leave", {
        method: "POST",
        body: {
          gameType:
            gameTab === "ჯოკერი" ? "joker" :
            gameTab === "ბურა" ? "bura" :
            gameTab === "ნარდი" ? "nardi" : "domino",
        },
        auth: true,
      });

      setInQueue(false);
      setWaiting(0);
      setQueueTier(null);
    } catch (e) {
      setErr(e?.message || "LEAVE_FAILED");
    } finally {
      setJoining(false);
    }
  }

  return (
    <>
      {/* Game Tabs */}
      <div className="gameTabs">
        {gamesTabs.map((t) => (
          <button
            key={t}
            className={`gameTab ${t === gameTab ? "active" : ""}`}
            onClick={() => {
              setGameTab(t);
              setErr("");
              setInQueue(false);
              setWaiting(0);
              setQueueTier(null);
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Joker Modes */}
      {gameTab === "ჯოკერი" ? (
        <>
          <div className="gameTabs" style={{ marginTop: 10 }}>
            {jokerModes.map((t) => (
              <button
                key={t}
                className={`gameTab ${t === jokerTab ? "active" : ""}`}
                onClick={() => {
                  setJokerTab(t);
                  setErr("");
                  setInQueue(false);
                  setWaiting(0);
                  setQueueTier(null);
                }}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="card">
            <div className="hd">
              <h3 style={{ margin: 0 }}>{jokerTab}</h3>
              <Dots waiting={waiting} />
            </div>

            <div className="bd">
              <div className="switchRow">
                <div>ბოლო წაღებული იშლება</div>
                <button
                  className={`toggle ${lastTakenDeletes ? "on" : ""}`}
                  onClick={() => setLastTakenDeletes((v) => !v)}
                  aria-label="toggle-delete-scope"
                />
              </div>

              {queueTier ? (
                <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>
                  Tier: <b style={{ color: "var(--text)" }}>{queueTier}</b>
                </div>
              ) : null}

              {err ? (
                <div className="err" style={{ marginTop: 10 }}>
                  {err}
                </div>
              ) : null}

              {!inQueue ? (
                <button className="btn" disabled={joining} onClick={joinQueue}>
                  {joining ? "..." : "Join Queue"}
                </button>
              ) : (
                <button className="btn" disabled={joining} onClick={leaveQueue}>
                  {joining ? "..." : "Leave Queue"}
                </button>
              )}

              <div className="divider" />

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div className="muted">ქულები არ გყოფნის?</div>
                <button className="watchBtn">Watch ad 1/10</button>
              </div>
            </div>
          </div>

          {/* Shop */}
          <div className="card">
            <div className="bd">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div><strong>მაღაზია</strong></div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span className="pill">
                    კრისტალები: <strong>{user?.crystals ?? 0}</strong>
                  </span>
                  <button className="watchBtn">Watch ad 2/5</button>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="card">
          <div className="bd">
            <div style={{ fontWeight: 900, marginBottom: 6 }}>{gameTab}</div>
            <div className="muted" style={{ fontSize: 13 }}>
              UI მოგვიანებით. ახლა core ჯოკერია.
            </div>
          </div>
        </div>
      )}
    </>
  );
}
