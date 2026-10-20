import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import authRoutes from "./routes/auth.js";
import menuRoutes from "./routes/menu.js";
import contentRoutes from "./routes/content.js";
import userRoutes from "./routes/users.js";
import productRoutes from "./routes/products.js";
import orderRoutes from "./routes/orders.js";
import uploadRoutes from "./routes/upload.js";
import { assertJwtSecret } from "./middleware/auth.js";

dotenv.config();
assertJwtSecret();

const app = express();

const DEFAULT_ALLOWED_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];

function allowedOrigins() {
  const configured = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return configured.length > 0 ? configured : DEFAULT_ALLOWED_ORIGINS;
}

// Middleware
app.use(
  cors({
    origin(origin, callback) {
      // Same-origin and non-browser callers send no Origin header.
      if (!origin || allowedOrigins().includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// API Status Healthcheck
app.get("/api/health", (req, res) => {
  res.json({
    status: "online",
    service: "Marvel E-Commerce Express Backend API",
    architecture: "Frontend (React) -> Backend (Express REST API) -> Cloudinary / Supabase DB",
    roles_supported: ["user", "vendor", "admin", "super_admin"],
    cloudinary_active: Boolean(process.env.CLOUDINARY_CLOUD_NAME),
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/content", contentRoutes);
app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/upload", uploadRoutes);

// Fallback Route for unhandled /api requests
app.use("/api/*", (req, res) => {
  res.status(404).json({ error: `API route '${req.originalUrl}' not found.` });
});

// Terminal error handler: always answer with JSON, never Express's HTML page.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  console.error("[api] unhandled error:", err);
  res.status(err.status || 500).json({ error: err.message || "Internal server error." });
});

export default app;
