import { useState } from "react";
import Header from "./components/Header";
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

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cartCount] = useState(8);
  const [quickViewProduct, setQuickViewProduct] = useState(null);
  const [currentPage, setCurrentPage] = useState("home"); // "home" | "product"

  const handleQuickView = (product) => {
    setQuickViewProduct(product);
  };

  const navigateToProduct = () => {
    setQuickViewProduct(null);
    setCurrentPage("product");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const navigateHome = () => {
    setCurrentPage("home");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <ToastProvider>
      <div className="app">
        <MobileMenu
          isOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
          isLoggedIn={isLoggedIn}
          onLogin={() => setIsLoggedIn(true)}
        />

        <div className="sticky-header-wrapper">
          <Header
            isLoggedIn={isLoggedIn}
            onLogin={() => setIsLoggedIn(true)}
            onLogout={() => setIsLoggedIn(false)}
            cartCount={cartCount}
            onMenuOpen={() => setMobileOpen(true)}
            onSelectProduct={handleQuickView}
          />

          {currentPage === "home" && <HoverNav />}
        </div>

        {currentPage === "home" && (
          <>
            {/* Hero Carousel */}
            <HeroBanner />

            {/* Category Thumbnails Slider */}
            <CategorySlider />

            {/* Image Grid Banner (1 large left, 2 stacked right) */}
            <BannerLayout />

            {/* Trending Products (15 items grid with 5 per row) */}
            <TrendingProducts onQuickView={handleQuickView} onNavigate={navigateToProduct} />

            {/* Single Promo Carousel Banner in the Down */}
            <PromoBannerCarousel />

            {/* Featured Products */}
            <FeaturedProducts onQuickView={handleQuickView} onNavigate={navigateToProduct} />

            {/* Footer & Benefits Bar */}
            <Footer />
          </>
        )}

        {currentPage === "product" && (
          <ProductViewPage
            onBack={navigateHome}
            onSelectProduct={navigateToProduct}
          />
        )}

        {/* Floating Return to Top Button */}
        <ScrollToTop />

        {/* Quick View Dialog Modal / Drawer */}
        <QuickViewDialog
          product={quickViewProduct}
          isOpen={!!quickViewProduct}
          onClose={() => setQuickViewProduct(null)}
          onViewFull={navigateToProduct}
        />
      </div>
    </ToastProvider>
  );
}
