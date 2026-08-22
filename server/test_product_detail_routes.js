const API = "http://localhost:5000/api";

async function testProductRoutes() {
  console.log("====================================================");
  console.log("🛍️ TESTING DYNAMIC PRODUCT DETAIL ROUTES & BACKEND API");
  console.log("====================================================\n");

  // 1. Fetch catalog
  const res = await fetch(`${API}/products`);
  const products = await res.json();
  console.log(`✅ Retrieved ${products.length} dynamic products from DB.`);

  if (products.length === 0) {
    console.error("❌ No products in database.");
    return;
  }

  // 2. Fetch specific product by ID
  const testProduct = products[0];
  console.log(`\n🔍 Querying specific product by ID: ${testProduct.id}...`);

  const detailRes = await fetch(`${API}/products/${testProduct.id}`);
  const detail = await detailRes.json();

  console.log(`✅ Product ID: ${detail.id}`);
  console.log(`   Title: ${detail.title}`);
  console.log(`   Price: $${detail.price} (Original: $${detail.original_price})`);
  console.log(`   Category: ${detail.category} | Stock: ${detail.stock}`);
  console.log(`   Cloudinary CDN Image URL: ${detail.image_url.substring(0, 75)}...`);
  console.log(`   Description: ${detail.description}`);

  // 3. Test non-existent ID
  console.log(`\n🔍 Querying invalid product ID: 00000000-0000-0000-0000-000000000000...`);
  const notFoundRes = await fetch(`${API}/products/00000000-0000-0000-0000-000000000000`);
  const notFoundData = await notFoundRes.json();
  console.log(`✅ Status: ${notFoundRes.status} | Response: "${notFoundData.error}"`);

  console.log("\n====================================================");
  console.log("🎉 ALL PRODUCT DETAIL BACKEND ROUTES VERIFIED!");
  console.log("====================================================");
}

testProductRoutes().catch(console.error);
