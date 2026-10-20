import React, { useState, useEffect } from "react";
import Header from "./components/Header";
import DynamicMenu from "./components/navigation/DynamicMenu";
import HoverNav from "./components/HoverNav";
import MobileMenu from "./components/MobileMenu";
import HeroBanner from "./components/HeroBanner";
import CategorySlider from "./components/CategorySlider";
import BannerLayout from "./components/BannerLayout";
import TrendingProducts from "./components/TrendingProducts";
import PromoBannerCarousel from "./components/PromoBannerCarousel";
import FeaturedProducts from "./components/FeaturedProducts";
import Footer from "./components/Footer";
import ScrollToTop from "./components/ScrollToTop";
import { ToastProvider } from "./components/ui";
import { QuickViewDialog } from "./components/product/QuickViewDialog";
import ProductViewPage from "./components/product/ProductViewPage";
import CategoryPage from "./components/category/CategoryPage";
import LoginPage from "./components/auth/LoginPage";
import SignUpPage from "./components/auth/SignUpPage";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ContentProvider } from "./context/ContentContext";
import { CartProvider, useCart } from "./context/CartContext";
import CartPage from "./components/cart/CartPage";

// Role-specific Dashboards
import CustomerPortal from "./components/customer/CustomerPortal";
import VendorDashboard from "./components/vendor/VendorDashboard";
import AdminPortal from "./components/admin/AdminPortal";
import SuperAdminDashboard from "./components/superadmin/SuperAdminDashboard";

/**
 * Real hash routing. `#/product/:id` keeps its single id; `category/*` carries
 * the whole ancestor path because slugs are unique only per parent, so the
 * last segment alone cannot identify a category.
 */
export function getHashRoute() {
  const raw = window.location.hash.replace(/^#\/?/, "").trim();
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
 */
export function menuPathToCategoryPath(path) {
  const clean = String(path ?? "").replace(/^\/+/, "");
  if (!clean.startsWith("category/")) return null;
  return clean.slice("category/".length);
}

function AppMain() {
  const { user, isLoggedIn, role: userRole, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { cartCount } = useCart();
  const [quickViewProduct, setQuickViewProduct] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const [currentRoute, setCurrentRoute] = useState(getHashRoute);
  const [loginDefaultRole, setLoginDefaultRole] = useState("user");

  useEffect(() => {
    const handleHashChange = () => {
      const newRoute = getHashRoute();
      setCurrentRoute(newRoute);
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const navigateTo = (route, role = "user") => {
    if (route === "login") setLoginDefaultRole(role);
    window.location.hash = `#/${route}`;
  };

  const handleSelectProduct = (product) => {
    if (product && product.id) {
      setSelectedProduct(product);
      window.location.hash = `#/product/${product.id}`;
    } else {
      navigateTo("product");
    }
  };

  const handleDynamicMenuClick = (path) => {
    const cleanPath = path.replace(/^\//, "");
    const categoryPath = menuPathToCategoryPath(path);
    if (cleanPath === "vendor-dashboard" || cleanPath === "vendor") {
      if (!isLoggedIn) navigateTo("login", "vendor");
      else navigateTo("vendor");
    } else if (
      cleanPath === "admin-dashboard" ||
      cleanPath === "admin" ||
      cleanPath === "admin-portal"
    ) {
      if (!isLoggedIn) navigateTo("login", "admin");
      else navigateTo("admin");
    } else if (
      cleanPath === "superadmin-dashboard" ||
      cleanPath === "super-admin" ||
      cleanPath === "superadmin"
    ) {
      if (!isLoggedIn) navigateTo("login", "super_admin");
      else navigateTo("super-admin");
    } else if (
      cleanPath === "customer-portal" ||
      cleanPath === "account" ||
      cleanPath === "orders"
    ) {
      if (!isLoggedIn) navigateTo("login", "user");
      else navigateTo("account");
    } else if (cleanPath === "products" || cleanPath === "product") {
      navigateTo("product");
    } else if (categoryPath !== null) {
      navigateTo(`category/${categoryPath}`);
    } else {
      navigateTo("");
    }
  };

  const handleNavigateAdmin = () => {
    if (userRole === "super_admin") navigateTo("super-admin");
    else if (userRole === "admin") navigateTo("admin");
    else if (userRole === "vendor") navigateTo("vendor");
    else navigateTo("account");
  };

  const handleQuickView = (product) => {
    setQuickViewProduct(product);
  };

  // Determine active view from URL hash route
  const isStorefront = currentRoute.page === "" || currentRoute.page === "home";
  const isLoginPage = currentRoute.page === "login";
  const isSignUpPage = currentRoute.page === "signup";
  const isProductPage = currentRoute.page === "product" || currentRoute.page === "products";
  const isCategoryPage = currentRoute.page === "category";
  const isAccountPage =
    currentRoute.page === "account" ||
    currentRoute.page === "customer-portal" ||
    currentRoute.page === "orders";
  const isVendorPage = currentRoute.page === "vendor" || currentRoute.page === "vendor-dashboard";
  const isAdminPage =
    currentRoute.page === "admin" ||
    currentRoute.page === "admin-portal" ||
    currentRoute.page === "admin-dashboard";
  const isSuperAdminPage =
    currentRoute.page === "super-admin" ||
    currentRoute.page === "superadmin" ||
    currentRoute.page === "superadmin-dashboard";
  const isCartPage = currentRoute.page === "cart";

  return (
    <div className="app">
      <MobileMenu
        isOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        isLoggedIn={isLoggedIn}
        onLogin={() => navigateTo("login")}
      />

      {!isAdminPage && !isSuperAdminPage && (
        <div className="sticky-header-wrapper">
          <Header
            currentUser={user}
            isLoggedIn={isLoggedIn}
            onNavigateLogin={() => navigateTo("login")}
            onNavigateSignUp={() => navigateTo("signup")}
            onNavigateAdmin={handleNavigateAdmin}
            onNavigateCustomerPortal={() => navigateTo("account")}
            onNavigateHome={() => navigateTo("")}
            onLogout={logout}
            cartCount={cartCount}
            onMenuOpen={() => setMobileOpen(true)}
            onSelectProduct={handleSelectProduct}
            onNavigateCart={() => navigateTo("cart")}
          />

          {/* Dynamic & Hover Navigation Bars */}
          {isStorefront ? (
            <HoverNav userRole={userRole} onDynamicNavigate={handleDynamicMenuClick} />
          ) : (
            <DynamicMenu onNavigate={handleDynamicMenuClick} activePath={`/${currentRoute.page}`} />
          )}
        </div>
      )}

      {/* 1. CUSTOMER STOREFRONT */}
      {isStorefront && (
        <>
          <HeroBanner />
          <CategorySlider />
          <BannerLayout />
          <TrendingProducts
            onQuickView={handleQuickView}
            onNavigate={handleSelectProduct}
            onSelectProduct={handleSelectProduct}
          />
          <PromoBannerCarousel />
          <FeaturedProducts
            onQuickView={handleQuickView}
            onNavigate={handleSelectProduct}
            onSelectProduct={handleSelectProduct}
          />
          <Footer />
        </>
      )}

      {/* 2. CATEGORY LANDING PAGE */}
      {isCategoryPage && (
        <CategoryPage
          path={currentRoute.path}
          onNavigate={handleDynamicMenuClick}
          onSelectProduct={handleSelectProduct}
        />
      )}

      {/* 2. AUTHENTICATION (LOGIN & SIGNUP) */}
      {isLoginPage && (
        <LoginPage
          onLoginSuccess={(auth) => {
            if (auth.role === "vendor") navigateTo("vendor");
            else if (auth.role === "admin") navigateTo("admin");
            else if (auth.role === "super_admin") navigateTo("super-admin");
            else navigateTo("");
          }}
          onNavigateSignUp={() => navigateTo("signup")}
        />
      )}

      {isSignUpPage && (
        <SignUpPage
          onSignUpSuccess={(auth) => {
            if (auth.role === "vendor") navigateTo("vendor");
            else if (auth.role === "admin") navigateTo("admin");
            else if (auth.role === "super_admin") navigateTo("super-admin");
            else navigateTo("");
          }}
          onNavigateLogin={() => navigateTo("login")}
        />
      )}

      {/* 3. DYNAMIC PRODUCT VIEW DETAILS PAGE */}
      {isProductPage && (
        <ProductViewPage
          productId={currentRoute.id}
          product={selectedProduct}
          onBack={() => navigateTo("")}
          onSelectProduct={handleSelectProduct}
        />
      )}

      {/* 4. PROTECTED CUSTOMER PORTAL */}
      {isAccountPage && (
        <ProtectedRoute allowedRoles={["user", "vendor", "admin", "super_admin"]}>
          <CustomerPortal
            currentUser={user}
            onNavigateHome={() => navigateTo("")}
            onSelectProduct={handleSelectProduct}
          />
        </ProtectedRoute>
      )}

      {/* 5. PROTECTED VENDOR HUB */}
      {isVendorPage && (
        <ProtectedRoute allowedRoles={["vendor", "super_admin"]}>
          <VendorDashboard currentUser={user} onNavigateHome={() => navigateTo("")} />
        </ProtectedRoute>
      )}

      {/* 6. PROTECTED PLATFORM ADMIN CONSOLE */}
      {isAdminPage && (
        <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
          <AdminPortal currentUser={user} onNavigateHome={() => navigateTo("")} />
        </ProtectedRoute>
      )}

      {/* 7. PROTECTED SUPER ADMIN HUB */}
      {isSuperAdminPage && (
        <ProtectedRoute allowedRoles={["super_admin"]}>
          <SuperAdminDashboard currentUser={user} onNavigateHome={() => navigateTo("")} />
        </ProtectedRoute>
      )}

      {isCartPage && (
        <CartPage
          onNavigateHome={() => navigateTo("")}
          onCheckout={() => {
            if (!isLoggedIn) navigateTo("login");
            else navigateTo("account");
          }}
        />
      )}

      {/* Floating Return to Top Button */}
      <ScrollToTop />

      {/* Quick View Dialog Modal */}
      <QuickViewDialog
        product={quickViewProduct}
        isOpen={!!quickViewProduct}
        onClose={() => setQuickViewProduct(null)}
        onViewFull={() => {
          if (quickViewProduct) {
            handleSelectProduct(quickViewProduct);
          }
          setQuickViewProduct(null);
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <ContentProvider>
          <CartProvider>
            <AppMain />
          </CartProvider>
        </ContentProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
