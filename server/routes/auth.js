import express from "express";
import { supabase } from "../db.js";
import { signUserToken, verifyToken } from "../middleware/auth.js";

const router = express.Router();

// POST /api/auth/login (Real DB Authentication with signed JWT token)
router.post("/login", async (req, res) => {
  const { email, password, expectedRole } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  try {
    // 1. Authenticate with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    });

    if (authError || !authData?.user) {
      return res.status(401).json({
        error: "Invalid email or password. Please check your credentials."
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
        store_name: meta.store_name || null
      };
    }

    // 3. Issue cryptographically signed JWT token with true DB role
    const token = signUserToken({
      id: profile.id,
      email: profile.email,
      role: profile.role,
      full_name: profile.full_name,
      store_name: profile.store_name
    });

    res.json({
      message: "Login successful",
      token,
      user: {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        role: profile.role,
        store_name: profile.store_name
      }
    });
  } catch (err) {
    console.error("Login route error:", err);
    res.status(500).json({ error: err.message || "Internal authentication error." });
  }
});

// POST /api/auth/signup (Real Supabase User Registration + JWT Token)
router.post("/signup", async (req, res) => {
  const { email, password, fullName, role = "user", storeName = "" } = req.body;

  if (!email || !password || !fullName) {
    return res.status(400).json({ error: "Name, email, and password are required." });
  }

  try {
    // Register via Supabase Admin API
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role,
        store_name: role === "vendor" ? (storeName || `${fullName}'s Store`) : null
      }
    });

    if (createError) {
      return res.status(400).json({ error: createError.message });
    }

    const newUser = createData.user;
    const resolvedStore = role === "vendor" ? (storeName || `${fullName}'s Store`) : null;

    // Upsert into profiles table
    await supabase.from("profiles").upsert({
      id: newUser.id,
      email: newUser.email,
      full_name: fullName,
      role,
      store_name: resolvedStore,
      status: "active",
      updated_at: new Date().toISOString()
    });

    // Issue JWT token
    const token = signUserToken({
      id: newUser.id,
      email: newUser.email,
      role,
      full_name: fullName,
      store_name: resolvedStore
    });

    res.status(201).json({
      message: "User registered successfully",
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        full_name: fullName,
        role,
        store_name: resolvedStore
      }
    });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: err.message || "Failed to create account in database." });
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
        store_name: profile.store_name
      }
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to restore user session." });
  }
});

export default router;
