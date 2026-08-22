import { supabase } from "./db.js";
import { uploadBufferToCloudinary, cloudinary, isConfigured } from "./services/cloudinary.js";

const SYNTHETIC_PRODUCTS = [
  {
    title: "Apex Wireless Noise-Canceling Headphones Max",
    price: 249.99,
    original_price: 299.99,
    category: "Electronics",
    stock: 28,
    rating: 4.9,
    reviews_count: 184,
    description: "Industry-leading active noise cancellation with 45-hour battery life, spatial audio, and premium memory foam ear cushions.",
    is_featured: true,
    image_query: "wireless headphones"
  },
  {
    title: "Chronos OLED Smartwatch Ultra Sapphire",
    price: 389.00,
    original_price: 449.00,
    category: "Wearables",
    stock: 15,
    rating: 4.8,
    reviews_count: 92,
    description: "Always-on sapphire OLED display, dual-frequency GPS tracking, ECG heart monitoring, and 100m water resistance.",
    is_featured: true,
    image_query: "smartwatch"
  },
  {
    title: "CyberDeck RGB Mechanical Keyboard (Hot-Swap)",
    price: 139.50,
    original_price: 169.00,
    category: "Accessories",
    stock: 22,
    rating: 4.7,
    reviews_count: 76,
    description: "Gasket-mounted acoustic dampening, custom lubed linear switches, aluminum CNC chassis, and programmable per-key RGB.",
    is_featured: true,
    image_query: "mechanical keyboard"
  },
  {
    title: "VoltPro 100W GaN 4-Port Fast Desktop Charger",
    price: 49.99,
    original_price: 64.99,
    category: "Electronics",
    stock: 60,
    rating: 4.9,
    reviews_count: 215,
    description: "Next-gen Gallium Nitride (GaN III) high-speed charging for laptops, smartphones, and tablets simultaneously.",
    is_featured: false,
    image_query: "fast charger"
  },
  {
    title: "AeroPod Pro True Wireless Earbuds (Hi-Res Audio)",
    price: 129.00,
    original_price: 159.00,
    category: "Audio",
    stock: 35,
    rating: 4.8,
    reviews_count: 140,
    description: "Custom titanium drivers, lossless LDAC streaming codec, crystal-clear 6-mic beamforming ENC voice calls.",
    is_featured: true,
    image_query: "wireless earbuds"
  },
  {
    title: "OmniView 4K HDR USB-C Creator Webcam",
    price: 99.00,
    original_price: 129.00,
    category: "Electronics",
    stock: 19,
    rating: 4.6,
    reviews_count: 48,
    description: "AI auto-framing with Sony STARVIS sensor, 60fps HDR video capture, and dual noise-canceling stereo mics.",
    is_featured: false,
    image_query: "webcam streaming"
  },
  {
    title: "Lumina Smart RGB Ambience LED Desk Lightbar",
    price: 59.99,
    original_price: 79.99,
    category: "Smart Home",
    stock: 42,
    rating: 4.7,
    reviews_count: 63,
    description: "Screen-sync ambient lighting with touch dimmer controls, voice assistant support, and 16 million colors.",
    is_featured: true,
    image_query: "desk light lamp"
  },
  {
    title: "HyperGlide Wireless Gaming Mouse 26K DPI",
    price: 79.99,
    original_price: 99.99,
    category: "Accessories",
    stock: 30,
    rating: 4.8,
    reviews_count: 112,
    description: "Ultra-lightweight 58g ergonomic frame with 4000Hz polling rate optical switches and 80-hour battery life.",
    is_featured: false,
    image_query: "gaming mouse"
  },
  {
    title: "TitanFold Ergonomic Aluminum Laptop Stand",
    price: 34.99,
    original_price: 45.00,
    category: "Accessories",
    stock: 55,
    rating: 4.9,
    reviews_count: 310,
    description: "Aerospace-grade ventilated aluminum alloy with 360-degree rotating base and full height adjustability.",
    is_featured: false,
    image_query: "laptop stand"
  },
  {
    title: "SonicBoom 360 Waterproof Bluetooth Speaker",
    price: 89.99,
    original_price: 119.99,
    category: "Audio",
    stock: 25,
    rating: 4.8,
    reviews_count: 88,
    description: "IPX7 waterproof rugged design with 360-degree immersive bass sound and 24-hour non-stop playtime.",
    is_featured: true,
    image_query: "bluetooth speaker"
  },
  {
    title: "PulseFit Smart Fitness & Sleep Tracker Band",
    price: 69.99,
    original_price: 89.99,
    category: "Wearables",
    stock: 40,
    rating: 4.6,
    reviews_count: 55,
    description: "Continuous SpO2 blood oxygen tracking, heart rate variability stress monitor, and 14-day battery life.",
    is_featured: false,
    image_query: "fitness band tracker"
  },
  {
    title: "MagPower 10000mAh Magnetic Wireless Power Bank",
    price: 44.99,
    original_price: 59.99,
    category: "Electronics",
    stock: 50,
    rating: 4.7,
    reviews_count: 94,
    description: "Strong MagSafe snap-on alignment with 15W fast wireless charging and folding kickstand.",
    is_featured: true,
    image_query: "power bank wireless"
  }
];

// Curated high-res imagery for synthetic products
const CURATED_IMAGE_URLS = [
  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1545454675-3531b543be5d?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1609592424364-55556277b06b?w=800&auto=format&fit=crop&q=80"
];

export async function seedDynamicProducts() {
  console.log("====================================================");
  console.log("🌱 SEEDING SYNTHETIC PRODUCTS TO CLOUDINARY & SUPABASE DB");
  console.log("====================================================\n");

  // 1. Get vendor user ID from profiles
  const { data: vendorProfile } = await supabase
    .from("profiles")
    .select("id, full_name, store_name")
    .eq("role", "vendor")
    .limit(1)
    .single();

  const vendorId = vendorProfile?.id || null;
  const vendorName = vendorProfile?.store_name || "TechGear Flagship Store";

  console.log(`Assigning synthetic catalog products to Vendor: ${vendorName} (${vendorId || 'Universal'})\n`);

  // 2. Clear old test products to ensure 100% clean DB
  await supabase.from("products").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  const seededProducts = [];

  for (let i = 0; i < SYNTHETIC_PRODUCTS.length; i++) {
    const prod = SYNTHETIC_PRODUCTS[i];
    const sourceImageUrl = CURATED_IMAGE_URLS[i % CURATED_IMAGE_URLS.length];
    let finalImageUrl = sourceImageUrl;
    let cloudinaryPublicId = null;

    try {
      console.log(`[${i + 1}/${SYNTHETIC_PRODUCTS.length}] Uploading image to Cloudinary (type: authenticated): ${prod.title}...`);

      if (isConfigured) {
        // Fetch image buffer and upload to Cloudinary with authenticated privacy
        const imgRes = await fetch(sourceImageUrl);
        const arrayBuf = await imgRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);

        const uploadRes = await uploadBufferToCloudinary(buffer, "marvel_products", "authenticated");
        finalImageUrl = uploadRes.signed_url;
        cloudinaryPublicId = uploadRes.public_id;
        console.log(`   ✅ Cloudinary Public ID: ${cloudinaryPublicId}`);
      }
    } catch (uploadErr) {
      console.warn(`   ⚠️ Cloudinary upload warning for ${prod.title}:`, uploadErr.message);
    }

    // Insert into Supabase DB
    const { data: inserted, error: insError } = await supabase
      .from("products")
      .insert([
        {
          title: prod.title,
          description: prod.description,
          price: prod.price,
          original_price: prod.original_price,
          category: prod.category,
          stock: prod.stock,
          rating: prod.rating,
          reviews_count: prod.reviews_count,
          image_url: finalImageUrl,
          cloudinary_public_id: cloudinaryPublicId,
          access_type: "authenticated",
          is_featured: prod.is_featured,
          moderation_status: "approved",
          vendor_id: vendorId,
          vendor_name: vendorName,
          status: "active"
        }
      ])
      .select()
      .single();

    if (insError) {
      console.error(`   ❌ Supabase insert error for ${prod.title}:`, insError.message);
    } else {
      console.log(`   ✅ Saved in Supabase DB: ${inserted.title} ($${inserted.price})`);
      seededProducts.push(inserted);
    }
  }

  // 3. Seed sample orders in Supabase DB
  console.log("\n📦 Seeding initial customer orders into Supabase DB...");
  const { data: customerProfile } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .eq("role", "user")
    .limit(1)
    .single();

  if (customerProfile && seededProducts.length > 0) {
    const sampleOrders = [
      {
        user_id: customerProfile.id,
        customer_name: customerProfile.full_name,
        customer_email: customerProfile.email,
        vendor_id: vendorId,
        items: [
          {
            id: seededProducts[0].id,
            title: seededProducts[0].title,
            price: seededProducts[0].price,
            quantity: 1,
            image: seededProducts[0].image_url
          }
        ],
        total_amount: seededProducts[0].price,
        status: "delivered",
        shipping_address: "742 Evergreen Terrace, Springfield, OR",
        carrier: "FedEx Express",
        tracking_number: "FX-948291039"
      },
      {
        user_id: customerProfile.id,
        customer_name: customerProfile.full_name,
        customer_email: customerProfile.email,
        vendor_id: vendorId,
        items: [
          {
            id: seededProducts[1].id,
            title: seededProducts[1].title,
            price: seededProducts[1].price,
            quantity: 1,
            image: seededProducts[1].image_url
          }
        ],
        total_amount: seededProducts[1].price,
        status: "shipped",
        shipping_address: "742 Evergreen Terrace, Springfield, OR",
        carrier: "DHL Express",
        tracking_number: "DHL-839201948"
      }
    ];

    await supabase.from("orders").insert(sampleOrders);
    console.log(`✅ Seeded ${sampleOrders.length} orders in Supabase DB for ${customerProfile.email}`);
  }

  console.log("\n====================================================");
  console.log(`🎉 100% DYNAMIC CATALOG SEEDED (${seededProducts.length} PRODUCTS IN SUPABASE & CLOUDINARY)!`);
  console.log("====================================================");
}

seedDynamicProducts();
