import { useState, useEffect, useCallback } from "react";
import { heroSlides } from "../data";
import { Button, Badge } from "./ui";
import { ChevronLeft, ChevronRight, ArrowRight, Sparkles } from "lucide-react";

export default function HeroBanner() {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  const [touchStart, setTouchStart] = useState(null);

  const next = useCallback(() => setCurrent((c) => (c + 1) % heroSlides.length), []);
  const prev = useCallback(() => setCurrent((c) => (c - 1 + heroSlides.length) % heroSlides.length), []);

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
      {heroSlides.map((slide, i) => (
        <div key={i} className={`hero-slide ${i === current ? "active" : ""}`}>
          {/* Base Background Gradient */}
          <div className="hero-slide-bg" style={{ background: slide.bg }} />
          
          {/* Whole Banner Background Image */}
          <img
            className="hero-slide-bg-img"
            src={slide.bgImage || slide.image}
            alt={slide.title}
            loading={i === 0 ? "eager" : "lazy"}
          />
          <div className="hero-slide-overlay" />

          <div className="hero-slide-inner-grid">
            {/* Left Content Column */}
            <div className="hero-content">
              <Badge variant="accent" size="md" className="hero-badge">
                {slide.badge}
              </Badge>
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

            {/* Right Showcase: Small Floating PNG Product Image */}
            <div className="hero-png-showcase">
              <div className="hero-png-card">
                <img
                  className="hero-floating-png"
                  src={slide.pngImage || slide.image}
                  alt={slide.title}
                  loading={i === 0 ? "eager" : "lazy"}
                  onError={(e) => {
                    if (slide.fallbackPng && e.target.src !== slide.fallbackPng) {
                      e.target.src = slide.fallbackPng;
                    }
                  }}
                />
                <div className="hero-png-glow-circle" />
                {slide.tag && (
                  <div className="hero-floating-badge">
                    <span>{slide.tag}</span>
                  </div>
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
        {heroSlides.map((_, i) => (
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
