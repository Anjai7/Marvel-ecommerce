import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

const isConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (isConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
  console.log("☁️ Cloudinary SDK configured with cloud:", process.env.CLOUDINARY_CLOUD_NAME);
}

/**
 * Uploads an image buffer to Cloudinary with Authenticated / Private Access Control
 * @param {Buffer} buffer - Image file buffer
 * @param {string} folder - Destination folder on Cloudinary
 * @param {string} accessType - 'authenticated' | 'upload'
 * @returns {Promise<{url: string, signed_url: string, public_id: string, access_type: string}>}
 */
export async function uploadBufferToCloudinary(buffer, folder = "marvel_products", accessType = "authenticated") {
  if (isConfigured) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: "image",
          type: accessType, // "authenticated" prevents raw unauthenticated access
          transformation: [
            { quality: "auto", fetch_format: "auto" }
          ]
        },
        (error, result) => {
          if (error) {
            console.error("Cloudinary upload error:", error);
            return reject(error);
          }

          // Generate secure SHA-signed URL with timestamp
          const signedUrl = cloudinary.utils.url(result.public_id, {
            type: accessType,
            sign_url: true,
            secure: true,
            transformation: [{ quality: "auto", fetch_format: "auto" }]
          });

          resolve({
            url: signedUrl,
            raw_url: result.secure_url,
            signed_url: signedUrl,
            public_id: result.public_id,
            format: result.format,
            bytes: result.bytes,
            access_type: accessType
          });
        }
      );
      uploadStream.end(buffer);
    });
  }

  // Fallback demo CDN simulation if Cloudinary keys are absent
  const fallbackId = `cld-${Date.now()}`;
  return {
    url: `https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80`,
    signed_url: `https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80`,
    public_id: fallbackId,
    format: "webp",
    bytes: buffer.length,
    access_type: "authenticated"
  };
}

/**
 * Generates a signed delivery URL for a Cloudinary asset
 * @param {string} publicId - Cloudinary Public ID (e.g. marvel_products/abc123)
 * @param {string} accessType - 'authenticated' | 'upload'
 * @param {object} transformations - Optional resize/crop options
 * @returns {string} Signed HTTPS CDN URL
 */
export function getSignedCloudinaryUrl(publicId, accessType = "authenticated", transformations = {}) {
  if (!isConfigured || !publicId) {
    return publicId; // Return raw string if not configured
  }

  // If publicId is already a full signed URL or external URL, return as is
  if (publicId.startsWith("http://") || publicId.startsWith("https://")) {
    return publicId;
  }

  try {
    return cloudinary.utils.url(publicId, {
      type: accessType,
      sign_url: true,
      secure: true,
      transformation: [
        { quality: "auto", fetch_format: "auto", ...transformations }
      ]
    });
  } catch (err) {
    console.error("Error generating signed Cloudinary URL:", err);
    return publicId;
  }
}

export { cloudinary, isConfigured };
