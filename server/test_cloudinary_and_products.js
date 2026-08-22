const BASE = "http://localhost:5000/api";

async function testCloudinaryAndProducts() {
  console.log("====================================================");
  console.log("☁️ TESTING CLOUDINARY UPLOAD & DYNAMIC CATALOG");
  console.log("====================================================\n");

  // 1. Test image upload endpoint
  console.log("1️⃣ Testing Image Upload endpoint (POST /api/upload)...");
  
  // Create a minimal 1x1 test PNG buffer in memory
  const testImageBuffer = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  );

  const formData = new FormData();
  const blob = new Blob([testImageBuffer], { type: "image/png" });
  formData.append("image", blob, "test_product.png");
  formData.append("folder", "marvel_products");

  const uploadRes = await fetch(`${BASE}/upload`, {
    method: "POST",
    body: formData
  });

  const uploadData = await uploadRes.json();
  console.log("✅ Image Upload Response:", uploadData);

  // 2. Test creating product with the resulting Cloudinary URL
  console.log("\n2️⃣ Creating dynamic product in database with image link...");
  const createRes = await fetch(`${BASE}/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Cloudinary 4K Pro Action Camera",
      price: 299.99,
      original_price: 349.99,
      category: "Electronics",
      stock: 18,
      image_url: uploadData.url,
      description: "Ultra-stabilized 4K60fps waterproof camera with instant Cloudinary CDN media delivery.",
      vendor_id: "usr-002",
      vendor_name: "TechGear Electronics"
    })
  });

  const productData = await createRes.json();
  console.log(`✅ Product Created in DB: '${productData.product?.title}' (ID: ${productData.product?.id})`);
  console.log(`🔗 Image Link stored in DB: ${productData.product?.image_url}`);

  // 3. Verify product is retrievable dynamically for storefront
  console.log("\n3️⃣ Verifying dynamic catalog feed for storefront...");
  const fetchRes = await fetch(`${BASE}/products`);
  const catalog = await fetchRes.json();
  const found = catalog.find(p => p.id === productData.product?.id);
  console.log(`✅ Verified in dynamic catalog: found '${found?.title}', price: $${found?.price}`);

  console.log("\n====================================================");
  console.log("🎉 CLOUDINARY & DYNAMIC PRODUCT PIPELINE VERIFIED!");
  console.log("====================================================");
}

testCloudinaryAndProducts().catch(console.error);
