/**
 * Application routing utilities and hash-based navigation helpers.
 */

/**
 * Real hash routing. `#/product/:id` keeps its single id; `category/*` carries
 * the whole ancestor path because slugs are unique only per parent, so the
 * last segment alone cannot identify a category.
 *
 * @param {string} [hashOverride] - Optional hash string (defaults to window.location.hash)
 */
export function getHashRoute(hashOverride) {
  const hash =
    typeof hashOverride === "string"
      ? hashOverride
      : typeof window !== "undefined"
        ? window.location.hash
        : "";

  const raw = hash.replace(/^#\/?/, "").trim();
  if (!raw) return { page: "home", id: null, path: null, full: "" };

  const parts = raw.split("?")[0].split("/");
  const page = (parts[0] || "home").toLowerCase();

  if (page === "category") {
    const remainder = parts.slice(1).join("/");
    let path = remainder;
    try {
      path = decodeURIComponent(remainder);
    } catch {
      // A malformed escape keeps the raw remainder; the page shows its
      // unknown-category state rather than crashing the router.
    }
    path = path.replace(/^\/+|\/+$/g, "");
    return { page, id: path || null, path, full: raw };
  }

  return { page, id: parts[1] || null, path: null, full: raw };
}

/**
 * `menu_items.path` already is the full category path, so the nav mapping is a
 * string strip — the menu path and the category path are the same string.
 * Hash-form values (`#/category/x`, allowed by §4.1) normalize the same way.
 *
 * @param {string|null|undefined} path
 */
export function menuPathToCategoryPath(path) {
  const clean = String(path ?? "")
    .trim()
    .replace(/^#/, "")
    .replace(/^\/+/, "");
  if (clean === "category") return "";
  if (!clean.startsWith("category/")) return null;
  return clean.slice("category/".length);
}

/**
 * Resolves menu paths to concrete internal routes and authentication requirements.
 *
 * @param {string} path - Raw path from menu / dynamic navigation
 * @param {boolean} isLoggedIn - Current user login state
 * @returns {{ route: string, role?: string }} Target route and optional prefill role
 */
export function resolveMenuNavigation(path, isLoggedIn) {
  const cleanPath = String(path ?? "")
    .trim()
    .replace(/^#/, "")
    .replace(/^\//, "");

  const categoryPath = menuPathToCategoryPath(path);

  if (cleanPath === "vendor-dashboard" || cleanPath === "vendor") {
    return !isLoggedIn ? { route: "login", role: "vendor" } : { route: "vendor" };
  }

  if (cleanPath === "admin-dashboard" || cleanPath === "admin" || cleanPath === "admin-portal") {
    return !isLoggedIn ? { route: "login", role: "admin" } : { route: "admin" };
  }

  if (
    cleanPath === "superadmin-dashboard" ||
    cleanPath === "super-admin" ||
    cleanPath === "superadmin"
  ) {
    return !isLoggedIn ? { route: "login", role: "super_admin" } : { route: "super-admin" };
  }

  if (cleanPath === "customer-portal" || cleanPath === "account" || cleanPath === "orders") {
    return !isLoggedIn ? { route: "login", role: "user" } : { route: "account" };
  }

  if (cleanPath === "products" || cleanPath === "product") {
    return { route: "product" };
  }

  if (categoryPath !== null) {
    return { route: `category/${categoryPath}` };
  }

  return { route: "" };
}

/**
 * Determines appropriate dashboard route based on user role.
 *
 * @param {string} [userRole]
 * @returns {string} Target dashboard route
 */
export function getDashboardRouteForRole(userRole) {
  if (userRole === "super_admin") return "super-admin";
  if (userRole === "admin") return "admin";
  if (userRole === "vendor") return "vendor";
  return "account";
}

/**
 * Determines target destination upon successful login or registration.
 *
 * @param {string} [userRole]
 * @returns {string} Route name
 */
export function getAuthRedirectRoute(userRole) {
  if (userRole === "vendor") return "vendor";
  if (userRole === "admin") return "admin";
  if (userRole === "super_admin") return "super-admin";
  return "";
}

/**
 * Route classification helpers.
 */
export function isStorefrontRoute(page) {
  return page === "" || page === "home";
}

export function isCategoryRoute(page) {
  return page === "category";
}

export function isProductRoute(page) {
  return page === "product" || page === "products";
}

export function isAccountRoute(page) {
  return page === "account" || page === "customer-portal" || page === "orders";
}

export function isVendorRoute(page) {
  return page === "vendor" || page === "vendor-dashboard";
}

export function isAdminRoute(page) {
  return page === "admin" || page === "admin-portal" || page === "admin-dashboard";
}

export function isSuperAdminRoute(page) {
  return page === "super-admin" || page === "superadmin" || page === "superadmin-dashboard";
}

export function isStandaloneAdminView(page) {
  return isAdminRoute(page) || isSuperAdminRoute(page);
}
