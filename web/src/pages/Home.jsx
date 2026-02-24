import React, { useMemo, useState } from "react";
import { useAuth } from "../auth.jsx";
import api from "../api.js";

const gamesTabs = [
  { label: "ჯოკერი", value: "joker" },
  { label: "ბურა", value: "bura" },
  { label: "ნარდი", value: "nardi" },
  { label: "დომინო", value: "domino" },
];

function Dots({ value = 0 }) {
  const filled = Math.max(0, Math.min(4, Number(value) || 0));
  const dots = useMemo(() => Array.from({ length: 4 }, (_, i) => i < filled), [filled]);

  return (
    <div className="dots">
      {dots.map((on, i) => (
        <span key={i} className={`dot ${on ? "on" : ""}`} />
      ))}
    </div>
  );
}

function Switch({ checked, onChange }) {
  return (
    <button
      type="button"
      className={`switch ${checked ? "on" : ""}`}
      onClick={() => onChange(!checked)}
      aria-label="toggle"
    >
      <span className="knob" />
    </button>
  );
}

function GameTabs({ value, onChange }) {
  return (
    <div className="tabs">
      {gamesTabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            className={`tab ${active ? "active" : ""}`}
            onClick={() => onChange(t.value)}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Mode CTA Card (ერთიანები / ცხრიანები) — ზუსტად “ბლოკებად”
 */
function ModeCard({
  title,
  mode,
  gameType,
  inQueue,
  joining,
  waiting,
  lastTakenDeletes,
  setLastTakenDeletes,
  onJoin,
  onLeave,
  adLabel,
}) {
  return (
    <div className="modeCard">
      <div className="modeTitle">{title}</div>

      <div className="modeBody">
        {/* dots / progress bar row */}
        <div className="modeProgress">
          <Dots value={waiting} />
        </div>

        {/* switch row */}
        <div className="modeRow">
          <div className="modeRowLeft">ბოლო წაღებული იშლება</div>
          <div className="modeRowRight">
            <Switch
              checked={lastTakenDeletes}
              onChange={(v) => !inQueue && setLastTakenDeletes(v)}
            />
          </div>
        </div>

        {/* CTA */}
        <div className="modeActions">
          {!inQueue ? (
            <button
              type="button"
              className="btnPrimary"
              disabled={joining}
              onClick={() => onJoin({ gameType, mode })}
            >
              {joining ? "..." : "Join Queue"}
            </button>
          ) : (
            <button
              type="button"
              className="btnGhost"
              disabled={joining}
              onClick={() => onLeave({ gameType })}
            >
              {joining ? "..." : "Leave Queue"}
            </button>
          )}
        </div>

        {/* footer line */}
        <div className="modeFooter">
          <div className="modeHint">ქულები არ გყოფნის?</div>
          <button type="button" className="chipBtn">
            {adLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();

  const [gameType, setGameType] = useState("joker");

  // global joker setting (as in your UI)
  const [lastTakenDeletes, setLastTakenDeletes] = useState(true);

  // queue state (single active queue at a time)
  const [joining, setJoining] = useState(false);
  const [inQueue, setInQueue] = useState(false);
  const [queueMode, setQueueMode] = useState(null); // "ones" | "nines"
  const [waiting, setWaiting] = useState(0);
  const [err, setErr] = useState("");

  const deleteScope = lastTakenDeletes ? "last" : "all";

  async function joinQueue({ gameType, mode }) {
    setErr("");
    setJoining(true);
    try {
      const res = await api("/matchmaking/join", {
        method: "POST",
        auth: true,
        body: {
          gameType, // "joker" | ...
          mode: gameType === "joker" ? mode : "default",
          deleteScope,
        },
      });

      setInQueue(true);
      setQueueMode(gameType === "joker" ? mode : null);
      setWaiting(res?.waiting ?? 0);
    } catch (e) {
      setErr(e?.message || "JOIN_FAILED");
      setInQueue(false);
      setQueueMode(null);
      setWaiting(0);
    } finally {
      setJoining(false);
    }
  }

  async function leaveQueue({ gameType }) {
    setErr("");
    setJoining(true);
    try {
      await api("/matchmaking/leave", {
        method: "POST",
        auth: true,
        body: { gameType },
      });
      setInQueue(false);
      setQueueMode(null);
      setWaiting(0);
    } catch (e) {
      setErr(e?.message || "LEAVE_FAILED");
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="home">
      {/* top small header row */}
      <div className="homeTop">
        <div className="homeBrand">Card Games</div>

        <div className="homeStats">
          <div className="chip">
            ქულები: <b>{user?.points ?? 0}</b>
          </div>
          <div className="chip">
            კრისტალები: <b>{user?.crystals ?? 0}</b>
          </div>
        </div>
      </div>

      {/* game tabs */}
      <GameTabs
        value={gameType}
        onChange={(v) => {
          setGameType(v);
          setErr("");
          // queue reset on game change (like you had)
          setInQueue(false);
          setQueueMode(null);
          setWaiting(0);
        }}
      />

      {/* content */}
      {err ? <div className="err">{err}</div> : null}

      {gameType !== "joker" ? (
        <div className="glassCard">
          <div className="modeTitle">
            {gamesTabs.find((g) => g.value === gameType)?.label}
          </div>
          <div className="muted">ამ თამაშის UI მოგვიანებით.</div>
        </div>
      ) : (
        <>
          {/* ONES block */}
          <div className="glassCard">
            <ModeCard
              title="ერთიანები"
              mode="ones"
              gameType="joker"
              joining={joining}
              waiting={queueMode === "ones" ? waiting : 0}
              inQueue={inQueue && queueMode === "ones"}
              lastTakenDeletes={lastTakenDeletes}
              setLastTakenDeletes={setLastTakenDeletes}
              onJoin={joinQueue}
              onLeave={leaveQueue}
              adLabel="Watch ad 1/10"
            />
          </div>

          {/* NINES block */}
          <div className="glassCard">
            <ModeCard
              title="ცხრიანები"
              mode="nines"
              gameType="joker"
              joining={joining}
              waiting={queueMode === "nines" ? waiting : 0}
              inQueue={inQueue && queueMode === "nines"}
              lastTakenDeletes={lastTakenDeletes}
              setLastTakenDeletes={setLastTakenDeletes}
              onJoin={joinQueue}
              onLeave={leaveQueue}
              adLabel="Watch ad 1/10"
            />
          </div>

          {/* Shop / crystals block */}
          <div className="glassCard shopRow">
            <div className="shopTitle">მაღაზია</div>
            <div className="shopRight">
              <div className="chip">
                კრისტალები: <b>{user?.crystals ?? 0}</b>
              </div>
              <button type="button" className="chipBtn">
                Watch ad 2/5
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
  }
