import { useState, useEffect, useCallback } from "react";
import { useContent } from "../context/ContentContext";
import { Button, Badge } from "./ui";
import { toAppHref } from "./ui/linkTarget";
import { ChevronLeft, ChevronRight, ArrowRight, Sparkles } from "lucide-react";

/** Map a DB hero_slides row to the render shape used by the carousel. */
function toRenderSlide(row) {
  return {
    badge: row.badge || "",
    title: row.title || "",
    subtitle: row.subtitle || "",
    btn: row.btn_text || "Shop Now",
    btnPath: row.btn_path || "/products",
    bgImage: row.bg_image_url || "",
    image: row.bg_image_url || row.product_image_url || "",
    bg: row.bg_gradient || "linear-gradient(135deg, #091322 0%, #172a45 100%)",
    price: row.price_text || "",
  };
}

/** The only static fallback kept on the storefront: the homepage is never blank. */
const FALLBACK_SLIDE = {
  badge: "⚡ SMART TECH SALE",
  title: "Upgrade Your Everyday",
  subtitle: "Next-gen gadgets at prices that don't break the bank. Up to 50% OFF.",
  btn: "Shop Now",
  btnPath: "/products",
  bgImage: "",
  image: "",
  bg: "linear-gradient(135deg, #091322 0%, #172a45 100%)",
  price: "",
};

export default function HeroBanner({ onNavigate }) {
  const { hero, loading, errors } = useContent();
  const heroError = errors?.hero ?? null;
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(
    () =>
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  const [touchStart, setTouchStart] = useState(null);

  const liveSlides = (Array.isArray(hero) ? hero : [])
    .filter((slide) => slide && slide.is_active !== false && slide.title)
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
    .map(toRenderSlide);
  // The static slide is a rescue, not a placeholder: it appears only when the
  // hero fetch failed or the load settled with nothing, never while loading.
  const settled = !loading;
  const showFallback = heroError !== null || (settled && liveSlides.length === 0);
  const slides = liveSlides.length > 0 ? liveSlides : showFallback ? [FALLBACK_SLIDE] : [];

  useEffect(() => {
    setCurrent((c) => (c >= slides.length ? 0 : c));
  }, [slides.length]);

  const next = useCallback(
    () => setCurrent((c) => (slides.length > 0 ? (c + 1) % slides.length : 0)),
    [slides.length]
  );
  const prev = useCallback(
    () => setCurrent((c) => (slides.length > 0 ? (c - 1 + slides.length) % slides.length : 0)),
    [slides.length]
  );

  useEffect(() => {
    if (paused) return;
    const t = setInterval(next, 4500);
    return () => clearInterval(t);
  }, [paused, next]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e) => setPaused(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const handleTouchStart = (e) => setTouchStart(e.touches[0].clientX);
  const handleTouchEnd = (e) => {
    if (touchStart === null) return;
    const diff = touchStart - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) next();
      else prev();
    }
    setTouchStart(null);
  };

  /** btn_path is a hash route or an absolute https URL (§4.1). */
  const followCta = (path) => {
    if (!path) return;
    // An external URL never belongs on the in-app router.
    if (/^https:\/\//.test(path)) {
      window.location.href = path;
      return;
    }
    if (onNavigate) {
      onNavigate(toAppHref(path));
      return;
    }
    window.location.hash = toAppHref(path);
  };

  return (
    <div
      className="hero-carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {heroError && (
        <div
          role="status"
          style={{
            position: "absolute",
            top: 10,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 5,
            padding: "6px 14px",
            borderRadius: 999,
            background: "rgba(15, 23, 42, 0.82)",
            color: "#f8fafc",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          Live hero content is unavailable — showing the default slide.
        </div>
      )}

      {slides.map((slide, i) => (
        <div key={i} className={`hero-slide ${i === current ? "active" : ""}`}>
          {/* Base Background Gradient */}
          <div className="hero-slide-bg" style={{ background: slide.bg }} />

          {/* Whole Banner Background Image */}
          {(slide.bgImage || slide.image) && (
            <img
              className="hero-slide-bg-img"
              src={slide.bgImage || slide.image}
              alt={slide.title}
              loading={i === 0 ? "eager" : "lazy"}
            />
          )}
          <div className="hero-slide-overlay" />

          <div className="hero-slide-inner-grid">
            {/* Left Content Column */}
            <div className="hero-content">
              {slide.badge && (
                <Badge variant="accent" size="md" className="hero-badge">
                  {slide.badge}
                </Badge>
              )}
              <h1 className="hero-title">{slide.title}</h1>
              <p className="hero-sub">{slide.subtitle}</p>

              <div className="hero-actions-row">
                <Button
                  variant="accent"
                  size="lg"
                  className="hero-cta"
                  id={`hero-cta-${i}`}
                  rightIcon={<ArrowRight size={18} />}
                  onClick={() => followCta(slide.btnPath)}
                >
                  {slide.btn}
                </Button>
                {slide.price && (
                  <span className="hero-price-pill">
                    <Sparkles size={13} color="#f59e0b" />
                    {slide.price}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Navigation Arrows */}
      <button
        className="hero-nav-btn hero-nav-left"
        id="hero-prev"
        onClick={prev}
        aria-label="Previous slide"
        style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <ChevronLeft size={24} color="#fff" />
      </button>

      <button
        className="hero-nav-btn hero-nav-right"
        id="hero-next"
        onClick={next}
        aria-label="Next slide"
        style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <ChevronRight size={24} color="#fff" />
      </button>

      {/* Centered Slider Indicators (Dots) */}
      <div className="hero-dots" role="toolbar" aria-label="Hero slides">
        {slides.map((_, i) => (
          <button
            key={i}
            className={`hero-dot ${i === current ? "active" : ""}`}
            onClick={() => setCurrent(i)}
            id={`hero-dot-${i}`}
            aria-label={`Go to slide ${i + 1}`}
            aria-current={i === current}
          />
        ))}
      </div>
    </div>
  );
}
