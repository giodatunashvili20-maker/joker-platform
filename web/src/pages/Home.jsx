import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import api from "../api.js";
import { showRewardedAd } from "../services/admob.js";

export default function Home() {
  const { user } = useAuth();

  const navigate = useNavigate();
  const pollRef = useRef(null);

  const [game, setGame] = useState("joker");

  // ცალ-ცალკე სვიჩები
  const [onesLastTakenDeletes, setOnesLastTakenDeletes] = useState(true);
  const [ninesLastTakenDeletes, setNinesLastTakenDeletes] = useState(true);

  const [joining, setJoining] = useState(false);
  const [inQueue, setInQueue] = useState(false);
  const [queueMode, setQueueMode] = useState(null);
  const [waiting, setWaiting] = useState(0);
  const [err, setErr] = useState("");

  // ახალი state რეალური queue count-ებისთვის
  const [queueCounts, setQueueCounts] = useState({
    ones: 0,
    nines: 0,
  });

  // Match status polling (თუ თვითონ ხარ queue-ში)
  useEffect(() => {
    if (!inQueue) {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      return;
    }

    let stopped = false;

    async function tick() {
      try {
        const st = await api("/matchmaking/status", { method: "GET", auth: true });
        if (stopped) return;

        if (st?.state === "matched" && st?.match?.id) {
          setInQueue(false);
          setQueueMode(null);
          setWaiting(0);
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          navigate(`/game?matchId=${encodeURIComponent(st.match.id)}`);
          return;
        }

        if (st?.state === "waiting") {
          setWaiting(st?.waiting ?? 1);
        }

        if (st?.state === "idle") {
          setInQueue(false);
          setQueueMode(null);
          setWaiting(0);
        }
      } catch (e) {
        // ignore transient errors
      }
    }

    tick();
    pollRef.current = setInterval(tick, 1500);

    return () => {
      stopped = true;
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [inQueue, navigate]);

  // Queue count polling — ყოველ წამს განახლდება
  useEffect(() => {
    let stopped = false;

    async function tickCounts() {
      try {
        const counts = await api("/matchmaking/counts", { method: "GET" });

        if (!stopped) {
          setQueueCounts({
            ones: counts?.ones ?? 0,
            nines: counts?.nines ?? 0,
          });
        }
      } catch (e) {
        // ignore temporary errors
      }
    }

    tickCounts();
    const id = setInterval(tickCounts, 1000);

    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, []);

  async function joinQueue(mode) {
    setErr("");
    setJoining(true);

    const deleteScope =
      mode === "ones"
        ? (onesLastTakenDeletes ? "last" : "all")
        : (ninesLastTakenDeletes ? "last" : "all");

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
      <div className="card" style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontWeight: 800 }}>Daily Ads</div>
            <div style={{ opacity: 0.75, fontSize: 13 }}>
              Demo buttons. In production, call claim only after a rewarded ad completes.
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              className="btn"
              onClick={async () => {
                try {
                  const ad = await showRewardedAd();
                  if (!ad.ok) throw new Error("Ad not completed");
                  const r = await api("/ads/points/claim", { method: "POST", auth: true });
                  alert(`+${r.reward} points (used ${r.used}/${r.limit})`);
                } catch (e) {
                  alert(e?.message || "Ad reward failed");
                }
              }}
            >
              Watch Ad • Points
            </button>

            <button
              className="btn"
              onClick={async () => {
                try {
                  const ad = await showRewardedAd();
                  if (!ad.ok) throw new Error("Ad not completed");
                  const r = await api("/ads/crystals/claim", { method: "POST", auth: true });
                  alert(`+${r.reward} crystal (used ${r.used}/${r.limit})`);
                } catch (e) {
                  alert(e?.message || "Ad reward failed");
                }
              }}
            >
              Watch Ad • Crystals
            </button>
          </div>
        </div>
      </div>

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

      {/* ერთიანები */}
      <div className="card">
        <div className="hd">
          <h3 className="h3">ერთიანები</h3>
        </div>

        <div className="bd">
          {renderDots(queueCounts.ones)}

          <div className="switchRow">
            <span>ბოლო წაღებული იშლება</span>
            <button
              className={`toggle ${onesLastTakenDeletes ? "on" : ""}`}
              onClick={() => !inQueue && setOnesLastTakenDeletes(!onesLastTakenDeletes)}
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

      {/* ცხრიანები */}
      <div className="card">
        <div className="hd">
          <h3 className="h3">ცხრიანები</h3>
        </div>

        <div className="bd">
          {renderDots(queueCounts.nines)}

          <div className="switchRow">
            <span>ბოლო წაღებული იშლება</span>
            <button
              className={`toggle ${ninesLastTakenDeletes ? "on" : ""}`}
              onClick={() => !inQueue && setNinesLastTakenDeletes(!ninesLastTakenDeletes)}
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
