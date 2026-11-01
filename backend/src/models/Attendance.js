import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true, index: true },
    studentId: { type: String, required: true, index: true },
    dateKey: { type: String, required: true }, // YYYY-MM-DD in the configured server/business timezone
    markedAt: { type: Date, required: true, default: Date.now },
    status: { type: String, enum: ["present", "late"], default: "present" },
    similarity: { type: Number, min: -1, max: 1, default: null },
    source: { type: String, enum: ["face"], default: "face" }
  },
  { timestamps: true }
);

attendanceSchema.index({ student: 1, dateKey: 1 }, { unique: true });
export default mongoose.model("Attendance", attendanceSchema);
