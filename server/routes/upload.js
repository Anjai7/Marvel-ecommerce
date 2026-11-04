import express from "express";
import multer from "multer";
import { uploadBufferToCloudinary, isConfigured } from "../services/cloudinary.js";
import { verifyToken, requireRole } from "../middleware/auth.js";

const router = express.Router();

// Cloudinary destination folders are server-owned; a client cannot point an
// upload at an arbitrary folder such as "../secret".
const ALLOWED_FOLDERS = new Set([
  "marvel_products",
  "marvel_content",
  "marvel_banners",
  "marvel_hero",
]);
const DEFAULT_FOLDER = "marvel_products";

function resolveFolder(requested) {
  return typeof requested === "string" && ALLOWED_FOLDERS.has(requested)
    ? requested
    : DEFAULT_FOLDER;
}

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

// Configure Multer storage in memory
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB maximum file size
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      // A client mistake, not a server fault: the terminal handler answers with
      // err.status so this must not surface as a 500.
      const error = new Error("Only image files are allowed.");
      error.status = 400;
      cb(error);
    }
  },
});

// POST /api/upload (Upload image to Cloudinary)
router.post(
  "/",
  verifyToken,
  requireRole(["admin", "super_admin", "vendor"]),
  (req, res, next) => {
    upload.single("image")(req, res, (err) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ error: "Image file size must not exceed 5MB." });
        }
        return res
          .status(err.status || 400)
          .json({ error: err.message || "Failed to process image." });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file provided in request." });
      }

      const folder = resolveFolder(req.body.folder);
      const uploadResult = await uploadBufferToCloudinary(req.file.buffer, folder);

      res.json({
        success: true,
        message: isConfigured
          ? "Image uploaded to Cloudinary successfully"
          : "Image processed via fallback CDN",
        url: uploadResult.url,
        public_id: uploadResult.public_id,
        format: uploadResult.format,
        bytes: uploadResult.bytes,
        provider: isConfigured ? "cloudinary" : "fallback_cdn",
      });
    } catch (error) {
      console.error("Upload route error:", error);
      res.status(500).json({ error: error.message || "Failed to upload image." });
    }
  }
);

export default router;
