import HeroBanner from "../HeroBanner";
import CategorySlider from "../CategorySlider";
import BannerLayout from "../BannerLayout";
import TrendingProducts from "../TrendingProducts";
import PromoBannerCarousel from "../PromoBannerCarousel";
import FeaturedProducts from "../FeaturedProducts";
import Footer from "../Footer";

/**
 * Main customer storefront landing page view.
 */
export default function StorefrontHome({ onNavigate, onSelectProduct, onQuickView }) {
  return (
    <>
      <HeroBanner onNavigate={onNavigate} />
      <CategorySlider />
      <BannerLayout />
      <TrendingProducts
        onQuickView={onQuickView}
        onNavigate={onSelectProduct}
        onSelectProduct={onSelectProduct}
      />
      <PromoBannerCarousel />
      <FeaturedProducts
        onQuickView={onQuickView}
        onNavigate={onSelectProduct}
        onSelectProduct={onSelectProduct}
      />
      <Footer />
    </>
  );
}
