import React, { useMemo, useState } from "react";
import "./gameTable.css";

/**
 * Minimalist table UI mock, inspired by the screenshot style.
 * - 3 opponent avatars (top/left/right)
 * - No "Me" avatar (your presence is represented by your hand at the bottom)
 * - Scoreboard in top-left (Excel-like)
 * - Chat bubble bottom-left
 * - Top-right action icons (dummy)
 * - Oval glowing table + GameStars logo
 * - 9 cards flat row (A..9)
 */

function makeEmptyRows(count) {
  return Array.from({ length: count }, (_, i) => ({
    deal: i + 1,
    me: "",
    nika: "",
    ana: "",
    gio: "",
  }));
}

export default function GameTable({
  matchId,
  players = { top: "Nika", left: "Gio", right: "Ana" },
}) {
  const [rows] = useState(() => makeEmptyRows(24));
  const totals = useMemo(() => ({ me: 0, nika: 0, ana: 0, gio: 0 }), []);

  const cards = useMemo(
    () => [
      { r: "A", s: "♠" },
      { r: "2", s: "♠" },
      { r: "3", s: "♠" },
      { r: "4", s: "♠" },
      { r: "5", s: "♠" },
      { r: "6", s: "♠" },
      { r: "7", s: "♠" },
      { r: "8", s: "♠" },
      { r: "9", s: "♠" },
    ],
    []
  );

  return (
    <div className="gs-stage">
      {/* Scoreboard */}
      <div className="gs-scoreboard" aria-label="Scoreboard">
        <div className="gs-scoreboard-title">
          Scoreboard{matchId ? <span className="gs-scoreboard-sub"> • Match {matchId}</span> : null}
        </div>
        <div className="gs-scoreboard-wrap">
          <table className="gs-table">
            <thead>
              <tr>
                <th className="col-deal">#</th>
                <th>Me</th>
                <th>Nika</th>
                <th>Ana</th>
                <th>Gio</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 10).map((r) => (
                <tr key={r.deal}>
                  <td className="col-deal">{r.deal}</td>
                  <td className="cell-muted">{r.me}</td>
                  <td className="cell-muted">{r.nika}</td>
                  <td className="cell-muted">{r.ana}</td>
                  <td className="cell-muted">{r.gio}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="col-deal">Σ</td>
                <td className="cell-total">{totals.me}</td>
                <td className="cell-total">{totals.nika}</td>
                <td className="cell-total">{totals.ana}</td>
                <td className="cell-total">{totals.gio}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Top-right actions */}
      <div className="gs-actions" aria-label="Actions">
        <button className="gs-iconBtn" title="Undo" onClick={() => {}}>
          ⟲
        </button>
        <button className="gs-iconBtn" title="Sound" onClick={() => {}}>
          🔊
        </button>
      </div>

      {/* Joker card in corner */}
      <div className="gs-jokerCard" title="Joker card">
        <div className="pip">♠</div>
        <div className="pip pip2">♠</div>
        <div className="mid">JOKER</div>
      </div>

      {/* Players */}
      <div className="gs-player gs-top">
        <div className="gs-avatar">{players.top?.[0] ?? "N"}</div>
        <div className="gs-nameplate">{players.top}</div>
      </div>

      <div className="gs-player gs-left">
        <div className="gs-avatar">{players.left?.[0] ?? "G"}</div>
        <div className="gs-nameplate">{players.left}</div>
      </div>

      <div className="gs-player gs-right">
        <div className="gs-avatar">{players.right?.[0] ?? "A"}</div>
        <div className="gs-nameplate">{players.right}</div>
      </div>

      {/* Oval table */}
      <div className="gs-tableWrap">
        <div className="gs-oval" />
        <div className="gs-brand">
          <div className="gs-logoMark" />
          <div className="gs-logoText">
            Game<span>Stars</span>
          </div>
        </div>
      </div>

      {/* Chat bubble */}
      <button className="gs-chat" title="Chat" onClick={() => {}}>
        💬
      </button>

      {/* Your hand */}
      <div className="gs-hand" aria-label="Your cards">
        {cards.map((c, idx) => (
          <div key={idx} className="gs-card">
            <div className="r">{c.r}</div>
            <div className="s">{c.s}</div>
            <div className="r r2">{c.r}</div>
            <div className="s s2">{c.s}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
