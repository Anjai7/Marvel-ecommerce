import { useState, useEffect, useCallback } from "react";
import { promoCarouselSlides } from "../data";
import { Button, Badge } from "./ui";
import { ChevronLeft, ChevronRight, ArrowRight, Pause, Play } from "lucide-react";

export default function PromoBannerCarousel() {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  const next = useCallback(() => setCurrent((c) => (c + 1) % promoCarouselSlides.length), []);
  const prev = useCallback(() => setCurrent((c) => (c - 1 + promoCarouselSlides.length) % promoCarouselSlides.length), []);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(next, 5000);
    return () => clearInterval(t);
  }, [paused, next]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e) => setPaused(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <div className="container" style={{ margin: "20px auto" }}>
      <div
        className="promo-carousel"
        id="promo-carousel"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {promoCarouselSlides.map((slide, i) => (
          <div key={i} className={`promo-slide ${i === current ? "active" : ""}`}>
            <div className="offer-ribbon">
              <span className="offer-ribbon-text">INSTANT DISCOUNT 25%</span>
            </div>
            <div className="promo-slide-content">
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <Badge variant="accent" size="sm" className="promo-slide-tag">
                  {slide.tag}
                </Badge>
                <span className="promo-timer-badge">
                  ⚡ ENDS IN 04H 22M
                </span>
              </div>
              <div className="promo-slide-title">{slide.title}</div>
              <div className="promo-slide-highlight">{slide.highlight}</div>
              <div className="promo-slide-desc">{slide.desc}</div>
              <Button
                variant="accent"
                size="md"
                className="promo-slide-btn"
                id={`promo-cta-${i}`}
                rightIcon={<ArrowRight size={16} />}
              >
                {slide.btn}
              </Button>
            </div>
            <div className="promo-slide-images">
              {slide.images.map((src, j) => (
                <div className="promo-img-item" key={j}>
                  <img src={src} alt={`promo-${i}-${j}`} loading="lazy" />
                </div>
              ))}
            </div>
          </div>
        ))}

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

        <div className="promo-carousel-dots" role="tablist" aria-label="Promo slides">
          {promoCarouselSlides.map((_, i) => (
            <button
              key={i}
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
