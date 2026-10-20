import crypto from "node:crypto";
import express from "express";
import { supabase } from "../db.js";
import { signUserToken, verifyToken } from "../middleware/auth.js";

const router = express.Router();

// POST /api/auth/login (Real DB Authentication with signed JWT token)
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  try {
    // 1. Authenticate with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (authError || !authData?.user) {
      return res.status(401).json({
        error: "Invalid email or password. Please check your credentials.",
      });
    }

    const userId = authData.user.id;

    // 2. Fetch live profile & role from Supabase DB
    let { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      // Fallback to auth metadata if profile query failed
      const meta = authData.user.user_metadata || {};
      profile = {
        id: userId,
        email: authData.user.email,
        full_name: meta.full_name || authData.user.email,
        role: meta.role || "user",
        store_name: meta.store_name || null,
      };
    }

    // 3. Issue cryptographically signed JWT token with true DB role
    const token = signUserToken({
      id: profile.id,
      email: profile.email,
      role: profile.role,
      full_name: profile.full_name,
      store_name: profile.store_name,
    });

    res.json({
      message: "Login successful",
      token,
      user: {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        role: profile.role,
        store_name: profile.store_name,
      },
    });
  } catch (err) {
    console.error("Login route error:", err);
    res.status(500).json({ error: err.message || "Internal authentication error." });
  }
});

// POST /api/auth/signup (Public signup strictly limited to User & Vendor)
router.post("/signup", async (req, res) => {
  const { email, password, fullName, role = "user", storeName = "" } = req.body;

  if (!email || !password || !fullName) {
    return res.status(400).json({ error: "Name, email, and password are required." });
  }

  // 🔒 Security Restriction: Public signup cannot create admin or super_admin accounts
  const sanitizedRole = (role || "user").toLowerCase().trim();
  if (
    sanitizedRole === "admin" ||
    sanitizedRole === "super_admin" ||
    sanitizedRole === "moderator"
  ) {
    return res.status(403).json({
      error:
        "Public registration is limited to Customer and Vendor accounts only. Admin accounts must be created by an existing administrator from the Admin Console.",
    });
  }

  const validRole = sanitizedRole === "vendor" ? "vendor" : "user";

  try {
    // Register via Supabase Admin API
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: validRole,
        store_name: validRole === "vendor" ? storeName || `${fullName}'s Store` : null,
      },
    });

    if (createError) {
      return res.status(400).json({ error: createError.message });
    }

    const newUser = createData.user;
    const resolvedStore = validRole === "vendor" ? storeName || `${fullName}'s Store` : null;

    // Upsert into profiles table
    await supabase.from("profiles").upsert({
      id: newUser.id,
      email: newUser.email,
      full_name: fullName,
      role: validRole,
      store_name: resolvedStore,
      status: "active",
      updated_at: new Date().toISOString(),
    });

    // Issue JWT token
    const token = signUserToken({
      id: newUser.id,
      email: newUser.email,
      role: validRole,
      full_name: fullName,
      store_name: resolvedStore,
    });

    res.status(201).json({
      message: "User registered successfully",
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        full_name: fullName,
        role: validRole,
        store_name: resolvedStore,
      },
    });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: err.message || "Failed to create account in database." });
  }
});

const RESET_REQUEST_MESSAGE = "If this email is registered, a reset link has been sent.";
const INVALID_RESET_TOKEN_MESSAGE = "Invalid or expired reset token.";
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

// POST /api/auth/request-reset (Password reset request)
// Always answers with the same body so the response never reveals whether the
// email belongs to an account.
router.post("/request-reset", async (req, res) => {
  const { email } = req.body || {};
  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "Email is required." });
  }

  try {
    const cleanEmail = email.trim().toLowerCase();
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (profile) {
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString();
      const { error: insertError } = await supabase.from("password_reset_tokens").insert({
        user_id: profile.id,
        token,
        expires_at: expiresAt,
      });

      if (insertError) {
        console.error("Password reset token insert failed:", insertError.message);
      }
    }
  } catch (err) {
    // Log without echoing details; the caller still receives the neutral body.
    console.error("Password reset request error:", err);
  }

  res.json({ message: RESET_REQUEST_MESSAGE });
});

// POST /api/auth/reset-password (Set new password with a single-use token)
router.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body || {};

  if (!token || typeof token !== "string") {
    return res.status(400).json({ error: INVALID_RESET_TOKEN_MESSAGE });
  }

  if (typeof newPassword !== "string" || newPassword.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }

  try {
    const { data: resetToken, error: tokenError } = await supabase
      .from("password_reset_tokens")
      .select("id, user_id, expires_at, used_at")
      .eq("token", token)
      .maybeSingle();

    if (tokenError) {
      console.error("Password reset token lookup failed:", tokenError.message);
      return res.status(500).json({ error: "Failed to reset password." });
    }

    const expiresAtMs = resetToken ? new Date(resetToken.expires_at).getTime() : Number.NaN;

    if (
      !resetToken ||
      resetToken.used_at ||
      !Number.isFinite(expiresAtMs) ||
      expiresAtMs < Date.now()
    ) {
      return res.status(400).json({ error: INVALID_RESET_TOKEN_MESSAGE });
    }

    const usedAt = new Date().toISOString();

    // Consume the token before changing the password so it cannot be replayed.
    const { error: consumeError } = await supabase
      .from("password_reset_tokens")
      .update({ used_at: usedAt })
      .eq("id", resetToken.id);

    if (consumeError) {
      console.error("Password reset token consume failed:", consumeError.message);
      return res.status(500).json({ error: "Failed to reset password." });
    }

    const { error: updateErr } = await supabase.auth.admin.updateUserById(resetToken.user_id, {
      password: newPassword,
    });

    if (updateErr) {
      return res.status(500).json({ error: updateErr.message });
    }

    // Every other outstanding token for this user is now invalid.
    const { error: invalidateError } = await supabase
      .from("password_reset_tokens")
      .update({ used_at: usedAt })
      .eq("user_id", resetToken.user_id)
      .neq("id", resetToken.id);

    if (invalidateError) {
      console.error("Password reset token invalidation failed:", invalidateError.message);
    }

    res.json({
      message:
        "Password has been successfully updated. You can now sign in with your new password.",
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to reset password." });
  }
});

// GET /api/auth/me (Restore live session via JWT Token)
router.get("/me", verifyToken, async (req, res) => {
  try {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", req.user.id)
      .single();

    if (error || !profile) {
      return res.json({ user: req.user });
    }

    res.json({
      user: {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        role: profile.role,
        store_name: profile.store_name,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to restore user session." });
  }
});

export default router;
