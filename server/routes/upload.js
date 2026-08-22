import express from "express";
import multer from "multer";
import { uploadBufferToCloudinary, isConfigured } from "../services/cloudinary.js";

const router = express.Router();

// Configure Multer storage in memory
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB maximum file size
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed."));
    }
  }
});

// POST /api/upload (Upload image to Cloudinary)
router.post("/", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided in request." });
    }

    const folder = req.body.folder || "marvel_products";
    const uploadResult = await uploadBufferToCloudinary(req.file.buffer, folder);

    res.json({
      success: true,
      message: isConfigured ? "Image uploaded to Cloudinary successfully" : "Image processed via fallback CDN",
      url: uploadResult.url,
      public_id: uploadResult.public_id,
      format: uploadResult.format,
      bytes: uploadResult.bytes,
      provider: isConfigured ? "cloudinary" : "fallback_cdn"
    });
  } catch (error) {
    console.error("Upload route error:", error);
    res.status(500).json({ error: error.message || "Failed to upload image." });
  }
});

export default router;
