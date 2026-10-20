import { useState, useEffect, useCallback } from "react";
import { useContent } from "../context/ContentContext";
import { Button, Badge } from "./ui";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";

/** cta_path is a hash route or an absolute https URL (§4.1). */
function followCta(path) {
  if (!path) return;
  if (/^https:\/\//.test(path)) window.location.href = path;
  else if (path.startsWith("#/")) window.location.hash = path;
  else if (path.startsWith("/")) window.location.hash = `#${path}`;
}

/** A real countdown from `ends_at`; a banner without one gets no timer at all. */
function countdownOf(endsAt, now) {
  if (!endsAt) return null;
  const remaining = new Date(endsAt).getTime() - now;
  if (!Number.isFinite(remaining) || remaining <= 0) return null;

  const totalMinutes = Math.floor(remaining / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}H ${String(minutes).padStart(2, "0")}M`;
}

export default function PromoBannerCarousel() {
  const { banners, loading, errors } = useContent();
  const error = errors?.banners ?? null;
  const [current, setCurrent] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [paused, setPaused] = useState(
    () =>
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  const slides = (Array.isArray(banners) ? banners : [])
    .filter((banner) => banner && banner.placement === "home_promo_carousel")
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

  const next = useCallback(
    () => setCurrent((c) => (slides.length > 0 ? (c + 1) % slides.length : 0)),
    [slides.length]
  );
  const prev = useCallback(
    () => setCurrent((c) => (slides.length > 0 ? (c - 1 + slides.length) % slides.length : 0)),
    [slides.length]
  );

  useEffect(() => {
    setCurrent((c) => (c >= slides.length ? 0 : c));
  }, [slides.length]);

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [paused, next]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e) => setPaused(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const notice = error
    ? "Promotional offers are temporarily unavailable."
    : loading
      ? "Loading promotional offers…"
      : slides.length === 0
        ? "No promotional offers to show yet."
        : null;

  if (notice) {
    return (
      <div className="container" style={{ margin: "20px auto" }}>
        <p style={{ padding: "18px 12px", fontSize: 13, color: "var(--gray-500)" }}>{notice}</p>
      </div>
    );
  }

  return (
    <div className="container" style={{ margin: "20px auto" }}>
      <div
        className="promo-carousel"
        id="promo-carousel"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {slides.map((slide, i) => {
          const countdown = countdownOf(slide.ends_at, now);
          const images = Array.isArray(slide.gallery) ? slide.gallery : [];
          return (
            <div key={slide.id ?? i} className={`promo-slide ${i === current ? "active" : ""}`}>
              <div className="promo-slide-content">
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  {(slide.badge || slide.emoji) && (
                    <Badge variant="accent" size="sm" className="promo-slide-tag">
                      {slide.badge || slide.emoji}
                    </Badge>
                  )}
                  {countdown && <span className="promo-timer-badge">⚡ ENDS IN {countdown}</span>}
                </div>
                <div className="promo-slide-title">{slide.title}</div>
                <div className="promo-slide-highlight">{slide.highlight}</div>
                <div className="promo-slide-desc">{slide.description}</div>
                <Button
                  variant="accent"
                  size="md"
                  className="promo-slide-btn"
                  id={`promo-cta-${i}`}
                  rightIcon={<ArrowRight size={16} />}
                  onClick={() => followCta(slide.cta_path)}
                >
                  {slide.cta_text || "Shop Now"}
                </Button>
              </div>
              <div className="promo-slide-images">
                {images.map((src, j) => (
                  <div className="promo-img-item" key={`${src}-${j}`}>
                    <img src={src} alt={`promo-${i}-${j}`} loading="lazy" />
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <button
          className="promo-carousel-nav pnav-left"
          id="promo-prev"
          onClick={prev}
          aria-label="Previous slide"
        >
          <ChevronLeft size={20} />
        </button>
        <button
          className="promo-carousel-nav pnav-right"
          id="promo-next"
          onClick={next}
          aria-label="Next slide"
        >
          <ChevronRight size={20} />
        </button>

        <div className="promo-carousel-dots" role="toolbar" aria-label="Promo slides">
          {slides.map((slide, i) => (
            <button
              key={slide.id ?? i}
              className={`promo-dot ${i === current ? "active" : ""}`}
              onClick={() => setCurrent(i)}
              id={`promo-dot-${i}`}
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === current}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
