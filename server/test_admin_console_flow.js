import { supabase } from "./db.js";

async function runTests() {
  console.log("=================================================");
  console.log("🧪 TESTING ADMIN CONSOLE & USER CRUD OPERATIONS");
  console.log("=================================================\n");

  try {
    // 1. Fetch Users
    console.log("1. Fetching all users from database...");
    const { data: users, error: userErr } = await supabase.from("profiles").select("*");
    if (userErr) throw new Error("Users fetch failed: " + userErr.message);
    console.log(`✅ Successfully fetched ${users.length} user profiles from DB.`);

    // 2. Fetch Products
    console.log("2. Fetching products for dynamic dashboard metrics...");
    const { data: products, error: prodErr } = await supabase.from("products").select("*");
    if (prodErr) throw new Error("Products fetch failed: " + prodErr.message);
    console.log(`✅ Successfully fetched ${products.length} products from DB.`);

    // 3. Fetch Orders
    console.log("3. Fetching orders for dynamic charts & revenue aggregation...");
    const { data: orders, error: ordErr } = await supabase.from("orders").select("*");
    if (ordErr) throw new Error("Orders fetch failed: " + ordErr.message);
    console.log(`✅ Successfully fetched ${orders.length} orders from DB.`);

    const totalRevenue = orders.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0);
    console.log(`💰 Calculated live platform revenue: $${totalRevenue.toFixed(2)}`);

    // 4. Test Edit User Profile
    console.log("\n4. Testing user edit operation in Supabase profiles...");
    if (users.length > 0) {
      const targetUser = users[0];
      const nextStatus = targetUser.status === "active" ? "active" : "active";
      const { data: updated, error: updateErr } = await supabase
        .from("profiles")
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq("id", targetUser.id)
        .select()
        .single();

      if (updateErr) throw new Error("Profile update failed: " + updateErr.message);
      console.log(`✅ Successfully updated status for user ${targetUser.email} to '${updated.status}'.`);
    }

    console.log("\n=================================================");
    console.log("🎉 ALL ADMIN CONSOLE DB INTEGRATION TESTS PASSED!");
    console.log("=================================================");
  } catch (err) {
    console.error("❌ Test failed:", err.message);
    process.exit(1);
  }
}

runTests();
