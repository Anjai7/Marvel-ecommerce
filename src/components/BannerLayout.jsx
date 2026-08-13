import { bannerLayoutData } from "../data";
import { Button, Badge } from "./ui";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export default function BannerLayout() {
  const { large, small1, small2 } = bannerLayoutData;
  return (
    <div className="container" style={{ margin: "20px auto" }}>
      <div className="banner-layout">
        {/* Large left */}
        <motion.div
          className="banner-card banner-card-lg"
          id="banner-home"
          whileHover={{ scale: 1.01 }}
          transition={{ duration: 0.2 }}
        >
          <img src={large.image} alt={large.title} loading="lazy" />
          <div className="banner-overlay" />
          <div className="banner-content">
            <Badge variant="accent" size="sm" style={{ marginBottom: 6 }}>
              Featured Showcase
            </Badge>
            <h3>{large.title}</h3>
            <p>{large.subtitle}</p>
            <Button
              variant="accent"
              size="md"
              className="banner-btn"
              id="banner-home-btn"
              rightIcon={<ArrowRight size={16} />}
            >
              {large.btn}
            </Button>
          </div>
        </motion.div>

        {/* Two stacked right */}
        <div className="banner-right">
          {[small1, small2].map((b, i) => (
            <motion.div
              className="banner-card banner-card-sm"
              key={i}
              id={`banner-sm-${i}`}
              whileHover={{ scale: 1.01 }}
              transition={{ duration: 0.2 }}
            >
              <img src={b.image} alt={b.title} loading="lazy" />
              <div className="banner-overlay" />
              <div className="banner-content">
                <h3 style={{ fontSize: 16 }}>{b.title}</h3>
                <p>{b.subtitle}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="banner-btn"
                  id={`banner-sm-${i}-btn`}
                  style={{ background: "rgba(255,255,255,0.9)", color: "var(--gray-900)" }}
                  rightIcon={<ArrowRight size={14} />}
                >
                  {b.btn}
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
