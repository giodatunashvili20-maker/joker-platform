import React, { useMemo, useState } from "react";
import { useAuth } from "../auth.jsx";

const gamesTabs = ["ჯოკერი", "ბურა", "ნარდი", "დომინო"];
const jokerModes = ["ერთიანები", "ცხრიანები"];

function DotWait({ filled = 2 }) {
  const dots = useMemo(() => Array.from({ length: 4 }, (_, i) => i < filled), [filled]);
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
              fontWeight: 600,
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
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
      <div style={{ color: "#111", fontWeight: 700 }}>{left}</div>
      <div style={{ color: "#111" }}>{right}</div>
    </div>
  );
}

function Switch({ checked, onChange }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: 44,
        height: 26,
        borderRadius: 999,
        border: "1px solid #E6E6E6",
        background: checked ? "#111" : "#F3F3F3",
        position: "relative",
        cursor: "pointer",
        padding: 0,
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

export default function Home() {
  const { me } = useAuth();

  const [gameTab, setGameTab] = useState("ჯოკერი");
  const [jokerTab, setJokerTab] = useState("ერთიანები");
  const [xishte, setXishte] = useState(1);
  const [deleteAll, setDeleteAll] = useState(false);

  // უბრალოდ UI-სთვის: რამდენი "უცდის" (ბურთულების რაოდენობა)
  const waitingFilled = jokerTab === "ერთიანები" ? 2 : 3;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* Header mini */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900 }}>Card Games</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            {me ? `${me.username} · ${me.rankName}` : ""}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ fontSize: 12, opacity: 0.75 }}>ქულა: <b>{me?.points ?? 0}</b></div>
        </div>
      </div>

      {/* Main game tabs */}
      <Card>
        <PillTabs tabs={gamesTabs} value={gameTab} onChange={setGameTab} />
      </Card>

      {/* If not Joker - placeholder */}
      {gameTab !== "ჯოკერი" ? (
        <Card>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>{gameTab}</div>
          <div style={{ opacity: 0.75, fontSize: 13 }}>UI მოგვიანებით. ახლა core ჯოკერია.</div>
        </Card>
      ) : (
        <>
          {/* Joker mode tabs */}
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div style={{ fontWeight: 900 }}>რეჟიმი</div>
            </div>
            <div style={{ marginTop: 10 }}>
              <PillTabs tabs={jokerModes} value={jokerTab} onChange={setJokerTab} />
            </div>
          </Card>

          {/* Matchmaking / Table Card */}
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div style={{ fontWeight: 900 }}>{jokerTab}</div>
              <DotWait filled={waitingFilled} />
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              <Row
                left="ხიშტი"
                right={
                  <select
                    value={xishte}
                    onChange={(e) => setXishte(Number(e.target.value))}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid #E6E6E6",
                      fontWeight: 700,
                      background: "#fff",
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
                right={<Switch checked={!deleteAll} onChange={(v) => setDeleteAll(!v)} />}
              />

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  style={{
                    flex: 1,
                    padding: "12px 14px",
                    borderRadius: 14,
                    border: "1px solid #111",
                    background: "#111",
                    color: "#fff",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  თამაში
                </button>
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

          {/* Watch ads for points (same style as mock) */}
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 900 }}>მაღაზია</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  კრისტალები: <b>{me?.crystals ?? 0}</b> · Watch ad 2/5
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
