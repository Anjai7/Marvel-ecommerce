import { motion } from "framer-motion";
import { Button, Badge } from "./ui";
import { ArrowRight, Flame } from "lucide-react";

const saleImages = [
  "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=200&h=200&fit=crop",
  "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=200&h=200&fit=crop",
  "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200&h=200&fit=crop",
  "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=200&h=200&fit=crop",
];

export default function SaleBanner() {
  return (
    <div className="container" style={{ margin: "20px auto" }}>
      <motion.div
        className="sale-banner glare-card-effect"
        id="sale-banner"
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
      >
        {/* Subtle Glare overlay effect */}
        <div className="glare-shine" />

        {/* Content */}
        <div className="sale-content">
          <Badge variant="accent" size="md" icon={<Flame size={14} />} className="sale-tag">
            Limited Time Offer
          </Badge>
          <div className="sale-title">
            End of Season Sale<br />
            <span style={{ color: "var(--orange)" }}>Up to 70% Off</span>
          </div>
          <div className="sale-sub">Don't miss out — Grab the best deals before they're gone!</div>
          <Button
            variant="accent"
            size="lg"
            className="sale-btn"
            id="sale-shop-btn"
            rightIcon={<ArrowRight size={18} />}
          >
            Shop Sale Now
          </Button>
        </div>

        {/* Sale Product Images */}
        <div className="sale-images">
          {saleImages.map((src, i) => (
            <motion.div
              className="sale-img-item"
              key={i}
              whileHover={{ scale: 1.06, rotate: i % 2 === 0 ? 2 : -2 }}
              transition={{ duration: 0.2 }}
            >
              <img src={src} alt={`Sale product ${i + 1}`} />
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
