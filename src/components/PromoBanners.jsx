import { promoBannersData } from "../data";
import { Button, Badge } from "./ui";
import { ArrowRight } from "lucide-react";

export default function PromoBanners() {
  return (
    <div className="container">
      <div className="promo-grid">
        {promoBannersData.map((p) => (
          <div key={p.id} id={p.id} className="promo-card" style={{ background: p.bg }}>
            <div className="promo-info">
              <h3>{p.title}</h3>
              <p>{p.subtitle}</p>
              {p.code && (
                <div style={{ margin: "6px 0", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 11, color: "var(--gray-500)" }}>Use Code: </span>
                  <Badge variant="outline" size="sm" className="promo-code-chip">
                    {p.code}
                  </Badge>
                </div>
              )}
              <Button
                variant="accent"
                size="sm"
                className="promo-cta"
                id={`${p.id}-btn`}
                style={{ background: p.accent }}
                rightIcon={<ArrowRight size={14} />}
              >
                {p.btn}
              </Button>
            </div>
            <span className="promo-emoji">{p.emoji}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
