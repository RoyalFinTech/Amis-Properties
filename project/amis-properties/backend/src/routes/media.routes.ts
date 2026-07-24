import { Router } from "express";
import multer from "multer";
import path from "path";
import { requireAuth, requireRole } from "../middleware/auth";
import { env } from "../config/env";

const router = Router();

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "application/pdf",
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.join(process.cwd(), "uploads")),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, "-")}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error("Unsupported file type"));
    }
    cb(null, true);
  },
});

/**
 * Uploads a property image/video/floor-plan/brochure.
 * Files are saved locally in /uploads by default. To use Cloudinary instead,
 * set CLOUDINARY_* in .env and swap this handler for a Cloudinary upload stream
 * (left as a clearly-marked integration point rather than faked).
 */
router.post(
  "/upload",
  requireAuth,
  requireRole("AGENT", "ADMIN", "SUPER_ADMIN"),
  upload.single("file"),
  (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    if (env.CLOUDINARY_CLOUD_NAME) {
      // TODO: stream req.file.buffer to Cloudinary once CLOUDINARY_* keys are set,
      // then return the returned secure_url instead of the local path below.
    }

    const url = `/uploads/${req.file.filename}`;
    res.status(201).json({ url, mimeType: req.file.mimetype, size: req.file.size });
  }
);

export default router;
