import axios from "axios";
import FormData from "form-data";

const faceApiUrl = () => (process.env.FACE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

async function sendFrame(path, buffer, filename, extraFields = {}) {
  const form = new FormData();
  form.append("frame", buffer, { filename, contentType: "image/jpeg" });
  for (const [key, value] of Object.entries(extraFields)) form.append(key, value);

  const response = await axios.post(`${faceApiUrl()}${path}`, form, {
    headers: form.getHeaders(),
    timeout: 30_000,
    maxBodyLength: 10 * 1024 * 1024
  });
  return response.data;
}

export function recognizeFrame(buffer, filename = "frame.jpg") {
  return sendFrame("/face/recognize", buffer, filename);
}

export function enrollFace(studentId, buffer, filename = "enrollment.jpg") {
  return sendFrame("/face/enroll", buffer, filename, { student_id: studentId });
}
