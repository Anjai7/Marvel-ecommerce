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
import { ToastProvider } from "./components/ui";
import { QuickViewDialog } from "./components/product/QuickViewDialog";

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cartCount] = useState(8);
  const [quickViewProduct, setQuickViewProduct] = useState(null);

  const handleQuickView = (product) => {
    setQuickViewProduct(product);
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

        <Header
          isLoggedIn={isLoggedIn}
          onLogin={() => setIsLoggedIn(true)}
          onLogout={() => setIsLoggedIn(false)}
          cartCount={cartCount}
          onMenuOpen={() => setMobileOpen(true)}
          onSelectProduct={handleQuickView}
        />

        {/* Hover nav — includes Browse Categories vertical mega-menu */}
        <HoverNav />

        {/* Hero Carousel */}
        <HeroBanner />

        {/* Category Thumbnails Slider */}
        <CategorySlider />

        {/* Image Grid Banner (1 large left, 2 stacked right) */}
        <BannerLayout />

        {/* Trending Products (15 items grid with 5 per row) */}
        <TrendingProducts onQuickView={handleQuickView} />

        {/* Single Promo Carousel Banner in the Down */}
        <PromoBannerCarousel />

        {/* Featured Products */}
        <FeaturedProducts onQuickView={handleQuickView} />

        {/* Footer & Benefits Bar */}
        <Footer />

        {/* Quick View Dialog Modal / Drawer */}
        <QuickViewDialog
          product={quickViewProduct}
          isOpen={!!quickViewProduct}
          onClose={() => setQuickViewProduct(null)}
        />
      </div>
    </ToastProvider>
  );
}
