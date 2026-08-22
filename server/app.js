import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import authRoutes from "./routes/auth.js";
import menuRoutes from "./routes/menu.js";
import userRoutes from "./routes/users.js";
import productRoutes from "./routes/products.js";
import orderRoutes from "./routes/orders.js";
import uploadRoutes from "./routes/upload.js";

dotenv.config();

const app = express();

// Middleware
app.use(cors({ origin: "*" }));
app.use(express.json());

// API Status Healthcheck
app.get("/api/health", (req, res) => {
  res.json({
    status: "online",
    service: "Marvel E-Commerce Express Backend API",
    architecture: "Frontend (React) -> Backend (Express REST API) -> Cloudinary / Supabase DB",
    roles_supported: ["user", "vendor", "admin", "super_admin"],
    cloudinary_active: Boolean(process.env.CLOUDINARY_CLOUD_NAME),
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/upload", uploadRoutes);

// Fallback Route for unhandled /api requests
app.use("/api/*", (req, res) => {
  res.status(404).json({ error: `API route '${req.originalUrl}' not found.` });
});

export default app;
