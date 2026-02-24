import React, { useMemo, useState } from "react";
import { useAuth } from "../auth.jsx";
import api from "../api.js";

const gamesTabs = ["ჯოკერი", "ბურა", "ნარდი", "დომინო"];

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

function Row({ left, right }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        alignItems: "center",
      }}
    >
      <div style={{ color: "#111", fontWeight: 800 }}>{left}</div>
      <div style={{ color: "#111" }}>{right}</div>
    </div>
  );
}

function Switch({ checked, onChange, disabled }) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      style={{
        width: 44,
        height: 26,
        borderRadius: 999,
        border: "1px solid #E6E6E6",
        background: checked ? "#111" : "#F3F3F3",
        position: "relative",
        cursor: disabled ? "not-allowed" : "pointer",
        padding: 0,
        opacity: disabled ? 0.6 : 1,
      }}
      aria-label="toggle"
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: 999,
          background: "#fff",
          position: "absolute",
          top: 1,
          left: checked ? 20 : 2,
          transition: "left 150ms ease",
          boxShadow: "0 2px 10px rgba(0,0,0,0.12)",
        }}
      />
    </button>
  );
}

function ModeCTA({ title, subtitle, active, onClick, disabled }) {
  return (
    <button
      onClick={() => !disabled && onClick()}
      style={{
        textAlign: "left",
        width: "100%",
        borderRadius: 16,
        padding: 14,
        border: active ? "2px solid #111" : "1px solid #E6E6E6",
        background: active ? "rgba(17,17,17,0.04)" : "#fff",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.65 : 1,
        display: "grid",
        gap: 6,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div style={{ fontWeight: 900, fontSize: 16, color: "#111" }}>{title}</div>
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            border: "2px solid #111",
            background: active ? "#111" : "transparent",
          }}
        />
      </div>
      <div style={{ fontSize: 12, opacity: 0.75, color: "#111" }}>{subtitle}</div>
    </button>
  );
}

export default function Home() {
  const { user } = useAuth();

  const [gameTab, setGameTab] = useState("ჯოკერი");

  // CTA modes
  const [jokerTab, setJokerTab] = useState("ერთიანები");

  const [xishte, setXishte] = useState(1);

  // switch: ჩართული = "ბოლო წაღებული იშლება" => deleteScope="last"
  const [lastTakenDeletes, setLastTakenDeletes] = useState(true);

  // matchmaking UI state
  const [joining, setJoining] = useState(false);
  const [inQueue, setInQueue] = useState(false);
  const [waiting, setWaiting] = useState(0);
  const [queueTier, setQueueTier] = useState(null);
  const [err, setErr] = useState("");

  const mode = jokerTab === "ერთიანები" ? "ones" : "nines";
  const deleteScope = lastTakenDeletes ? "last" : "all";

  const gameType =
    gameTab === "ჯოკერი"
      ? "joker"
      : gameTab === "ბურა"
      ? "bura"
      : gameTab === "ნარდი"
      ? "nardi"
      : "domino";

  async function joinQueue() {
    setErr("");
    setJoining(true);
    try {
      const r = await api("/matchmaking/join", {
        method: "POST",
        body: {
          gameType,
          mode: gameTab === "ჯოკერი" ? mode : "default",
          xishte,
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
        body: { gameType },
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
    <div style={{ display: "grid", gap: 12 }}>
      {/* Header mini */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 900 }}>Card Games</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            {user ? `${user.username} · ${user.rankName || ""}` : ""}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            ქულა: <b>{user?.points ?? 0}</b>
          </div>
        </div>
      </div>

      {/* Main game tabs */}
      <Card>
        <PillTabs
          tabs={gamesTabs}
          value={gameTab}
          onChange={(t) => {
            setGameTab(t);
            setInQueue(false);
            setWaiting(0);
            setQueueTier(null);
            setErr("");
          }}
        />
      </Card>

      {gameTab !== "ჯოკერი" ? (
        <Card>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>{gameTab}</div>
          <div style={{ opacity: 0.75, fontSize: 13 }}>
            UI მოგვიანებით. ახლა core ჯოკერია.
          </div>
        </Card>
      ) : (
        <>
          {/* Joker mode CTA blocks */}
          <Card>
            <div style={{ fontWeight: 900 }}>რეჟიმი</div>

            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              <ModeCTA
                title="ერთიანები"
                subtitle="კლასიკური რეჟიმი · სწრაფი მატჩები"
                active={jokerTab === "ერთიანები"}
                disabled={inQueue}
                onClick={() => {
                  setJokerTab("ერთიანები");
                  setInQueue(false);
                  setWaiting(0);
                  setQueueTier(null);
                  setErr("");
                }}
              />
              <ModeCTA
                title="ცხრიანები"
                subtitle="მეორე პრესეტი · სხვა ტაქტიკა"
                active={jokerTab === "ცხრიანები"}
                disabled={inQueue}
                onClick={() => {
                  setJokerTab("ცხრიანები");
                  setInQueue(false);
                  setWaiting(0);
                  setQueueTier(null);
                  setErr("");
                }}
              />
            </div>

            {inQueue ? (
              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
                Queue-ში ყოფნისას რეჟიმს ვერ შეცვლი.
              </div>
            ) : null}
          </Card>

          {/* Matchmaking / Table Card */}
          <Card>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div style={{ fontWeight: 900 }}>{jokerTab}</div>
              <DotWait waiting={waiting} />
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              <Row
                left="ხიშტი"
                right={
                  <select
                    value={xishte}
                    disabled={inQueue}
                    onChange={(e) => setXishte(Number(e.target.value))}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid #E6E6E6",
                      fontWeight: 800,
                      background: "#fff",
                      opacity: inQueue ? 0.6 : 1,
                    }}
                  >
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                  </select>
                }
              />

              <Row
                left="ბოლო წაღებული იშლება"
                right={
                  <Switch
                    checked={lastTakenDeletes}
                    disabled={inQueue}
                    onChange={(v) => setLastTakenDeletes(v)}
                  />
                }
              />

              {queueTier ? (
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  Tier: <b>{queueTier}</b>
                </div>
              ) : null}

              {err ? (
                <div style={{ color: "crimson", fontWeight: 800 }}>{err}</div>
              ) : null}

              <div style={{ display: "flex", gap: 10 }}>
                {!inQueue ? (
                  <button
                    disabled={joining}
                    onClick={joinQueue}
                    style={{
                      flex: 1,
                      padding: "12px 14px",
                      borderRadius: 14,
                      border: "1px solid #111",
                      background: "#111",
                      color: "#fff",
                      fontWeight: 900,
                      cursor: joining ? "not-allowed" : "pointer",
                      opacity: joining ? 0.7 : 1,
                    }}
                  >
                    {joining ? "შეყვანა..." : "თამაში"}
                  </button>
                ) : (
                  <button
                    disabled={joining}
                    onClick={leaveQueue}
                    style={{
                      flex: 1,
                      padding: "12px 14px",
                      borderRadius: 14,
                      border: "1px solid #E6E6E6",
                      background: "#fff",
                      color: "#111",
                      fontWeight: 900,
                      cursor: joining ? "not-allowed" : "pointer",
                      opacity: joining ? 0.7 : 1,
                    }}
                  >
                    {joining ? "გასვლა..." : "გასვლა"}
                  </button>
                )}

                <button
                  style={{
                    padding: "12px 14px",
                    borderRadius: 14,
                    border: "1px solid #E6E6E6",
                    background: "#fff",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  წესები
                </button>
              </div>
            </div>
          </Card>

          {/* Watch ads for points */}
          <Card>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontWeight: 900 }}>ქულები</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>Watch ad 1/10</div>
              </div>
              <button
                style={{
                  padding: "10px 12px",
                  borderRadius: 14,
                  border: "1px solid #E6E6E6",
                  background: "#fff",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Watch Ad
              </button>
            </div>
          </Card>

          {/* Shop block */}
          <Card>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontWeight: 900 }}>მაღაზია</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  კრისტალები: <b>{user?.crystals ?? 0}</b> · Watch ad 2/5
                </div>
              </div>

              <button
                style={{
                  padding: "10px 12px",
                  borderRadius: 14,
                  border: "1px solid #111",
                  background: "#111",
                  color: "#fff",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Open
              </button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
