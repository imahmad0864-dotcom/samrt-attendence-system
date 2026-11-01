import { useEffect, useState } from "react";
import { api, dkey, tm, toast } from "./lib.js";

export default function Records() {
  const [date, setDate] = useState(dkey(new Date()));
  const [sid, setSid] = useState("");
  const [rows, setRows] = useState([]);
  const load = async () => {
    const qs = new URLSearchParams({ limit: 500 });
    if (date) qs.set("date", date);
    if (sid.trim()) qs.set("studentId", sid.trim());
    try { setRows((await api("/attendance?" + qs)).attendance); } catch (e) { toast(e.message, "bad"); }
  };
  useEffect(() => { load(); }, []);

  const exportCsv = () => {
    if (!rows.length) return toast("Nothing to export.", "bad");
    const c = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
    const t = ["Date,Time,Student ID,Name,Class,Status"].concat(rows.map((r) => [r.dateKey, tm(r.markedAt), r.studentId, r.student?.name, r.student?.className, r.status].map(c).join(","))).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([t], { type: "text/csv" }));
    a.download = "attendance-" + (date || "all") + ".csv"; a.click();
  };

  return (
    <>
      <div className="row" style={{ marginBottom: 16 }}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ maxWidth: 190 }} />
        <input placeholder="Student ID (optional)" value={sid} onChange={(e) => setSid(e.target.value)} style={{ maxWidth: 220 }} />
        <button className="btn pri" onClick={load}>Show records</button>
        <button className="btn" onClick={exportCsv}>Export CSV</button>
      </div>
      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        <table>
          <thead><tr><th>Date</th><th>Time</th><th>ID</th><th>Name</th><th>Class</th><th>Status</th><th>Match</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r._id}>
                <td>{r.dateKey}</td><td>{tm(r.markedAt)}</td><td>{r.studentId}</td><td>{r.student?.name}</td><td>{r.student?.className}</td>
                <td><span className="tag g">{r.status}</span></td>
                <td>{typeof r.similarity === "number" ? Math.round(r.similarity * 100) + "%" : ""}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan="7" className="muted">No records for this filter.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
