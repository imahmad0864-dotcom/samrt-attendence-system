import { useRef, useState, useCallback, useEffect } from "react";

export const S = {
  token: localStorage.sa_token || "",
  user: JSON.parse(localStorage.sa_user || "null"),
  api: localStorage.sa_api || import.meta.env.VITE_API_URL || "http://localhost:5000/api",,
};
export const pad = (n) => String(n).padStart(2, "0");
export const dkey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const tm = (d) => new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
export const isAdmin = () => S.user?.role === "admin";

const bus = new EventTarget();
export const toast = (msg, type = "") => bus.dispatchEvent(new CustomEvent("toast", { detail: { msg, type } }));
export const on = (name, fn) => {
  const h = (e) => fn(e.detail);
  bus.addEventListener(name, h);
  return () => bus.removeEventListener(name, h);
};

export function setSession(token, user) {
  S.token = token; S.user = user;
  if (token) { localStorage.sa_token = token; localStorage.sa_user = JSON.stringify(user); }
  else { localStorage.removeItem("sa_token"); localStorage.removeItem("sa_user"); }
  bus.dispatchEvent(new CustomEvent("auth"));
}

export async function api(path, { method = "GET", body, form } = {}) {
  const h = {};
  if (S.token) h.Authorization = "Bearer " + S.token;
  let b;
  if (form) b = form;
  else if (body) { h["Content-Type"] = "application/json"; b = JSON.stringify(body); }
  let r;
  try { r = await fetch(S.api + path, { method, headers: h, body: b }); }
  catch { throw { status: 0, message: "Cannot reach the backend at " + S.api + ". Start the Express server first." }; }
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && S.token && path !== "/auth/login") {
    setSession("", null);
    throw { status: 401, message: "Session expired. Sign in again." };
  }
  if (!r.ok) throw { status: r.status, message: d.message || "Request failed (" + r.status + ")", data: d };
  return d;
}

export function useCamera() {
  const ref = useRef(null), st = useRef(null);
  const [on, setOn] = useState(false);
  const stop = useCallback(() => { st.current?.getTracks().forEach((t) => t.stop()); st.current = null; setOn(false); }, []);
  const start = useCallback(async () => {
    const s = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 960 }, height: { ideal: 720 }, facingMode: "user" } });
    st.current = s; ref.current.srcObject = s; await ref.current.play(); setOn(true);
  }, []);
  const snap = useCallback(() => {
    const v = ref.current, c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    return new Promise((r) => c.toBlob(r, "image/jpeg", 0.88));
  }, []);
  useEffect(() => stop, [stop]);
  return { ref, on, start, stop, snap };
}
