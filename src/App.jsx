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
import LoginPage from "./components/auth/LoginPage";
import SignUpPage from "./components/auth/SignUpPage";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import { AuthProvider, useAuth } from "./context/AuthContext";

// Role-specific Dashboards
import CustomerPortal from "./components/customer/CustomerPortal";
import VendorDashboard from "./components/vendor/VendorDashboard";
import AdminPortal from "./components/admin/AdminPortal";
import SuperAdminDashboard from "./components/superadmin/SuperAdminDashboard";

function AppMain() {
  const { user, isLoggedIn, role: userRole, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cartCount] = useState(8);
  const [quickViewProduct, setQuickViewProduct] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  
  // Real URL Hash-based Routing with Route Parameters (e.g. #/product/:id)
  const getHashRoute = () => {
    const raw = window.location.hash.replace(/^#\/?/, "").trim();
    if (!raw) return { page: "home", id: null, full: "" };
    
    const parts = raw.split("?")[0].split("/");
    const page = (parts[0] || "home").toLowerCase();
    const id = parts[1] || null;

    return { page, id, full: raw };
  };

  const [currentRoute, setCurrentRoute] = useState(getHashRoute());
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
    if (cleanPath === "vendor-dashboard" || cleanPath === "vendor") {
      if (!isLoggedIn) navigateTo("login", "vendor");
      else navigateTo("vendor");
    } else if (cleanPath === "admin-dashboard" || cleanPath === "admin" || cleanPath === "admin-portal") {
      if (!isLoggedIn) navigateTo("login", "admin");
      else navigateTo("admin");
    } else if (cleanPath === "superadmin-dashboard" || cleanPath === "super-admin" || cleanPath === "superadmin") {
      if (!isLoggedIn) navigateTo("login", "super_admin");
      else navigateTo("super-admin");
    } else if (cleanPath === "customer-portal" || cleanPath === "account" || cleanPath === "orders") {
      if (!isLoggedIn) navigateTo("login", "user");
      else navigateTo("account");
    } else if (cleanPath === "products" || cleanPath === "product") {
      navigateTo("product");
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
  const isAccountPage = currentRoute.page === "account" || currentRoute.page === "customer-portal" || currentRoute.page === "orders";
  const isVendorPage = currentRoute.page === "vendor" || currentRoute.page === "vendor-dashboard";
  const isAdminPage = currentRoute.page === "admin" || currentRoute.page === "admin-portal" || currentRoute.page === "admin-dashboard";
  const isSuperAdminPage = currentRoute.page === "super-admin" || currentRoute.page === "superadmin" || currentRoute.page === "superadmin-dashboard";

  return (
    <div className="app">
      <MobileMenu
        isOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        isLoggedIn={isLoggedIn}
        onLogin={() => navigateTo("login")}
      />

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
        />

        {/* Dynamic & Hover Navigation Bars */}
        {isStorefront ? (
          <HoverNav userRole={userRole} onDynamicNavigate={handleDynamicMenuClick} />
        ) : (
          <DynamicMenu
            userRole={userRole}
            onNavigate={handleDynamicMenuClick}
            activePath={`/${currentRoute.page}`}
          />
        )}
      </div>

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
          <VendorDashboard
            currentUser={user}
            onNavigateHome={() => navigateTo("")}
          />
        </ProtectedRoute>
      )}

      {/* 6. PROTECTED PLATFORM ADMIN CONSOLE */}
      {isAdminPage && (
        <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
          <AdminPortal
            currentUser={user}
            onNavigateHome={() => navigateTo("")}
          />
        </ProtectedRoute>
      )}

      {/* 7. PROTECTED SUPER ADMIN HUB */}
      {isSuperAdminPage && (
        <ProtectedRoute allowedRoles={["super_admin"]}>
          <SuperAdminDashboard
            currentUser={user}
            onNavigateHome={() => navigateTo("")}
          />
        </ProtectedRoute>
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
        <AppMain />
      </AuthProvider>
    </ToastProvider>
  );
}
