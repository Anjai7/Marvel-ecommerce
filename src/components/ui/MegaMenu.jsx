import React from "react";
import { clsx } from "clsx";
import { Card, CardContent } from "./Card";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { ArrowRight, Sparkles } from "lucide-react";

export const MegaMenuFeaturedCard = React.forwardRef(
  (
    {
      title,
      subtitle,
      badge = "Featured",
      image,
      cta = "Shop Now",
      href = "#",
      className,
      onSelect,
      ...props
    },
    ref
  ) => {
    return (
      <Card
        ref={ref}
        className={clsx("mega-menu-featured-card", className)}
        {...props}
      >
        {image && (
          <div className="mega-menu-featured-image-wrapper">
            <img src={image} alt={title} className="mega-menu-featured-image" />
            {badge && (
              <Badge
                variant="accent"
                size="sm"
                className="mega-menu-featured-badge"
                icon={<Sparkles size={11} />}
              >
                {badge}
              </Badge>
            )}
          </div>
        )}
        <CardContent className="mega-menu-featured-content">
          {title && <h5 className="mega-menu-featured-title">{title}</h5>}
          {subtitle && <p className="mega-menu-featured-subtitle">{subtitle}</p>}
          {cta && (
            <Button
              variant="outline"
              size="sm"
              className="mega-menu-featured-btn"
              rightIcon={<ArrowRight size={14} />}
              onClick={onSelect}
            >
              {cta}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }
);
MegaMenuFeaturedCard.displayName = "MegaMenuFeaturedCard";

export const MegaMenuSection = React.forwardRef(
  ({ title, icon: IconComponent, items = [], className, onItemClick, ...props }, ref) => {
    return (
      <div ref={ref} className={clsx("mega-menu-col", className)} {...props}>
        {title && (
          <h4 className="mega-menu-section-header">
            {IconComponent && (
              <span className="mega-menu-section-icon">
                {typeof IconComponent === "string" ? (
                  IconComponent
                ) : (
                  <IconComponent size={16} />
                )}
              </span>
            )}
            <span className="mega-menu-section-title">{title}</span>
          </h4>
        )}

        <ul className="mega-menu-item-list" role="menu">
          {items.map((item, idx) => {
            const isObject = typeof item === "object" && item !== null;
            const label = isObject ? item.label || item.name : item;
            const itemBadge = isObject ? item.badge : null;
            const badgeVariant = isObject ? item.badgeVariant || "accent" : "accent";
            const itemHref = isObject ? item.href || "#" : "#";
            const icon = isObject ? item.icon : null;

            return (
              <li
                key={label || idx}
                className="mega-menu-item-wrapper"
                role="none"
              >
                <a
                  href={itemHref}
                  className="mega-menu-item-link"
                  role="menuitem"
                  tabIndex={0}
                  onClick={() => {
                    if (onItemClick) onItemClick(item);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      if (onItemClick) onItemClick(item);
                    }
                  }}
                >
                  <span className="mega-menu-item-text-group">
                    {icon && <span className="mega-menu-item-icon">{icon}</span>}
                    <span className="mega-menu-item-label">{label}</span>
                  </span>
                  {itemBadge && (
                    <Badge variant={badgeVariant} size="sm" className="mega-menu-item-badge">
                      {itemBadge}
                    </Badge>
                  )}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }
);
MegaMenuSection.displayName = "MegaMenuSection";

export const MegaMenuColumn = MegaMenuSection;

export const MegaMenu = React.forwardRef(
  ({ data, columns, featured, alignRight = false, className, onItemClick, ...props }, ref) => {
    // Normalization: data can be an array of columns OR an object { columns: [...], featured: {...} }
    let rawColumns = [];
    let rawFeatured = featured;

    if (Array.isArray(data)) {
      rawColumns = data;
    } else if (data && typeof data === "object") {
      rawColumns = data.columns || data.sections || [];
      if (!rawFeatured && data.featured) {
        rawFeatured = data.featured;
      }
    } else if (Array.isArray(columns)) {
      rawColumns = columns;
    }

    const colCount = Math.min(rawColumns.length, 4);

    return (
      <div
        ref={ref}
        role="region"
        aria-label="Mega menu navigation"
        className={clsx(
          "mega-menu",
          alignRight ? "align-right" : "align-left",
          rawFeatured && "has-featured",
          className
        )}
        style={{
          "--cols": colCount,
        }}
        {...props}
      >
        <div className="mega-menu-grid">
          {rawColumns.map((col, idx) => (
            <MegaMenuSection
              key={col.title || idx}
              title={col.title}
              icon={col.icon}
              items={col.items}
              onItemClick={onItemClick}
            />
          ))}
        </div>

        {rawFeatured && (
          <div className="mega-menu-featured-column">
            <MegaMenuFeaturedCard
              {...rawFeatured}
              onSelect={() => onItemClick && onItemClick(rawFeatured)}
            />
          </div>
        )}
      </div>
    );
  }
);
MegaMenu.displayName = "MegaMenu";

export default MegaMenu;
