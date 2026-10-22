import React, { useState, useEffect } from "react";
import Header from "./components/Header";
import DynamicMenu from "./components/navigation/DynamicMenu";
import HoverNav from "./components/HoverNav";
import MobileMenu from "./components/MobileMenu";
import StorefrontHome from "./components/storefront/StorefrontHome";
import ScrollToTop from "./components/ScrollToTop";
import { ToastProvider } from "./components/ui";
import { QuickViewDialog } from "./components/product/QuickViewDialog";
import ProductViewPage from "./components/product/ProductViewPage";
import CategoryPage from "./components/category/CategoryPage";
import CmsPage from "./components/pages/CmsPage";
import LoginPage from "./components/auth/LoginPage";
import SignUpPage from "./components/auth/SignUpPage";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ContentProvider } from "./context/ContentContext";
import { SettingsProvider } from "./context/SettingsContext";
import { CartProvider, useCart } from "./context/CartContext";
import CartPage from "./components/cart/CartPage";

// Role-specific Dashboards
import CustomerPortal from "./components/customer/CustomerPortal";
import VendorDashboard from "./components/vendor/VendorDashboard";
import AdminPortal from "./components/admin/AdminPortal";
import SuperAdminDashboard from "./components/superadmin/SuperAdminDashboard";

// Routes & Navigation
import {
  getHashRoute,
  menuPathToCategoryPath,
  resolveMenuNavigation,
  getDashboardRouteForRole,
  getAuthRedirectRoute,
  isStorefrontRoute,
  isCategoryRoute,
  isPageRoute,
  isProductRoute,
  isAccountRoute,
  isVendorRoute,
  isAdminRoute,
  isSuperAdminRoute,
  isStandaloneAdminView,
} from "./lib/routes";

// Re-export for backward-compatibility with tests
// oxlint-disable-next-line react/only-export-components
export { getHashRoute, menuPathToCategoryPath };

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
    const { route, role } = resolveMenuNavigation(path, isLoggedIn);
    navigateTo(route, role);
  };

  const handleNavigateAdmin = () => {
    navigateTo(getDashboardRouteForRole(userRole));
  };

  const handleQuickView = (product) => {
    setQuickViewProduct(product);
  };

  const handleAuthSuccess = (auth) => {
    navigateTo(getAuthRedirectRoute(auth?.role));
  };

  const page = currentRoute.page;
  const isStorefront = isStorefrontRoute(page);
  const isStandaloneAdmin = isStandaloneAdminView(page);

  return (
    <div className="app">
      <MobileMenu
        isOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        isLoggedIn={isLoggedIn}
        onLogin={() => navigateTo("login")}
      />

      {!isStandaloneAdmin && (
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
        <StorefrontHome
          onNavigate={handleDynamicMenuClick}
          onSelectProduct={handleSelectProduct}
          onQuickView={handleQuickView}
        />
      )}

      {/* 2. CATEGORY LANDING PAGE */}
      {isCategoryRoute(page) && (
        <CategoryPage
          path={currentRoute.path}
          onNavigate={handleDynamicMenuClick}
          onSelectProduct={handleSelectProduct}
        />
      )}

      {/* 2b. CMS PAGE — the page builder's public route. The footer lives
          inside the page, because the storefront home owns its own copy. */}
      {isPageRoute(page) && <CmsPage slug={currentRoute.id} onNavigate={handleDynamicMenuClick} />}

      {/* 3. AUTHENTICATION (LOGIN & SIGNUP) */}
      {page === "login" && (
        <LoginPage
          defaultRole={loginDefaultRole}
          onLoginSuccess={handleAuthSuccess}
          onNavigateSignUp={() => navigateTo("signup")}
        />
      )}

      {page === "signup" && (
        <SignUpPage
          onSignUpSuccess={handleAuthSuccess}
          onNavigateLogin={() => navigateTo("login")}
        />
      )}

      {/* 4. DYNAMIC PRODUCT VIEW DETAILS PAGE */}
      {isProductRoute(page) && (
        <ProductViewPage
          productId={currentRoute.id}
          product={selectedProduct}
          onBack={() => navigateTo("")}
          onSelectProduct={handleSelectProduct}
        />
      )}

      {/* 4. PROTECTED CUSTOMER PORTAL */}
      {isAccountRoute(page) && (
        <ProtectedRoute allowedRoles={["user", "vendor", "admin", "super_admin"]}>
          <CustomerPortal
            currentUser={user}
            onNavigateHome={() => navigateTo("")}
            onSelectProduct={handleSelectProduct}
          />
        </ProtectedRoute>
      )}

      {/* 5. PROTECTED VENDOR HUB */}
      {isVendorRoute(page) && (
        <ProtectedRoute allowedRoles={["vendor", "super_admin"]}>
          <VendorDashboard currentUser={user} onNavigateHome={() => navigateTo("")} />
        </ProtectedRoute>
      )}

      {/* 6. PROTECTED PLATFORM ADMIN CONSOLE */}
      {isAdminRoute(page) && (
        <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
          <AdminPortal currentUser={user} onNavigateHome={() => navigateTo("")} />
        </ProtectedRoute>
      )}

      {/* 7. PROTECTED SUPER ADMIN HUB */}
      {isSuperAdminRoute(page) && (
        <ProtectedRoute allowedRoles={["super_admin"]}>
          <SuperAdminDashboard currentUser={user} onNavigateHome={() => navigateTo("")} />
        </ProtectedRoute>
      )}

      {page === "cart" && (
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
          <SettingsProvider>
            <CartProvider>
              <AppMain />
            </CartProvider>
          </SettingsProvider>
        </ContentProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
