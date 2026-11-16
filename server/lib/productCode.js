/**
 * Product code generator utility for server-side product formatting.
 * Generates human-readable category codes like LAP001 for laptops, PHO001 for phones, etc.
 */

export function generateProductCode(title = "", category = "", idOrIndex = 1) {
  const combined = `${category || ""} ${title || ""}`.toLowerCase();
  let prefix = "PRD";

  if (
    combined.includes("laptop") ||
    combined.includes("notebook") ||
    combined.includes("macbook")
  ) {
    prefix = "LAP";
  } else if (
    combined.includes("headphone") ||
    combined.includes("earphone") ||
    combined.includes("earbuds") ||
    combined.includes("audio") ||
    combined.includes("speaker")
  ) {
    prefix = "AUD";
  } else if (
    combined.includes("smartphone") ||
    combined.includes("mobile") ||
    combined.includes("iphone") ||
    combined.includes("galaxy") ||
    combined.includes("phone")
  ) {
    prefix = "PHO";
  } else if (combined.includes("watch") || combined.includes("wearable")) {
    prefix = "WAT";
  } else if (combined.includes("tablet") || combined.includes("ipad")) {
    prefix = "TAB";
  } else if (combined.includes("camera") || combined.includes("dslr")) {
    prefix = "CAM";
  } else if (
    combined.includes("tv") ||
    combined.includes("television") ||
    combined.includes("display")
  ) {
    prefix = "TEL";
  } else if (
    combined.includes("shoe") ||
    combined.includes("sneaker") ||
    combined.includes("footwear")
  ) {
    prefix = "SHO";
  } else if (
    combined.includes("shirt") ||
    combined.includes("t-shirt") ||
    combined.includes("fashion") ||
    combined.includes("clothing") ||
    combined.includes("apparel") ||
    combined.includes("dress")
  ) {
    prefix = "FAS";
  } else if (
    combined.includes("furniture") ||
    combined.includes("chair") ||
    combined.includes("table") ||
    combined.includes("sofa")
  ) {
    prefix = "FUR";
  } else if (
    combined.includes("beauty") ||
    combined.includes("cosmetic") ||
    combined.includes("skincare")
  ) {
    prefix = "BTY";
  } else if (combined.includes("toy") || combined.includes("baby") || combined.includes("kid")) {
    prefix = "TOY";
  } else if (category && typeof category === "string") {
    const clean = category.replace(/[^a-zA-Z]/g, "").toUpperCase();
    if (clean.length >= 3) prefix = clean.substring(0, 3);
  } else if (title && typeof title === "string") {
    const clean = title.replace(/[^a-zA-Z]/g, "").toUpperCase();
    if (clean.length >= 3) prefix = clean.substring(0, 3);
  }

  let num = 1;
  if (typeof idOrIndex === "number" && !isNaN(idOrIndex)) {
    num = Math.max(1, idOrIndex % 1000 || 1);
  } else if (typeof idOrIndex === "string" && idOrIndex.trim()) {
    const digits = idOrIndex.replace(/\D/g, "");
    if (digits.length > 0) {
      num = parseInt(digits.slice(-3), 10) || 1;
    } else {
      let hash = 0;
      for (let i = 0; i < idOrIndex.length; i += 1) {
        hash = (hash * 31 + idOrIndex.charCodeAt(i)) % 999;
      }
      num = (Math.abs(hash) % 999) + 1;
    }
  }

  const padded = String(num).padStart(3, "0");
  return `${prefix}${padded}`;
}
