import React from "react";

export default function Game() {
  return (
    <div className="card">
      <div className="h3">Game</div>
      <p className="muted">აქ იქნება გეიმის ეკრანი (მერე დავამატებთ რეალურ ლოგიკას).</p>

      <div className="card" style={{marginTop:12}}>
        <div className="h3">Tables</div>
        <p className="muted">Beginner / Intermediate / Pro</p>
        <div className="actions">
          <button className="btn">Beginner</button>
          <button className="btn">Intermediate</button>
          <button className="btn">Pro</button>
        </div>
      </div>
    </div>
  );
}
