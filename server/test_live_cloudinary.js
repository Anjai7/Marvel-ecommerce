import dotenv from "dotenv";
import { uploadBufferToCloudinary } from "./services/cloudinary.js";

dotenv.config();

async function testLiveCloudinary() {
  console.log("☁️ Testing Live Cloudinary Direct SDK Upload...");
  console.log("Cloud Name:", process.env.CLOUDINARY_CLOUD_NAME);

  // 1x1 green PNG
  const testBuffer = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64"
  );

  try {
    const res = await uploadBufferToCloudinary(testBuffer, "marvel_products");
    console.log("🎉 Direct Cloudinary Upload Success!");
    console.log("🔗 Secure HTTPS CDN URL:", res.url);
    console.log("🆔 Public ID:", res.public_id);
    console.log("📦 Format:", res.format, "Bytes:", res.bytes);
  } catch (err) {
    console.error("❌ Cloudinary upload failed:", err);
  }
}

testLiveCloudinary();
