import express from "express";
import { supabase } from "../db.js";
import { getSignedCloudinaryUrl } from "../services/cloudinary.js";

const router = express.Router();

// Helper to format product data with signed Cloudinary CDN image URLs
function formatProduct(p) {
  let displayImage = p.image_url;

  // If product has a Cloudinary public ID, ensure a freshly signed URL is generated
  if (p.cloudinary_public_id) {
    displayImage = getSignedCloudinaryUrl(p.cloudinary_public_id, p.access_type || "authenticated");
  } else if (p.image_url && p.image_url.includes("cloudinary.com") && !p.image_url.includes("s--")) {
    // If it's an authenticated Cloudinary URL without signature, extract public ID and sign it
    const parts = p.image_url.split("/upload/");
    if (parts.length === 2) {
      const publicIdWithExt = parts[1].replace(/^v\d+\//, "");
      const publicId = publicIdWithExt.substring(0, publicIdWithExt.lastIndexOf(".")) || publicIdWithExt;
      displayImage = getSignedCloudinaryUrl(publicId, p.access_type || "authenticated");
    }
  }

  return {
    ...p,
    price: parseFloat(p.price) || 0,
    original_price: p.original_price ? parseFloat(p.original_price) : undefined,
    stock: parseInt(p.stock, 10) || 0,
    rating: parseFloat(p.rating) || 4.8,
    reviews_count: parseInt(p.reviews_count, 10) || 0,
    image_url: displayImage || p.image_url,
    image: displayImage || p.image_url // compatible with components expecting .image or .image_url
  };
}

// GET /api/products (100% Dynamic from Supabase DB)
router.get("/", async (req, res) => {
  try {
    const { vendorId, category, moderation_status, search, is_featured } = req.query;

    let query = supabase.from("products").select("*").order("created_at", { ascending: false });

    if (vendorId) {
      query = query.eq("vendor_id", vendorId);
    }

    if (category && category !== "All") {
      query = query.ilike("category", category);
    }

    if (moderation_status) {
      query = query.eq("moderation_status", moderation_status);
    }

    if (is_featured !== undefined) {
      query = query.eq("is_featured", is_featured === "true");
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Supabase products query error:", error);
      return res.status(500).json({ error: error.message });
    }

    const formatted = (data || []).map(formatProduct);
    res.json(formatted);
  } catch (err) {
    console.error("Products GET route error:", err);
    res.status(500).json({ error: "Failed to fetch products from database." });
  }
});

// GET /api/products/:id
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase.from("products").select("*").eq("id", id).single();

    if (error || !data) {
      return res.status(404).json({ error: "Product not found." });
    }

    res.json(formatProduct(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products (Create dynamic product in Supabase DB)
router.post("/", async (req, res) => {
  try {
    const {
      title,
      price,
      original_price,
      category = "Electronics",
      stock = 10,
      description = "",
      image_url = "",
      cloudinary_public_id = "",
      access_type = "authenticated",
      vendor_id,
      vendor_name = "TechGear Electronics",
      is_featured = false
    } = req.body;

    if (!title || !price) {
      return res.status(400).json({ error: "Product title and price are required." });
    }

    const newProductRecord = {
      title,
      price: parseFloat(price),
      original_price: original_price ? parseFloat(original_price) : parseFloat(price) * 1.25,
      category,
      stock: parseInt(stock, 10) || 10,
      rating: 4.9,
      reviews_count: 1,
      image_url: image_url || "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800",
      cloudinary_public_id: cloudinary_public_id || undefined,
      access_type,
      description,
      vendor_id: vendor_id || null,
      vendor_name,
      moderation_status: "approved",
      is_featured: Boolean(is_featured),
      status: "active"
    };

    const { data, error } = await supabase
      .from("products")
      .insert([newProductRecord])
      .select()
      .single();

    if (error) {
      console.error("Supabase insert product error:", error);
      return res.status(500).json({ error: error.message });
    }

    res.status(201).json({ message: "Product created in Supabase", product: formatProduct(data) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/products/:id (Update product in Supabase DB)
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    if (updates.price !== undefined) updates.price = parseFloat(updates.price);
    if (updates.original_price !== undefined) updates.original_price = parseFloat(updates.original_price);
    if (updates.stock !== undefined) updates.stock = parseInt(updates.stock, 10);

    const { data, error } = await supabase
      .from("products")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ message: "Product updated in database", product: formatProduct(data) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/products/:id/moderation (Admin moderation approval & featured flag)
router.patch("/:id/moderation", async (req, res) => {
  try {
    const { id } = req.params;
    const { moderation_status, is_featured } = req.body;

    const updates = {};
    if (moderation_status) updates.moderation_status = moderation_status;
    if (is_featured !== undefined) updates.is_featured = is_featured;

    const { data, error } = await supabase
      .from("products")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ message: "Moderation status updated", product: formatProduct(data) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/products/:id (Delete product from Supabase DB)
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from("products").delete().eq("id", id);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ message: "Product deleted from database successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
