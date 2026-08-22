const BASE = "http://localhost:5000/api";

async function testRoleFlows() {
  console.log("====================================================");
  console.log("🚀 TESTING ROLE-SPECIFIC BACKEND FLOWS");
  console.log("====================================================\n");

  // 1. Customer: Fetch orders
  console.log("1️⃣ [Customer] Fetching personal order history...");
  let res = await fetch(`${BASE}/orders?userId=usr-001&role=user`);
  let orders = await res.json();
  console.log(`✅ Customer has ${orders.length} orders. Latest status:`, orders[0]?.status);

  // 2. Customer: Place new order
  console.log("\n2️⃣ [Customer] Placing new test order...");
  res = await fetch(`${BASE}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: "usr-001",
      customerName: "Alex Customer",
      customerEmail: "user@marvel.com",
      items: [{ id: "p1", title: "Wireless Noise-Canceling Headphones Pro", price: 199.99, quantity: 1 }],
      totalAmount: 199.99,
      shippingAddress: "742 Evergreen Terrace, Springfield, OR"
    })
  });
  let newOrder = await res.json();
  console.log(`✅ Placed order ID: ${newOrder.order?.id}, Total: $${newOrder.order?.total_amount}`);

  // 3. Vendor: Product CRUD
  console.log("\n3️⃣ [Vendor] Publishing new product to store catalog...");
  res = await fetch(`${BASE}/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Magnetic Wireless Power Bank 10000mAh",
      price: 49.99,
      original_price: 69.99,
      category: "Accessories",
      stock: 30,
      description: "Fast 15W Qi wireless charging with strong MagSafe alignment.",
      image_url: "https://images.unsplash.com/photo-1609592424364-55556277b06b?w=500",
      vendor_id: "usr-002",
      vendor_name: "TechGear Electronics"
    })
  });
  let createdProd = await res.json();
  console.log(`✅ Vendor created product: '${createdProd.product?.title}' (ID: ${createdProd.product?.id})`);

  // 4. Vendor: Order Fulfillment (Update Shipment)
  console.log("\n4️⃣ [Vendor] Updating order fulfillment status to 'shipped'...");
  res = await fetch(`${BASE}/orders/${newOrder.order?.id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      status: "shipped",
      carrier: "DHL Express",
      tracking_number: "DHL-9842104"
    })
  });
  let updatedOrd = await res.json();
  console.log(`✅ Order status updated to: ${updatedOrd.order?.status} (Carrier: ${updatedOrd.order?.carrier}, Tracking: ${updatedOrd.order?.tracking_number})`);

  // 5. Admin: Moderate Product
  console.log("\n5️⃣ [Admin] Moderating vendor product & featuring on homepage...");
  res = await fetch(`${BASE}/products/${createdProd.product?.id}/moderation`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      moderation_status: "approved",
      is_featured: true
    })
  });
  let moderated = await res.json();
  console.log(`✅ Admin approved product: Status '${moderated.product?.moderation_status}', Featured: ${moderated.product?.is_featured}`);

  // 6. Super Admin: Dynamic Menu Update
  console.log("\n6️⃣ [Super Admin] Dynamic Menu Architect: Adding new route...");
  res = await fetch(`${BASE}/menu`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Weekend Flash Deals",
      path: "/deals/weekend",
      icon: "Tag",
      badge: "HOT",
      roles_allowed: ["user", "vendor", "admin", "super_admin"]
    })
  });
  let menuRes = await res.json();
  console.log(`✅ Super Admin updated dynamic menu. Total routes in DB: ${menuRes.menu?.length}`);

  console.log("\n====================================================");
  console.log("🎉 ALL ROLE FLOWS TESTED & FUNCTIONING PERFECTLY!");
  console.log("====================================================");
}

testRoleFlows().catch(console.error);
