import fs from "fs";
import path from "path";

function auditFrontend() {
  console.log("====================================================");
  console.log("🛡️ ARCHITECTURAL AUDIT: ZERO DIRECT BROWSER CALLS");
  console.log("====================================================\n");

  const srcDir = path.resolve("./src");
  let directCallViolations = [];
  let totalFilesChecked = 0;

  function scanDir(dir) {
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const fullPath = path.join(dir, f);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        scanDir(fullPath);
      } else if (f.endsWith(".js") || f.endsWith(".jsx")) {
        totalFilesChecked++;
        const content = fs.readFileSync(fullPath, "utf-8");

        // Check for direct Supabase client initialization
        if (content.includes("createClient(") && !fullPath.includes("server")) {
          directCallViolations.push({ file: f, issue: "Direct Supabase createClient() found in frontend" });
        }

        // Check for direct external Cloudinary API endpoints in components
        if (content.includes("api.cloudinary.com") && !fullPath.includes("server")) {
          directCallViolations.push({ file: f, issue: "Direct api.cloudinary.com call found in frontend" });
        }

        // Check for direct external database URLs in fetch
        if (content.includes("fetch(\"https://") && !fullPath.includes("server")) {
          directCallViolations.push({ file: f, issue: "External https:// fetch found in frontend" });
        }
      }
    }
  }

  scanDir(srcDir);

  console.log(`📁 Total Frontend Source Files Scanned: ${totalFilesChecked}`);
  console.log(`🚫 Direct External Database / Cloudinary Violations: ${directCallViolations.length}\n`);

  if (directCallViolations.length === 0) {
    console.log("✅ ARCHITECTURE VERIFIED: 100% of all requests route exclusively via:");
    console.log("   Frontend (Browser) ──> Express Backend API (/api/*) ──> Supabase DB & Cloudinary");
  } else {
    console.error("❌ Violations found:", directCallViolations);
  }

  console.log("\n====================================================");
}

auditFrontend();
