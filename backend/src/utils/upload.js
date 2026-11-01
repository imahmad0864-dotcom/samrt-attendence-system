import multer from "multer";

const maxMb = Number(process.env.MAX_FRAME_MB || 8);

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxMb * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      return cb(Object.assign(new Error("Upload a JPG, PNG, or WEBP image."), { status: 415 }));
    }
    cb(null, true);
  }
});
