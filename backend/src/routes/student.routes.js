import { Router } from "express";
import Student from "../models/Student.js";
import Attendance from "../models/Attendance.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { imageUpload } from "../utils/upload.js";
import { enrollFace } from "../services/faceApi.service.js";

const router = Router();
router.use(requireAuth);

// List students; optional search by name, ID, or class.
router.get("/", async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.active === "true") filter.active = true;
    if (req.query.active === "false") filter.active = false;
    if (req.query.q) {
      const q = String(req.query.q).trim();
      filter.$or = [
        { studentId: { $regex: q, $options: "i" } },
        { name: { $regex: q, $options: "i" } },
        { className: { $regex: q, $options: "i" } }
      ];
    }
    const students = await Student.find(filter).sort({ name: 1 }).limit(500);
    res.json({ success: true, count: students.length, students });
  } catch (err) { next(err); }
});

router.get("/:id", async (req, res, next) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: "Student not found." });
    res.json({ success: true, student });
  } catch (err) { next(err); }
});

// Create student metadata first. Then enroll a face via POST /:id/face.
router.post("/", requireAdmin, async (req, res, next) => {
  try {
    const { studentId, name, email = "", className = "" } = req.body;
    if (!studentId || !name) {
      return res.status(400).json({ success: false, message: "studentId and name are required." });
    }
    const student = await Student.create({ studentId, name, email, className });
    res.status(201).json({ success: true, student });
  } catch (err) { next(err); }
});

// Send a single clear face image to FastAPI to enroll the student.
router.post("/:id/face", requireAdmin, imageUpload.single("frame"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "A frame image is required in field 'frame'." });
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: "Student not found." });
    if (!student.active) return res.status(409).json({ success: false, message: "Cannot enroll an inactive student." });

    const result = await enrollFace(student.studentId, req.file.buffer, req.file.originalname || "enrollment.jpg");
    if (!result.success || !result.enrolled) {
      return res.status(422).json({ success: false, message: result.message || "Face enrollment failed.", faceService: result });
    }

    student.faceEnrolled = true;
    await student.save();
    res.json({ success: true, message: "Student face enrolled.", student, faceService: result });
  } catch (err) {
    if (err.response?.data?.detail) {
      return res.status(err.response.status || 502).json({
        success: false,
        message: typeof err.response.data.detail === "string" ? err.response.data.detail : "Face service rejected the image."
      });
    }
    next(err);
  }
});

router.patch("/:id", requireAdmin, async (req, res, next) => {
  try {
    const allowed = ["name", "email", "className", "active"];
    const updates = {};
    for (const key of allowed) if (req.body[key] !== undefined) updates[key] = req.body[key];
    const student = await Student.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!student) return res.status(404).json({ success: false, message: "Student not found." });
    res.json({ success: true, student });
  } catch (err) { next(err); }
});

router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: "Student not found." });
    // Historical attendance is intentionally preserved.
    student.active = false;
    await student.save();
    res.json({ success: true, message: "Student deactivated. Historical attendance was preserved." });
  } catch (err) { next(err); }
});

export default router;
