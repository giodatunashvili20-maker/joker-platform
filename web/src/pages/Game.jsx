import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import api from "../api.js";
import GameTable from "../components/GameTable.jsx";

export default function Game() {
  const loc = useLocation();
  const params = new URLSearchParams(loc.search);
  const matchId = params.get("matchId");

  const [players, setPlayers] = useState({ top: "Nika", left: "Gio", right: "Ana" });

  // Optional: fetch match info if backend supports it
  useEffect(() => {
    if (!matchId) return;
    let stop = false;
    (async () => {
      try {
        const m = await api(`/matches/${encodeURIComponent(matchId)}`, { method: "GET", auth: true });
        if (stop) return;
        if (m?.players?.length === 4) {
          // Choose 3 opponents; keep "Me" hidden as requested
          const names = m.players.map(p => p.username || p.name || `P${p.id}`);
          // naive: take first 3 as opponents
          setPlayers({
            top: names[0] ?? "Nika",
            left: names[1] ?? "Gio",
            right: names[2] ?? "Ana",
          });
        }
      } catch {}
    })();
    return () => { stop = true; };
  }, [matchId]);

  return (
    <div className="shell" style={{padding:0}}>
      <GameTable matchId={matchId} players={players} />
    </div>
  );
}
