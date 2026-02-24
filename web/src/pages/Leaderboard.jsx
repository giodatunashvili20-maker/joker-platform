import React, { useMemo, useState } from "react";

export default function Leaderboard() {
  const year = 2026;
  const [tab, setTab] = useState("wins"); // wins | earned

  // დროებით mock (რადგან endpoint-ები შეიძლება ჯერ არ გქონდეს)
  const data = useMemo(() => {
    const wins = [
      { name: "solomonia", value: 87 },
      { name: "freshuser", value: 74 },
      { name: "giorgi", value: 61 },
      { name: "nini", value: 55 },
      { name: "nika", value: 48 },
      { name: "dato", value: 41 },
    ];

    const earned = [
      { name: "freshuser", value: 12950 },
      { name: "solomonia", value: 11800 },
      { name: "giorgi", value: 9900 },
      { name: "nini", value: 8600 },
      { name: "nika", value: 7300 },
      { name: "dato", value: 6100 },
    ];

    return (tab === "wins" ? wins : earned).slice().sort((a, b) => b.value - a.value);
  }, [tab]);

  const top3 = data.slice(0, 3);
  const order = [1, 0, 2]; // #2 #1 #3

  const fmt = (n) => new Intl.NumberFormat("en-US").format(n);

  return (
    <div className="card">
      <div className="row">
        <div style={{display:"flex", gap:10, alignItems:"center", flexWrap:"wrap"}}>
          <div className="h3">ლიდერბორდი</div>
          <div className="pill">Year: <b>{year}</b></div>
        </div>

        <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
          <button className={`lbTab ${tab==="wins"?"active":""}`} onClick={()=>setTab("wins")}>
            მოგებები
          </button>
          <button className={`lbTab ${tab==="earned"?"active":""}`} onClick={()=>setTab("earned")}>
            მოგებული ქულები
          </button>
        </div>
      </div>

      <div style={{marginTop:12}} className="podium">
        {order.map((i) => {
          const item = top3[i];
          const rank = i + 1;
          if (!item) return <div key={rank} className="podCard" />;
          const label = tab === "wins" ? `${fmt(item.value)} win` : `${fmt(item.value)} pts`;
          return (
            <div className="podCard" key={rank}>
              <div className="podRank">
                <span className="badge">{rank}</span>
                <span>{rank === 1 ? "🏆" : "⭐"}</span>
              </div>
              <div className="podName">{item.name}</div>
              <div className="podMeta">{tab === "wins" ? "Yearly wins" : "Yearly earned"}</div>
              <div className="podValue">{label}</div>
            </div>
          );
        })}
      </div>

      <div className="divider"></div>

      <div className="lbTable">
        <div className="lbRow lbHead">
          <div>#</div>
          <div>მოთამაშე</div>
          <div className="right">{tab === "wins" ? "მოგებები" : "მოგებული ქულები"}</div>
        </div>

        {data.map((u, idx) => (
          <div className="lbRow" key={u.name + idx}>
            <div><b>{idx + 1}</b></div>
            <div style={{fontWeight:900}}>{u.name}</div>
            <div className="right" style={{fontWeight:1000}}>{fmt(u.value)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
