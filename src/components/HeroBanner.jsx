import { useState, useEffect, useCallback } from "react";
import { heroSlides } from "../data";
import { apiFetchHeroSlides } from "../api/backendApi";
import { Button, Badge } from "./ui";
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
    pngImage: row.product_image_url || "",
    fallbackPng: row.fallback_image_url || "",
    bg: row.bg_gradient || "linear-gradient(135deg, #091322 0%, #172a45 100%)",
    tag: row.tag || "",
    price: row.price_text || "",
    ribbonText: row.ribbon_text || "",
  };
}

export default function HeroBanner() {
  const [liveSlides, setLiveSlides] = useState([]);
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(
    () =>
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  const [touchStart, setTouchStart] = useState(null);

  useEffect(() => {
    let cancelled = false;
    apiFetchHeroSlides()
      .then((rows) => {
        if (cancelled) return;
        const list = (Array.isArray(rows) ? rows : [])
          .filter((s) => s && s.is_active !== false)
          .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
          .map(toRenderSlide)
          .filter((s) => s.title);
        setLiveSlides(list);
      })
      .catch((error) => {
        // Fall back to static heroSlides below, but leave a trace for outages.
        console.error("Failed to load hero slides; using static fallback.", error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Live slides win when non-empty; otherwise static fallback (never blank).
  const slides = liveSlides.length > 0 ? liveSlides : heroSlides;

  useEffect(() => {
    setCurrent((c) => (c >= slides.length ? 0 : c));
  }, [slides.length]);

  const next = useCallback(() => setCurrent((c) => (c + 1) % slides.length), [slides.length]);
  const prev = useCallback(
    () => setCurrent((c) => (c - 1 + slides.length) % slides.length),
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

  return (
    <div
      className="hero-carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
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
