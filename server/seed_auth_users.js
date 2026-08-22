import { supabase } from "./db.js";

const TEST_ACCOUNTS = [
  {
    email: "user@marvel.com",
    password: "user123",
    full_name: "Alex Customer",
    role: "user",
    store_name: null
  },
  {
    email: "vendor@marvel.com",
    password: "vendor123",
    full_name: "TechGear Flagship Store",
    role: "vendor",
    store_name: "TechGear Flagship Store"
  },
  {
    email: "admin@marvel.com",
    password: "admin123",
    full_name: "Sarah Jenkins (Operations)",
    role: "admin",
    store_name: null
  },
  {
    email: "superadmin@marvel.com",
    password: "superadmin123",
    full_name: "David Vance (Root Super Admin)",
    role: "super_admin",
    store_name: null
  }
];

export async function seedAuthUsers() {
  console.log("====================================================");
  console.log("👥 PROVISIONING REAL SUPABASE AUTH & DB ACCOUNTS (ADMIN API)");
  console.log("====================================================\n");

  const results = [];

  for (const acc of TEST_ACCOUNTS) {
    try {
      console.log(`Provisioning: ${acc.email} (${acc.role})...`);

      const { data, error } = await supabase.auth.admin.createUser({
        email: acc.email,
        password: acc.password,
        email_confirm: true,
        user_metadata: {
          full_name: acc.full_name,
          role: acc.role,
          store_name: acc.store_name
        }
      });

      if (error) {
        if (error.message.includes("already registered") || error.status === 422) {
          console.log(`ℹ️ Account ${acc.email} already exists. Updating password & metadata...`);
          const { data: list } = await supabase.auth.admin.listUsers();
          const existing = list?.users?.find(u => u.email === acc.email);
          if (existing) {
            await supabase.auth.admin.updateUserById(existing.id, {
              password: acc.password,
              email_confirm: true,
              user_metadata: {
                full_name: acc.full_name,
                role: acc.role,
                store_name: acc.store_name
              }
            });
            results.push({ email: acc.email, id: existing.id, role: acc.role });
          }
        } else {
          console.error(`Error for ${acc.email}:`, error.message);
        }
      } else {
        console.log(`✅ Created Supabase Auth user: ${acc.email} (ID: ${data?.user?.id})`);
        results.push({ email: acc.email, id: data?.user?.id, role: acc.role });
      }
    } catch (err) {
      console.error(`Unexpected error for ${acc.email}:`, err.message);
    }
  }

  // Check profiles in DB
  const { data: profiles } = await supabase.from("profiles").select("*");
  console.log(`\n🗄️ Total profiles verified in Supabase DB: ${profiles?.length || 0}`);
  if (profiles) {
    profiles.forEach(p => console.log(`   - ${p.email} | Role: ${p.role} | Name: ${p.full_name}`));
  }

  console.log("\n====================================================");
  console.log(`🎉 ALL ${results.length} REAL SUPABASE ACCOUNTS READY!`);
  console.log("====================================================");
  return results;
}

seedAuthUsers();
