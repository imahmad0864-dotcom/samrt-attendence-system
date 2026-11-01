import { Router } from "express";
import Attendance from "../models/Attendance.js";
import Student from "../models/Student.js";
import { requireAuth } from "../middleware/auth.js";
import { imageUpload } from "../utils/upload.js";
import { recognizeFrame } from "../services/faceApi.service.js";

const router = Router();
router.use(requireAuth);

function localDateKey(date = new Date()) {
  // Set TZ on the server if the institution needs a specific business timezone.
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Recognize a single frame, then let Express validate the student and write attendance.
router.post("/recognize", imageUpload.single("frame"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "A frame image is required in field 'frame'." });

    let result;
    try {
      result = await recognizeFrame(req.file.buffer, req.file.originalname || "frame.jpg");
    } catch (err) {
      if (err.response?.data?.detail) {
        return res.status(err.response.status || 502).json({
          success: false,
          message: typeof err.response.data.detail === "string" ? err.response.data.detail : "Face service rejected the image."
        });
      }
      return res.status(502).json({ success: false, message: "Face recognition service unavailable." });
    }

    if (!result.face_detected) {
      return res.status(422).json({ success: false, message: result.message || "No face detected.", faceService: result });
    }
    if (!result.matched || !result.person_id) {
      return res.status(422).json({ success: false, message: result.message || "No matching student.", faceService: result });
    }

    const student = await Student.findOne({
      studentId: result.person_id,
      active: true,
      faceEnrolled: true
    });
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Recognized face does not map to an active enrolled student.",
        faceService: result
      });
    }

    const dateKey = localDateKey();
    let attendance;
    try {
      attendance = await Attendance.create({
        student: student._id,
        studentId: student.studentId,
        dateKey,
        similarity: typeof result.similarity === "number" ? result.similarity : null,
        status: "present"
      });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({
          success: false,
          message: "Attendance has already been marked for this student today.",
          student: { studentId: student.studentId, name: student.name },
          dateKey
        });
      }
      throw err;
    }

    res.status(201).json({
      success: true,
      message: "Attendance marked successfully.",
      student: { id: student.id, studentId: student.studentId, name: student.name, className: student.className },
      attendance
    });
  } catch (err) { next(err); }
});

router.get("/", async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.date) filter.dateKey = String(req.query.date);
    if (req.query.studentId) filter.studentId = String(req.query.studentId);
    const records = await Attendance.find(filter)
      .populate("student", "studentId name className")
      .sort({ markedAt: -1 })
      .limit(Math.min(Number(req.query.limit) || 100, 500));
    res.json({ success: true, count: records.length, attendance: records });
  } catch (err) { next(err); }
});

router.get("/student/:studentId", async (req, res, next) => {
  try {
    const records = await Attendance.find({ studentId: req.params.studentId })
      .sort({ markedAt: -1 })
      .limit(500);
    res.json({ success: true, count: records.length, attendance: records });
  } catch (err) { next(err); }
});

export default router;
