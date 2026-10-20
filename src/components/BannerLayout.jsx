import { useContent } from "../context/ContentContext";
import { Button, Badge } from "./ui";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { toAppHref } from "./ui/linkTarget";

/** cta_path is a hash route or an absolute https URL (§4.1). */
function followCta(path) {
  if (!path) return;
  if (/^https:\/\//.test(path)) window.location.href = path;
  else window.location.hash = toAppHref(path);
}

function imageOf(banner) {
  return banner.image_url || banner.bg_image_url || "";
}

function BannerCard({ banner, variant, id }) {
  const large = variant === "large";
  return (
    <motion.div
      className={`banner-card ${large ? "banner-card-lg" : "banner-card-sm"}`}
      id={id}
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.2 }}
    >
      {imageOf(banner) && <img src={imageOf(banner)} alt={banner.title} loading="lazy" />}
      <div className="banner-overlay" />
      <div className="banner-content">
        {large && banner.badge && (
          <Badge variant="accent" size="sm" style={{ marginBottom: 6 }}>
            {banner.badge}
          </Badge>
        )}
        <h3 style={large ? undefined : { fontSize: 16 }}>{banner.title}</h3>
        {banner.subtitle && <p>{banner.subtitle}</p>}
        <Button
          variant={large ? "accent" : "outline"}
          size={large ? "md" : "sm"}
          className="banner-btn"
          id={`${id}-btn`}
          style={
            large ? undefined : { background: "rgba(255,255,255,0.9)", color: "var(--gray-900)" }
          }
          rightIcon={<ArrowRight size={large ? 16 : 14} />}
          onClick={() => followCta(banner.cta_path)}
        >
          {banner.cta_text || "Shop Now"}
        </Button>
      </div>
    </motion.div>
  );
}

export default function BannerLayout() {
  const { banners, loading, errors } = useContent();
  const error = errors?.banners ?? null;

  const layout = (Array.isArray(banners) ? banners : [])
    .filter((banner) => banner && banner.placement === "home_banner_layout")
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  const large = layout.find((banner) => banner.variant === "large") ?? null;
  // Spec §3.4: any variant other than `large` renders in a small slot.
  const smalls = layout.filter((banner) => banner.variant !== "large").slice(0, 2);

  const notice = error
    ? "Promotions are temporarily unavailable."
    : loading
      ? "Loading promotions…"
      : layout.length === 0
        ? "No promotions to show yet."
        : null;

  return (
    <div className="container" style={{ margin: "20px auto" }}>
      {notice ? (
        <p style={{ padding: "18px 12px", fontSize: 13, color: "var(--gray-500)" }}>{notice}</p>
      ) : (
        <div className="banner-layout">
          {/* Large left */}
          {large && <BannerCard banner={large} variant="large" id="banner-home" />}

          {/* Two stacked right */}
          {smalls.length > 0 && (
            <div className="banner-right">
              {smalls.map((banner, i) => (
                <BannerCard
                  key={banner.id ?? i}
                  banner={banner}
                  variant="small"
                  id={`banner-sm-${i}`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
