import { useEffect, useState } from "react";
import { S, api, on, setSession, toast } from "./lib.js";
import Kiosk from "./Kiosk.jsx";
import Dashboard from "./Dashboard.jsx";
import Students from "./Students.jsx";
import Records from "./Records.jsx";

const pages = { kiosk: ["Live attendance", Kiosk], dashboard: ["Dashboard", Dashboard], students: ["Students", Students], records: ["Records", Records] };

function useHash() {
  const [h, setH] = useState(location.hash);
  useEffect(() => { const f = () => setH(location.hash); addEventListener("hashchange", f); return () => removeEventListener("hashchange", f); }, []);
  return h.replace("#/", "") || "kiosk";
}

function Login() {
  const [setup, setSetup] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    try {
      if (setup) await api("/auth/setup", { method: "POST", body: f });
      const d = await api("/auth/login", { method: "POST", body: { email: f.email, password: f.password } });
      location.hash = "#/kiosk";
      setSession(d.token, d.user);
    } catch (err) { toast(err.message, "bad"); if (err.status === 409 && setup) setSetup(false); }
  };
  return (
    <div className="login">
      <section className="hero">
        <h1>Attendance that takes one look.</h1>
        <p>Walk up, face the camera, and your attendance is recorded. No cards, no roll call.</p>
        <div className="pipe">
          <div><b>Capture</b><span>The browser grabs a frame from the webcam.</span></div>
          <div><b>Detect and match</b><span>A Python service finds the face and compares it with enrolled students.</span></div>
          <div><b>Record</b><span>The server saves one attendance entry per student per day in MongoDB.</span></div>
        </div>
      </section>
      <section className="box">
        <form onSubmit={submit} key={String(setup)}>
          <h2>{setup ? "Create the admin account" : "Sign in"}</h2>
          {setup && <label className="f">Name<input name="name" required /></label>}
          <label className="f">Email<input name="email" type="email" required /></label>
          <label className="f">Password<input name="password" type="password" required minLength={setup ? 12 : undefined} /></label>
          {setup && <p className="muted">Use at least 12 characters.</p>}
          <button className="btn pri" style={{ width: "100%" }}>{setup ? "Create admin and sign in" : "Sign in"}</button>
          <button type="button" className="link" onClick={() => setSetup(!setup)}>{setup ? "I already have an account" : "First time? Set up the admin account"}</button>
        </form>
      </section>
    </div>
  );
}

export default function App() {
  const page = useHash();
  const [, force] = useState(0);
  const [toasts, setToasts] = useState([]);
  useEffect(() => on("auth", () => force((n) => n + 1)), []);
  useEffect(() => on("toast", (t) => {
    const id = Math.random();
    setToasts((l) => [...l, { ...t, id }]);
    setTimeout(() => setToasts((l) => l.filter((x) => x.id !== id)), 4200);
  }), []);

  const name = pages[page] ? page : "kiosk";
  const Page = pages[name][1];
  return (
    <>
      {!S.token ? <Login /> : (
        <>
          <header>
            <span className="brand">Smart Attendance</span>
            <nav>{Object.entries(pages).map(([k, [label]]) => <a key={k} href={"#/" + k} className={k === name ? "on" : ""}>{label}</a>)}</nav>
            <span className="who">{S.user?.name} ({S.user?.role})<button className="btn sm" onClick={() => setSession("", null)}>Sign out</button></span>
          </header>
          <main><Page key={name} /></main>
        </>
      )}
      <div id="toast">{toasts.map((t) => <div key={t.id} className={t.type}>{t.msg}</div>)}</div>
    </>
  );
}
