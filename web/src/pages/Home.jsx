import React, { useState } from "react";
import { useAuth } from "../auth.jsx";
import api from "../api.js";

export default function Home() {
  const { user } = useAuth();

  const [game, setGame] = useState("joker");
  const [lastTakenDeletes, setLastTakenDeletes] = useState(true);

  const [joining, setJoining] = useState(false);
  const [inQueue, setInQueue] = useState(false);
  const [queueMode, setQueueMode] = useState(null);
  const [waiting, setWaiting] = useState(0);
  const [err, setErr] = useState("");

  const deleteScope = lastTakenDeletes ? "last" : "all";

  async function joinQueue(mode) {
    setErr("");
    setJoining(true);
    try {
      const res = await api("/matchmaking/join", {
        method: "POST",
        auth: true,
        body: {
          gameType: "joker",
          mode,
          deleteScope,
        },
      });

      setInQueue(true);
      setQueueMode(mode);
      setWaiting(res?.waiting ?? 0);
    } catch (e) {
      setErr(e.message);
    } finally {
      setJoining(false);
    }
  }

  async function leaveQueue() {
    setJoining(true);
    try {
      await api("/matchmaking/leave", {
        method: "POST",
        auth: true,
        body: { gameType: "joker" },
      });

      setInQueue(false);
      setQueueMode(null);
      setWaiting(0);
    } catch (e) {
      setErr(e.message);
    } finally {
      setJoining(false);
    }
  }

  function renderDots(count) {
    return (
      <div className="dots">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`dot ${i < count ? "on" : ""}`} />
        ))}
      </div>
    );
  }

  return (
    <div className="shell">

      {/* GAME TABS */}
      <div className="gameTabs">
        <button
          className={`gameTab ${game === "joker" ? "active" : ""}`}
          onClick={() => setGame("joker")}
        >
          ჯოკერი
        </button>
        <button className="gameTab">ბურა</button>
        <button className="gameTab">ნარდი</button>
        <button className="gameTab">დომინო</button>
      </div>

      {err && <div className="err">{err}</div>}

      {/* === ერთიანები === */}
      <div className="card">
        <div className="hd">
          <h3 className="h3">ერთიანები</h3>
        </div>

        <div className="bd">

          {renderDots(queueMode === "ones" ? waiting : 0)}

          <div className="switchRow">
            <span>ბოლო წაღებული იშლება</span>
            <button
              className={`toggle ${lastTakenDeletes ? "on" : ""}`}
              onClick={() =>
                !inQueue && setLastTakenDeletes(!lastTakenDeletes)
              }
            />
          </div>

          {!inQueue || queueMode !== "ones" ? (
            <button
              className="btn"
              disabled={joining}
              onClick={() => joinQueue("ones")}
            >
              {joining ? "..." : "Join Queue"}
            </button>
          ) : (
            <button
              className="btn"
              disabled={joining}
              onClick={leaveQueue}
            >
              Leave Queue
            </button>
          )}

          <div className="divider" />

          <div className="row">
            <span className="muted">ქულები არ გყოფნის?</span>
            <button className="watchBtn">Watch ad 1/10</button>
          </div>
        </div>
      </div>

      {/* === ცხრიანები === */}
      <div className="card">
        <div className="hd">
          <h3 className="h3">ცხრიანები</h3>
        </div>

        <div className="bd">

          {renderDots(queueMode === "nines" ? waiting : 0)}

          <div className="switchRow">
            <span>ბოლო წაღებული იშლება</span>
            <button
              className={`toggle ${lastTakenDeletes ? "on" : ""}`}
              onClick={() =>
                !inQueue && setLastTakenDeletes(!lastTakenDeletes)
              }
            />
          </div>

          {!inQueue || queueMode !== "nines" ? (
            <button
              className="btn"
              disabled={joining}
              onClick={() => joinQueue("nines")}
            >
              {joining ? "..." : "Join Queue"}
            </button>
          ) : (
            <button
              className="btn"
              disabled={joining}
              onClick={leaveQueue}
            >
              Leave Queue
            </button>
          )}

          <div className="divider" />

          <div className="row">
            <span className="muted">ქულები არ გყოფნის?</span>
            <button className="watchBtn">Watch ad 1/10</button>
          </div>
        </div>
      </div>

      {/* SHOP */}
      <div className="card slim">
        <div className="row">
          <span className="h3">მაღაზია</span>
          <div className="row">
            <div className="pill">
              კრისტალები: <strong>{user?.crystals ?? 0}</strong>
            </div>
            <button className="watchBtn">Watch ad 2/5</button>
          </div>
        </div>
      </div>
    </div>
  );
}
