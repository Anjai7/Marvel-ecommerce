import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "marvel_dev_jwt_secret_change_in_production";

/**
 * Middleware: Verify JWT Bearer Token
 * Attaches decoded user payload ({ id, email, role, full_name, store_name }) to req.user
 */
export function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];

  if (!authHeader) {
    return res.status(401).json({ error: "Access denied. No authorization header provided." });
  }

  const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader;

  if (!token) {
    return res.status(401).json({ error: "Access denied. Malformed authorization token." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Authentication token has expired. Please sign in again." });
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
        error: `Forbidden. Role '${req.user.role}' is not authorized to perform this operation. Required: [${allowedRoles.join(", ")}]`
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
      store_name: userPayload.store_name || null
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}
