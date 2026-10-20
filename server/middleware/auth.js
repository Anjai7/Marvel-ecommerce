import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const MIN_SECRET_LENGTH = 32;
// Generated once per process: a developer without JWT_SECRET still gets an
// unpredictable signing key instead of a published constant.
const DEV_FALLBACK_SECRET = crypto.randomBytes(48).toString("hex");
let warnedAboutDevFallback = false;

function configuredSecret() {
  const value = process.env.JWT_SECRET;
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed.length >= MIN_SECRET_LENGTH ? trimmed : "";
}

/**
 * Helper: Ensure a usable JWT_SECRET exists.
 * Throws in production when the secret is missing or shorter than 32 characters.
 * Outside production it warns once and falls back to a random per-process secret.
 */
export function assertJwtSecret() {
  if (configuredSecret()) return;

  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET is required and must be at least 32 characters long.");
  }

  if (!warnedAboutDevFallback) {
    warnedAboutDevFallback = true;
    console.warn(
      "⚠️ JWT_SECRET is missing or shorter than 32 characters. Using a random development-only signing secret; " +
        "tokens will not survive a process restart. Set JWT_SECRET before deploying."
    );
  }
}

function getJwtSecret() {
  assertJwtSecret();
  return configuredSecret() || DEV_FALLBACK_SECRET;
}

/**
 * Middleware: Verify JWT Bearer Token
 * Attaches decoded user payload ({ id, email, role, full_name, store_name }) to req.user
 */
export function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];

  if (!authHeader) {
    return res.status(401).json({ error: "Access denied. No authorization header provided." });
  }

  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Invalid authorization header." });
  }

  const token = authHeader.substring(7).trim();

  if (!token) {
    return res.status(401).json({ error: "Access denied. Malformed authorization token." });
  }

  const secret = getJwtSecret();

  try {
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res
        .status(401)
        .json({ error: "Authentication token has expired. Please sign in again." });
    }
    return res.status(401).json({ error: "Invalid authentication token signature." });
  }
}

/**
 * Middleware: Role-Based Access Control (RBAC)
 * @param {string[]} allowedRoles - Array of allowed user roles
 */
export function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required." });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden. Role '${req.user.role}' is not authorized to perform this operation. Required: [${allowedRoles.join(", ")}]`,
      });
    }

    next();
  };
}

/**
 * Helper: Sign a fresh JWT token
 * @param {object} userPayload - User data to embed in token
 * @returns {string} Signed JWT token (valid for 7 days)
 */
export function signUserToken(userPayload) {
  return jwt.sign(
    {
      id: userPayload.id,
      email: userPayload.email,
      role: userPayload.role || "user",
      full_name: userPayload.full_name || userPayload.email,
      store_name: userPayload.store_name || null,
    },
    getJwtSecret(),
    { expiresIn: "7d" }
  );
}
