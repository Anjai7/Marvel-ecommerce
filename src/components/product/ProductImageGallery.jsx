import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  ZoomIn, X, Play, Maximize2, Rows, Columns, Sparkles
} from "lucide-react";

export default function ProductImageGallery({ media = [] }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [thumbStart, setThumbStart] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(350); // 350%
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50, mouseX: 0, mouseY: 0 });
  const [lightbox, setLightbox] = useState(false);
  const [orientation, setOrientation] = useState("vertical"); // "vertical" | "horizontal"
  const mainRef  = useRef(null);
  const videoRef = useRef(null);
  const thumbsRef = useRef(null);

  const THUMB_VISIBLE = 5;
  const activeMedia = media[activeIdx] || {};
  const isVideo = activeMedia.type === "video";

  // Stop video when switching away
  useEffect(() => {
    if (videoRef.current) videoRef.current.pause();
  }, [activeIdx]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e) => {
      if (lightbox) {
        if (e.key === "ArrowRight") goNext();
        if (e.key === "ArrowLeft")  goPrev();
        if (e.key === "Escape")     setLightbox(false);
      } else {
        if (e.key === "ArrowRight") goNext();
        if (e.key === "ArrowLeft")  goPrev();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lightbox, activeIdx, media.length]);

  // Keep thumbnail strip in sync
  useEffect(() => {
    if (activeIdx < thumbStart) {
      setThumbStart(activeIdx);
    } else if (activeIdx >= thumbStart + THUMB_VISIBLE) {
      setThumbStart(activeIdx - THUMB_VISIBLE + 1);
    }
  }, [activeIdx]);

  const handleMouseMove = useCallback((e) => {
    if (isVideo || !mainRef.current) return;
    const rect = mainRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const xPercent = (clientX / rect.width) * 100;
    const yPercent = (clientY / rect.height) * 100;
    setZoomPos({
      x: Math.min(100, Math.max(0, xPercent)),
      y: Math.min(100, Math.max(0, yPercent)),
      mouseX: clientX,
      mouseY: clientY,
    });
  }, [isVideo]);

  const scrollThumbs = (dir) => {
    setThumbStart((prev) => {
      const next = prev + dir;
      return Math.max(0, Math.min(next, media.length - THUMB_VISIBLE));
    });
  };

  const visibleThumbs = media.slice(thumbStart, thumbStart + THUMB_VISIBLE);
  const canScrollPrev = thumbStart > 0;
  const canScrollNext = thumbStart + THUMB_VISIBLE < media.length;

  const goNext = () => setActiveIdx((p) => (p + 1) % media.length);
  const goPrev = () => setActiveIdx((p) => (p - 1 + media.length) % media.length);

  return (
    <div className={`pvg-root pvg-layout-${orientation}`} id="product-gallery-root">
      {/* ── Orientation Toggle & Header Tools ── */}
      <div className="pvg-toolbar">
        <span className="pvg-toolbar-title">
          <Sparkles size={14} color="var(--orange)" /> Interactive Gallery &amp; Zoom
        </span>
        <button
          className="pvg-orientation-btn"
          onClick={() => setOrientation(o => o === "vertical" ? "horizontal" : "vertical")}
          title={`Switch to ${orientation === "vertical" ? "Horizontal" : "Vertical"} Thumbnails`}
        >
          {orientation === "vertical" ? <><Rows size={13} /> Horizontal View</> : <><Columns size={13} /> Vertical View</>}
        </button>
      </div>

      {/* ── Thumbnail Strip ── */}
      <div className={`pvg-thumbstrip pvg-thumbstrip-${orientation}`}>
        <button
          className="pvg-thumb-nav pvg-thumb-prev"
          onClick={() => scrollThumbs(-1)}
          disabled={!canScrollPrev}
          aria-label="Previous thumbnails"
        >
          {orientation === "vertical" ? <ChevronUp size={18} /> : <ChevronLeft size={18} />}
        </button>

        <div className="pvg-thumbs" ref={thumbsRef}>
          {visibleThumbs.map((item, i) => {
            const realIdx = thumbStart + i;
            const isThumbVideo = item.type === "video";
            const isActive = realIdx === activeIdx;
            return (
              <button
                key={realIdx}
                className={`pvg-thumb-btn ${isActive ? "active" : ""}`}
                onClick={() => setActiveIdx(realIdx)}
                aria-label={`View media ${realIdx + 1}`}
              >
                <img src={item.thumb} alt={`Thumbnail ${realIdx + 1}`} />
                {isThumbVideo ? (
                  <span className="pvg-thumb-play-overlay">
                    <span className="pvg-thumb-play-icon">
                      <Play size={12} fill="white" />
                    </span>
                    <span className="pvg-thumb-play-label">VIDEO</span>
                  </span>
                ) : (
                  <span className="pvg-thumb-num-badge">#{realIdx + 1}</span>
                )}
              </button>
            );
          })}
        </div>

        <button
          className="pvg-thumb-nav pvg-thumb-next"
          onClick={() => scrollThumbs(1)}
          disabled={!canScrollNext}
          aria-label="Next thumbnails"
        >
          {orientation === "vertical" ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </button>

        {/* Dot indicators */}
        <div className="pvg-dots">
          {media.map((_, i) => (
            <span
              key={i}
              className={`pvg-dot ${i === activeIdx ? "active" : ""}`}
              onClick={() => setActiveIdx(i)}
            />
          ))}
        </div>
      </div>

      {/* ── Main Product Image Viewer ── */}
      <div className="pvg-main-wrap">
        {/* Prev / Next arrows */}
        <button className="pvg-arrow pvg-arrow-left" onClick={goPrev} aria-label="Previous image">
          <ChevronLeft size={22} />
        </button>
        <button className="pvg-arrow pvg-arrow-right" onClick={goNext} aria-label="Next image">
          <ChevronRight size={22} />
        </button>

        {/* Top Floating Actions: Fullscreen + Zoom Level */}
        <div className="pvg-top-actions">
          {!isVideo && (
            <div className="pvg-zoom-controls">
              <button
                className={`pvg-zoom-level-btn ${zoomLevel === 250 ? "active" : ""}`}
                onClick={() => setZoomLevel(250)}
              >
                2.5x
              </button>
              <button
                className={`pvg-zoom-level-btn ${zoomLevel === 400 ? "active" : ""}`}
                onClick={() => setZoomLevel(400)}
              >
                4x
              </button>
            </div>
          )}
          <button className="pvg-fullscreen-btn" onClick={() => setLightbox(true)} aria-label="View fullscreen" title="Expand fullscreen">
            <Maximize2 size={16} />
          </button>
        </div>

        {isVideo ? (
          <div className="pvg-video-wrap">
            <video
              ref={videoRef}
              src={activeMedia.url}
              poster={activeMedia.poster}
              controls
              playsInline
              className="pvg-video"
            />
          </div>
        ) : (
          <div
            ref={mainRef}
            className={`pvg-main-img-wrap ${zoom ? "zooming" : ""}`}
            onMouseEnter={() => !isVideo && setZoom(true)}
            onMouseLeave={() => setZoom(false)}
            onMouseMove={handleMouseMove}
            onClick={() => setLightbox(true)}
          >
            <img
              src={activeMedia.url}
              alt="Product View"
              className="pvg-main-img"
              draggable={false}
            />

            {/* Plugin-like Magnifier Lens Box */}
            {zoom && (
              <div
                className="pvg-zoom-lens"
                style={{
                  backgroundImage: `url(${activeMedia.url})`,
                  backgroundSize: `${zoomLevel}%`,
                  backgroundPosition: `${zoomPos.x}% ${zoomPos.y}%`,
                }}
              />
            )}

            {!zoom && (
              <div className="pvg-zoom-hint">
                <ZoomIn size={14} /> Hover / move cursor to zoom • Click to expand
              </div>
            )}
          </div>
        )}

        {/* Media counter */}
        <div className="pvg-counter">
          {activeMedia.type === "video" ? "▶ Video Showcase" : `Photo ${activeIdx + 1} of ${media.length}`}
        </div>
      </div>

      {/* ── Fullscreen Lightbox Modal ── */}
      {lightbox && (
        <div className="pvg-lightbox" onClick={() => setLightbox(false)}>
          <button className="pvg-lb-close" onClick={() => setLightbox(false)} aria-label="Close modal">
            <X size={24} />
          </button>
          <div className="pvg-lb-inner" onClick={(e) => e.stopPropagation()}>
            <button className="pvg-lb-arrow" onClick={goPrev} aria-label="Previous"><ChevronLeft size={32} /></button>
            {isVideo ? (
              <video src={activeMedia.url} poster={activeMedia.poster} controls autoPlay className="pvg-lb-img" />
            ) : (
              <img src={activeMedia.url} alt="Product Fullscreen" className="pvg-lb-img" />
            )}
            <button className="pvg-lb-arrow" onClick={goNext} aria-label="Next"><ChevronRight size={32} /></button>
          </div>
          {/* Lightbox thumbnails */}
          <div className="pvg-lb-thumbs">
            {media.map((item, i) => (
              <button
                key={i}
                className={`pvg-lb-thumb ${i === activeIdx ? "active" : ""}`}
                onClick={(e) => { e.stopPropagation(); setActiveIdx(i); }}
              >
                <img src={item.thumb} alt="" />
                {item.type === "video" && (
                  <span className="pvg-lb-play"><Play size={12} fill="white" /></span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
