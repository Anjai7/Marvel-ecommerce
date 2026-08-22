import app from "./app.js";
import dotenv from "dotenv";

dotenv.config();

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Marvel Dedicated Backend API Server running on port ${PORT}`);
  console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
  console.log(`☁️ Cloudinary Upload Endpoint: http://localhost:${PORT}/api/upload`);
  console.log(`=======================================================`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n⚠️  Port ${PORT} is already in use by another process.`);
    console.error(`   To free port ${PORT}, run: npx kill-port ${PORT} or fuser -k ${PORT}/tcp\n`);
  } else {
    console.error("Server startup error:", err);
  }
  process.exit(1);
});
