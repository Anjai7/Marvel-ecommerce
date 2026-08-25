async function testE2EAdminApi() {
  console.log("==========================================================");
  console.log("🚀 TESTING E2E ADMIN API & USER MANAGEMENT VIA HTTP SERVER");
  console.log("==========================================================\n");

  const baseUrl = "http://localhost:5000/api";

  // 1. Admin Login
  console.log("1. Authenticating as Admin (admin@marvel.com)...");
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@marvel.com", password: "admin123", expectedRole: "admin" })
  });

  const loginData = await loginRes.json();
  if (!loginRes.ok) throw new Error("Admin login failed: " + JSON.stringify(loginData));
  const token = loginData.token;
  console.log(`✅ Admin logged in successfully! Role: ${loginData.user.role}, Name: ${loginData.user.full_name}`);

  const authHeaders = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`
  };

  // 2. Query Users
  console.log("\n2. Querying all users (/api/users)...");
  const usersRes = await fetch(`${baseUrl}/users`, { headers: authHeaders });
  const usersList = await usersRes.json();
  console.log(`✅ Received ${usersList.length} registered users from server.`);

  // 3. Create a New User
  const testEmail = `testuser_${Date.now()}@marvel.com`;
  console.log(`\n3. Creating new user (${testEmail})...`);
  const createRes = await fetch(`${baseUrl}/users/admin-create`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      fullName: "Test Customer Account",
      email: testEmail,
      password: "TestPassword123!",
      role: "user",
      status: "active",
      plan: "Basic"
    })
  });

  const createData = await createRes.json();
  if (!createRes.ok) throw new Error("User creation failed: " + JSON.stringify(createData));
  const createdUser = createData.user;
  console.log(`✅ User created! ID: ${createdUser.id}, Name: ${createdUser.full_name}, Role: ${createdUser.role}`);

  // 4. Edit the User Profile via PUT /api/users/:id
  console.log(`\n4. Editing user profile (${createdUser.id})...`);
  const editRes = await fetch(`${baseUrl}/users/${createdUser.id}`, {
    method: "PUT",
    headers: authHeaders,
    body: JSON.stringify({
      full_name: "Updated Customer Name",
      role: "vendor",
      store_name: "Apex Electronics Hub",
      status: "active"
    })
  });

  const editData = await editRes.json();
  if (!editRes.ok) throw new Error("User edit failed: " + JSON.stringify(editData));
  console.log(`✅ User updated! Name: ${editData.user.full_name}, Role: ${editData.user.role}, Store: ${editData.user.store_name}`);

  // 5. Clean up: Delete the test user
  console.log(`\n5. Deleting test user (${createdUser.id})...`);
  const delRes = await fetch(`${baseUrl}/users/${createdUser.id}`, {
    method: "DELETE",
    headers: authHeaders
  });
  const delData = await delRes.json();
  if (!delRes.ok) throw new Error("User deletion failed: " + JSON.stringify(delData));
  console.log(`✅ User deleted successfully: ${delData.message}`);

  // 6. Test Dashboard dynamic data endpoints
  console.log("\n6. Testing dynamic dashboard metrics endpoints...");
  const prodRes = await fetch(`${baseUrl}/products`);
  const products = await prodRes.json();
  const ordRes = await fetch(`${baseUrl}/orders`, { headers: authHeaders });
  const orders = await ordRes.json();

  console.log(`✅ Products in DB: ${products.length}, Orders in DB: ${orders.length}`);

  console.log("\n==========================================================");
  console.log("🎉 ALL E2E HTTP ENDPOINTS AND USER CRUD OPERATING FLAWLESSLY!");
  console.log("==========================================================");
}

testE2EAdminApi().catch(err => {
  console.error("❌ E2E Test Error:", err.message);
  process.exit(1);
});
