import { useEffect, useState } from "react";
import { api, dkey } from "./lib.js";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    Promise.all([api("/students?active=true"), api("/attendance?limit=500")])
      .then(([s, a]) => setData({ s: s.students, a: a.attendance })).catch((e) => setErr(e.message));
  }, []);
  if (err) return <div className="card"><h2>Something went wrong</h2><p className="muted">{err}</p></div>;
  if (!data) return <p className="muted">Loading...</p>;

  const today = dkey(new Date());
  const enrolled = data.s.filter((x) => x.faceEnrolled);
  const here = new Set(data.a.filter((x) => x.dateKey === today).map((x) => x.studentId));
  const absent = enrolled.filter((x) => !here.has(x.studentId));
  const rate = enrolled.length ? Math.round((here.size / enrolled.length) * 100) : 0;
  const days = [...Array(7)].map((_, i) => {
    const d = new Date(); d.setDate(d.getDate() - 6 + i); const k = dkey(d);
    return { k, l: d.toLocaleDateString([], { weekday: "short" }), n: data.a.filter((x) => x.dateKey === k).length };
  });
  const max = Math.max(1, ...days.map((d) => d.n));
  const stats = [[enrolled.length, "Students with a face enrolled"], [here.size, "Present today"], [absent.length, "Not yet marked"], [rate + "%", "Attendance today"]];

  return (
    <>
      <div className="stats">{stats.map(([n, l]) => <div className="card stat" key={l}><div className="n">{n}</div><div className="l">{l}</div></div>)}</div>
      <div className="two">
        <div className="card"><h3>Last 7 days</h3>
          <div className="bars">{days.map((d) => <div key={d.k} title={d.n + " present"}><b style={{ height: (d.n / max) * 80 + "%" }}>{d.n}</b>{d.n}<br />{d.l}</div>)}</div>
        </div>
        <div className="card"><h3>Not yet marked today</h3>
          <ul className="list">
            {absent.slice(0, 8).map((x) => <li key={x._id}><span>{x.name}</span><span className="muted">{x.className}</span></li>)}
            {!absent.length && <li className="muted">Everyone enrolled is present.</li>}
          </ul>
        </div>
      </div>
    </>
  );
}
