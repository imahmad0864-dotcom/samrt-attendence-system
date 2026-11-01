import { useCallback, useEffect, useRef, useState } from "react";
import { api, dkey, tm, toast, useCamera } from "./lib.js";

export default function Kiosk() {
  const cam = useCamera();
  const [auto, setAuto] = useState(true);
  const [hint, setHint] = useState("Camera is off");
  const [res, setRes] = useState({ n: 0, k: "", t: "Ready", p: "Start the camera, then look straight at it." });
  const [recent, setRecent] = useState({ count: 0, list: [] });
  const busy = useRef(false), hold = useRef(0);
  const show = (k, t, p) => setRes((r) => ({ n: r.n + 1, k, t, p }));

  const loadRecent = useCallback(async () => {
    try { const d = await api("/attendance?date=" + dkey(new Date()) + "&limit=10"); setRecent({ count: d.count, list: d.attendance }); } catch {}
  }, []);

  const scan = useCallback(async () => {
    if (busy.current || Date.now() < hold.current) return;
    busy.current = true; setHint("Scanning...");
    try {
      const f = new FormData(); f.append("frame", await cam.snap(), "frame.jpg");
      const d = await api("/attendance/recognize", { method: "POST", form: f });
      const sim = typeof d.attendance.similarity === "number" ? " Match confidence " + Math.round(d.attendance.similarity * 100) + "%." : "";
      show("ok", "Welcome, " + d.student.name, "Attendance marked at " + tm(d.attendance.markedAt) + ". Class " + (d.student.className || "not set") + ", ID " + d.student.studentId + "." + sim);
      hold.current = Date.now() + 5000; loadRecent(); setHint("Looking for a face");
    } catch (e) {
      setHint("Looking for a face");
      if (e.status === 409 && e.data?.student) { show("warn", e.data.student.name, "Attendance was already marked today."); hold.current = Date.now() + 5000; }
      else if (e.status === 422 && e.data?.faceService?.face_detected === false) setHint("No face in view");
      else if (e.status === 422) { show("bad", "Face not recognised", e.message + " Ask an admin to enroll this student."); hold.current = Date.now() + 3000; }
      else if (e.status === 429) { setHint("Too many scans. Pausing for 10 seconds."); hold.current = Date.now() + 10000; }
      else { show("bad", "Scan failed", e.message); hold.current = Date.now() + 4000; }
    } finally { busy.current = false; }
  }, [cam.snap, loadRecent]);

  useEffect(() => { loadRecent(); }, [loadRecent]);
  useEffect(() => {
    if (!cam.on || !auto) return;
    const id = setInterval(scan, 3000);
    return () => clearInterval(id);
  }, [cam.on, auto, scan]);

  const toggle = async () => {
    if (cam.on) { cam.stop(); setHint("Camera is off"); return; }
    try { await cam.start(); setHint("Looking for a face"); }
    catch { toast("Camera blocked. Allow camera access and open the site at http://localhost:5173.", "bad"); }
  };

  return (
    <div className="kiosk">
      <section>
        <div className={"cam" + (cam.on ? " live" : "")}>
          <video ref={cam.ref} playsInline muted />
          <div className="frame"><i /><i /><i /><i /><b className="sweep" /></div>
          <div className="hint">{hint}</div>
        </div>
        <div className="ctl">
          <button className="btn pri" onClick={toggle}>{cam.on ? "Stop camera" : "Start camera"}</button>
          <button className="btn" disabled={!cam.on} onClick={() => { hold.current = 0; scan(); }}>Scan now</button>
          <label><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />Scan automatically every 3 seconds</label>
        </div>
      </section>
      <aside>
        <div key={res.n} className={"res " + res.k}><h2>{res.t}</h2><p className={res.k ? "" : "muted"}>{res.p}</p></div>
        <h3>Marked today <span className="muted">({recent.count})</span></h3>
        <ul className="list">
          {recent.list.map((a) => <li key={a._id}><span>{a.student?.name || a.studentId}</span><span className="muted">{tm(a.markedAt)}</span></li>)}
          {!recent.list.length && <li className="muted">No one yet today.</li>}
        </ul>
      </aside>
    </div>
  );
}
