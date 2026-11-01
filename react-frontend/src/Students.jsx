import { useEffect, useRef, useState } from "react";
import { api, isAdmin, toast, useCamera } from "./lib.js";

function Dialog({ onClose, children }) {
  const r = useRef();
  useEffect(() => { r.current.showModal(); }, []);
  return <dialog ref={r} onClose={onClose}>{children}</dialog>;
}

function AddDialog({ onClose, onDone }) {
  const submit = async (e) => {
    e.preventDefault();
    try { await api("/students", { method: "POST", body: Object.fromEntries(new FormData(e.target)) }); toast("Student saved. Now enroll a face.", "ok"); onDone(); }
    catch (err) { toast(err.message, "bad"); }
  };
  return (
    <Dialog onClose={onClose}>
      <form onSubmit={submit}>
        <h2 style={{ marginBottom: 16 }}>Add student</h2>
        <label className="f">Student ID<input name="studentId" required /></label>
        <label className="f">Full name<input name="name" required /></label>
        <label className="f">Class<input name="className" /></label>
        <label className="f">Email (optional)<input name="email" type="email" /></label>
        <div className="row sp"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn pri">Save student</button></div>
      </form>
    </Dialog>
  );
}

function FaceDialog({ student, onClose, onDone }) {
  const cam = useCamera();
  useEffect(() => { cam.start().catch(() => toast("No camera. Upload a photo instead.", "bad")); }, []);
  const send = async (blob) => {
    const f = new FormData(); f.append("frame", blob, "enroll.jpg");
    try { await api("/students/" + student._id + "/face", { method: "POST", form: f }); toast("Face enrolled for " + student.name, "ok"); onDone(); }
    catch (err) { toast(err.message, "bad"); }
  };
  return (
    <Dialog onClose={onClose}>
      <h2 style={{ marginBottom: 4 }}>Enroll face</h2>
      <p className="muted" style={{ marginTop: 0 }}>{student.name}. One clear photo with only this person in frame.</p>
      <video ref={cam.ref} playsInline muted />
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn pri" onClick={async () => cam.on ? send(await cam.snap()) : toast("Camera is not ready.", "bad")}>Capture and enroll</button>
        <label className="btn">Upload photo<input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => e.target.files[0] && send(e.target.files[0])} /></label>
        <button className="btn" onClick={onClose}>Close</button>
      </div>
    </Dialog>
  );
}

export default function Students() {
  const [list, setList] = useState([]);
  const [q, setQ] = useState("");
  const [dlg, setDlg] = useState(null);
  const load = () => api("/students").then((d) => setList(d.students)).catch((e) => toast(e.message, "bad"));
  useEffect(() => { load(); }, []);
  const done = () => { setDlg(null); load(); };
  const toggle = async (s) => { try { await api("/students/" + s._id, { method: "PATCH", body: { active: !s.active } }); load(); } catch (e) { toast(e.message, "bad"); } };
  const rows = list.filter((x) => (x.name + x.studentId + x.className).toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <div className="row sp" style={{ marginBottom: 16 }}>
        <input placeholder="Search by name, ID or class" style={{ maxWidth: 340 }} value={q} onChange={(e) => setQ(e.target.value)} />
        {isAdmin() && <button className="btn pri" onClick={() => setDlg({ add: true })}>Add student</button>}
      </div>
      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        <table>
          <thead><tr><th>ID</th><th>Name</th><th>Class</th><th>Face</th><th>Status</th><th /></tr></thead>
          <tbody>
            {rows.map((x) => (
              <tr key={x._id}>
                <td>{x.studentId}</td><td>{x.name}</td><td>{x.className}</td>
                <td><span className={"tag " + (x.faceEnrolled ? "g" : "y")}>{x.faceEnrolled ? "Enrolled" : "Not enrolled"}</span></td>
                <td><span className={"tag " + (x.active ? "g" : "r")}>{x.active ? "Active" : "Inactive"}</span></td>
                <td>{isAdmin() && <>
                  <button className="btn sm" onClick={() => setDlg({ face: x })}>{x.faceEnrolled ? "Re-enroll face" : "Enroll face"}</button>{" "}
                  <button className="btn sm" onClick={() => toggle(x)}>{x.active ? "Deactivate" : "Activate"}</button>
                </>}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan="6" className="muted">No students yet. Add one, then enroll a face.</td></tr>}
          </tbody>
        </table>
      </div>
      {dlg?.add && <AddDialog onClose={() => setDlg(null)} onDone={done} />}
      {dlg?.face && <FaceDialog student={dlg.face} onClose={() => setDlg(null)} onDone={done} />}
    </>
  );
}
