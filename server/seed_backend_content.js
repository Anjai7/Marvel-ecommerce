// ====================================================
// SEED THE BACKEND-OWNED PRODUCT CONTENT
//
//   npm run seed:content-details
//
// Fills the columns and tables the product page reads:
//   * products.brand / sku / offer_text / warranty / highlights /
//     specifications / dimensions / materials / care_instructions /
//     certifications / in_box / delivery_info / user_guide
//   * product_offers, product_reviews, product_variants, product_media
//
// Deterministic and non-destructive:
//   * every row id is derived from the product id + a stable key, so a re-run
//     upserts the same rows instead of duplicating them;
//   * nothing is deleted: gallery rows an admin added to product_media are left
//     untouched, and an existing products.offer_ends_at is preserved;
//   * no extra image URL is invented: the only media row this seed writes is
//     the product's own `image_url` as the hero.
//
// Content is derived from each product's own category/title, so a Headphones
// product gets audio specs and a Laptop gets computing specs — never one
// generic list for every row. Review ratings are spread across 2..5 stars and
// the resulting average differs per product.
//
// Reads the service-role key from `.env` exactly like the other seeds. The key
// is never printed.
// ====================================================

import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * A fixed anchor so a re-run rewrites byte-identical review dates. Bump it to
 * refresh the visible "3 days ago" dates; the ids stay the same either way.
 */
const REVIEW_ANCHOR_MS = Date.UTC(2026, 9, 20, 12, 0, 0);
const DAY_MS = 24 * 60 * 60 * 1000;

/** Deterministic hex tail for an id. */
function suffixFor(key, length = 12) {
  return crypto.createHash("sha256").update(String(key)).digest("hex").slice(0, length);
}

/** A valid-looking UUID derived from `key`; stable across runs. */
function seedUuid(key) {
  const hex = suffixFor(key, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function hashFor(key) {
  return parseInt(suffixFor(key, 8), 16);
}

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function tokenFor(text) {
  return String(text || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
}

const specGroup = (category, items) => ({
  category,
  items: items.map(([label, value]) => ({ label, value })),
});

/* -------------------------------------------------------------------------- */
/* Category profiles                                                          */
/* -------------------------------------------------------------------------- */

const PROFILES = {
  mobile: {
    brand: "Marvel Mobile",
    warranty: "1-year manufacturer warranty on the handset and 6 months on accessories",
    returnDays: 7,
    colors: [
      { label: "Graphite", value: "#1e293b" },
      { label: "Arctic Silver", value: "#cbd5e1" },
      { label: "Ocean Blue", value: "#1d4ed8" },
    ],
    sizes: ["128 GB", "256 GB", "512 GB"],
    dimensions: { height: "16.2 cm", width: "7.4 cm", depth: "0.8 cm", weight: "196 g" },
    highlights: [
      "5G dual-SIM handset with an octa-core processor and 8 GB of RAM",
      "120 Hz AMOLED display with an in-display fingerprint reader",
      "50 MP main camera with night mode and 4K video capture",
      "5,000 mAh battery with 33 W fast charging in the box",
      "Two guaranteed major OS updates and three years of security patches",
    ],
    specGroups: [
      specGroup("Display", [
        ["Size", "6.5 inch"],
        ["Panel", "AMOLED"],
        ["Refresh rate", "120 Hz"],
        ["Resolution", "2400 x 1080"],
      ]),
      specGroup("Performance", [
        ["Processor", "Octa-core 2.4 GHz"],
        ["Memory", "8 GB"],
        ["Storage", "128 GB / 256 GB / 512 GB"],
        ["Operating system", "Android"],
      ]),
      specGroup("Camera & battery", [
        ["Rear camera", "50 MP + 8 MP ultrawide"],
        ["Front camera", "16 MP"],
        ["Battery", "5,000 mAh"],
        ["Charging", "33 W wired"],
      ]),
    ],
    materials: ["Aluminium frame", "Gorilla Glass front", "Recycled polymer back"],
    care: [
      "Use the supplied charger and avoid third-party fast chargers.",
      "Keep the USB-C port dry and free of lint.",
      "Remove the case before wireless charging if the case is thick.",
    ],
    certifications: ["BIS Registered", "CE", "RoHS"],
    inBox: [
      "1x Handset",
      "1x 33 W charger",
      "1x USB-C cable",
      "1x SIM ejector tool",
      "1x Quick start guide",
    ],
    guideSteps: [
      ["Insert the SIM", "Power off, eject the tray and seat the nano-SIM before the first boot."],
      ["Complete setup", "Follow the on-screen wizard and sign in to your account."],
      ["Charge fully", "Charge to 100% before the first full day of use."],
    ],
  },
  audio: {
    brand: "Marvel Audio",
    warranty: "1-year manufacturer warranty covering drivers and battery",
    returnDays: 7,
    colors: [
      { label: "Midnight Black", value: "#111827" },
      { label: "Cloud White", value: "#f1f5f9" },
      { label: "Deep Navy", value: "#1e3a8a" },
    ],
    sizes: ["Standard"],
    dimensions: { height: "19 cm", width: "16.5 cm", depth: "7.5 cm", weight: "250 g" },
    highlights: [
      "Hybrid active noise cancellation with a transparency mode",
      "Custom drivers tuned for a balanced low, mid and high response",
      "Up to 40 hours of playback with USB-C fast charge",
      "Multipoint Bluetooth pairing for two devices at once",
      "Memory-foam ear cushions for long listening sessions",
    ],
    specGroups: [
      specGroup("Audio", [
        ["Driver", "40 mm dynamic"],
        ["Frequency response", "20 Hz - 20,000 Hz"],
        ["Noise cancellation", "Hybrid ANC"],
        ["Microphones", "Beamforming array"],
      ]),
      specGroup("Connectivity", [
        ["Bluetooth", "5.3"],
        ["Range", "Up to 10 m"],
        ["Multipoint", "Two devices"],
        ["Wired input", "3.5 mm / USB-C"],
      ]),
      specGroup("Battery", [
        ["Playback", "Up to 40 hours"],
        ["With ANC", "Up to 28 hours"],
        ["Charging", "USB-C"],
        ["Quick charge", "10 minutes for 4 hours"],
      ]),
    ],
    materials: ["Recycled ABS shell", "Protein leather headband", "Memory-foam cushions"],
    care: [
      "Wipe the cushions with a dry microfibre cloth after use.",
      "Do not immerse the headphones in water.",
      "Store in the supplied pouch when travelling.",
    ],
    certifications: ["CE", "FCC", "RoHS", "BIS Registered"],
    inBox: [
      "1x Headphones",
      "1x USB-C charging cable",
      "1x 3.5 mm audio cable",
      "1x Travel pouch",
      "1x User guide",
    ],
    guideSteps: [
      ["Charge first", "Charge fully with the supplied USB-C cable."],
      [
        "Pair",
        "Hold the power button until the indicator flashes and select the device on your phone.",
      ],
      ["Fit", "Adjust the headband and rotate the earcups for a sealed fit."],
    ],
  },
  computer: {
    brand: "Marvel Computing",
    warranty: "1-year manufacturer warranty on the device and 6 months on the battery",
    returnDays: 7,
    colors: [
      { label: "Space Grey", value: "#4b5563" },
      { label: "Silver", value: "#d1d5db" },
      { label: "Midnight Blue", value: "#1e3a8a" },
    ],
    sizes: ["8 GB / 256 GB", "16 GB / 512 GB", "32 GB / 1 TB"],
    dimensions: { height: "1.6 cm", width: "35.8 cm", depth: "24.6 cm", weight: "1.45 kg" },
    highlights: [
      "High-efficiency processor with a fanless-friendly thermal design",
      "Full-HD IPS display with a matte anti-glare finish",
      "Backlit keyboard and a large precision trackpad",
      "Wi-Fi 6E and Bluetooth 5.3 with a full-size HDMI port",
      "Up to 12 hours of mixed-use battery life",
    ],
    specGroups: [
      specGroup("Display", [
        ["Size", "14 inch"],
        ["Panel", "IPS"],
        ["Resolution", "1920 x 1200"],
        ["Brightness", "300 nits"],
      ]),
      specGroup("Performance", [
        ["Processor", "Octa-core"],
        ["Memory", "8 GB / 16 GB / 32 GB"],
        ["Storage", "256 GB / 512 GB / 1 TB SSD"],
        ["Graphics", "Integrated"],
      ]),
      specGroup("Ports", [
        ["USB-C", "2x with charging"],
        ["USB-A", "1x"],
        ["HDMI", "1x full size"],
        ["Audio", "3.5 mm combo jack"],
      ]),
    ],
    materials: ["Anodised aluminium lid", "Recycled aluminium chassis", "Low-VOC keycaps"],
    care: [
      "Keep the vents clear and never use the laptop on a soft surface.",
      "Clean the screen with a dry microfibre cloth only.",
      "Shut down before transporting it in a padded sleeve.",
    ],
    certifications: ["CE", "FCC", "RoHS", "Energy Star"],
    inBox: ["1x Laptop", "1x USB-C charger", "1x Power cable", "1x Quick start guide"],
    guideSteps: [
      ["Charge and boot", "Connect the charger and power on."],
      ["Finish setup", "Complete the operating-system setup and install updates."],
      ["Register", "Register the serial number for warranty support."],
    ],
  },
  camera: {
    brand: "Marvel Imaging",
    warranty: "2-year manufacturer warranty on the body and 1 year on the lens",
    returnDays: 10,
    colors: [
      { label: "Black", value: "#0f172a" },
      { label: "Graphite", value: "#374151" },
    ],
    sizes: ["Body only", "Body + 18-55 mm kit lens"],
    dimensions: { height: "9.3 cm", width: "13.2 cm", depth: "7.4 cm", weight: "530 g" },
    highlights: [
      "24 MP APS-C sensor with a native ISO range up to 25,600",
      "4K video at 30 fps with a flip-out touchscreen",
      "Hybrid autofocus with subject and eye detection",
      "In-body image stabilisation for handheld shooting",
      "Dual SD slots and USB-C charging",
    ],
    specGroups: [
      specGroup("Sensor", [
        ["Resolution", "24 MP"],
        ["Sensor", "APS-C CMOS"],
        ["ISO range", "100 - 25,600"],
        ["Stabilisation", "In-body"],
      ]),
      specGroup("Video & focus", [
        ["Video", "4K 30 fps"],
        ["Autofocus", "Hybrid phase + contrast"],
        ["Subject detection", "Human and animal"],
        ["Screen", "3 inch flip-out touchscreen"],
      ]),
      specGroup("Storage & power", [
        ["Card slots", "2x SD"],
        ["Battery", "Rechargeable lithium-ion"],
        ["Charging", "USB-C"],
        ["Connectivity", "Wi-Fi and Bluetooth"],
      ]),
    ],
    materials: ["Magnesium-alloy body", "Weather-sealed rubber grips", "Optical glass elements"],
    care: [
      "Store the body with a lens cap fitted and the sensor covered.",
      "Avoid changing lenses in dusty or windy conditions.",
      "Keep the battery charged to at least 40% for long-term storage.",
    ],
    certifications: ["CE", "FCC", "RoHS"],
    inBox: ["1x Camera body", "1x Battery", "1x USB-C cable", "1x Neck strap", "1x Body cap"],
    guideSteps: [
      ["Charge the battery", "Charge fully with the supplied USB-C cable."],
      ["Mount the lens", "Align the lens marks and turn until it clicks."],
      ["Format the card", "Format a fresh SD card in the camera before the first shoot."],
    ],
  },
  gaming: {
    brand: "Marvel Gaming",
    warranty: "1-year manufacturer warranty covering hardware and controls",
    returnDays: 7,
    colors: [
      { label: "Carbon Black", value: "#0b0f19" },
      { label: "Frost White", value: "#e5e7eb" },
      { label: "Nebula Purple", value: "#6d28d9" },
    ],
    sizes: ["Standard", "Pro"],
    dimensions: { height: "10 cm", width: "16 cm", depth: "6.5 cm", weight: "420 g" },
    highlights: [
      "Low-latency wireless connection for fast reaction times",
      "Hall-effect triggers and drift-resistant analogue sticks",
      "Remappable buttons with onboard profile storage",
      "Up to 30 hours of battery life per charge",
      "Textured grips and a balanced weight for long sessions",
    ],
    specGroups: [
      specGroup("Controls", [
        ["Sticks", "Hall-effect analogue"],
        ["Triggers", "Hall-effect"],
        ["Buttons", "Remappable"],
        ["Vibration", "Dual haptics"],
      ]),
      specGroup("Connectivity", [
        ["Wireless", "2.4 GHz dongle"],
        ["Wired", "USB-C"],
        ["Bluetooth", "5.2"],
        ["Range", "Up to 10 m"],
      ]),
      specGroup("Battery", [
        ["Playtime", "Up to 30 hours"],
        ["Charging", "USB-C"],
        ["Standby", "Auto sleep"],
      ]),
    ],
    materials: ["Recycled polycarbonate shell", "Anti-slip rubber grips", "Steel trigger springs"],
    care: [
      "Wipe the grips with a dry cloth after use.",
      "Do not use solvents on the analogue sticks.",
      "Store the dongle in its slot when travelling.",
    ],
    certifications: ["CE", "FCC", "RoHS"],
    inBox: ["1x Controller", "1x USB-C cable", "1x 2.4 GHz dongle", "1x Quick start guide"],
    guideSteps: [
      ["Charge", "Charge fully with the supplied USB-C cable."],
      ["Pair", "Plug in the dongle or hold the pair button for Bluetooth."],
      ["Calibrate", "Run the calibration step in the companion app."],
    ],
  },
  wearable: {
    brand: "Marvel Wearables",
    warranty: "1-year manufacturer warranty covering the watch body and battery",
    returnDays: 7,
    colors: [
      { label: "Midnight", value: "#111827" },
      { label: "Starlight", value: "#e7e5e4" },
      { label: "Forest", value: "#14532d" },
    ],
    sizes: ["40 mm", "44 mm"],
    dimensions: { height: "4.4 cm", width: "3.8 cm", depth: "1.0 cm", weight: "42 g" },
    highlights: [
      "Always-on AMOLED display with an ambient light sensor",
      "Heart-rate, SpO2 and sleep tracking with weekly reports",
      "Built-in GPS for outdoor runs and rides without a phone",
      "5 ATM water resistance for swimming and showers",
      "Up to 14 days of battery life in smart mode",
    ],
    specGroups: [
      specGroup("Display", [
        ["Panel", "AMOLED"],
        ["Always-on", "Yes"],
        ["Glass", "Tempered glass"],
        ["Water resistance", "5 ATM"],
      ]),
      specGroup("Health & sensors", [
        ["Heart rate", "Optical PPG"],
        ["Blood oxygen", "SpO2"],
        ["GPS", "Built-in"],
        ["Sleep tracking", "Yes"],
      ]),
      specGroup("Battery", [
        ["Smart mode", "Up to 14 days"],
        ["GPS mode", "Up to 20 hours"],
        ["Charging", "Magnetic pogo pin"],
      ]),
    ],
    materials: ["Aluminium case", "Fluoroelastomer strap", "Sapphire-coated glass"],
    care: [
      "Rinse the strap with fresh water after swimming.",
      "Dry the charging contacts before placing the watch on the charger.",
      "Avoid tight wrist straps during long workouts.",
    ],
    certifications: ["CE", "RoHS", "BIS Registered"],
    inBox: ["1x Smartwatch", "1x Magnetic charger", "1x Quick start guide"],
    guideSteps: [
      ["Charge", "Charge the watch fully with the magnetic charger."],
      ["Pair", "Install the companion app and pair over Bluetooth."],
      ["Set goals", "Set a daily step and sleep goal in the app."],
    ],
  },
  footwear: {
    brand: "Marvel Footwear",
    warranty: "90-day manufacturer warranty against sole and stitching defects",
    returnDays: 14,
    colors: [
      { label: "Core Black", value: "#111827" },
      { label: "Cloud White", value: "#f8fafc" },
      { label: "Slate Grey", value: "#64748b" },
    ],
    sizes: ["UK 6", "UK 7", "UK 8", "UK 9", "UK 10"],
    dimensions: { height: "11 cm", width: "28 cm", depth: "12 cm", weight: "310 g" },
    highlights: [
      "Breathable knit upper with reinforced heel support",
      "Cushioned EVA midsole for all-day walking comfort",
      "Durable rubber outsole with a multi-direction grip pattern",
      "Padded ankle collar and a removable insole",
      "Lightweight construction at roughly 310 g per shoe",
    ],
    specGroups: [
      specGroup("Upper", [
        ["Material", "Engineered knit"],
        ["Closure", "Lace-up"],
        ["Lining", "Breathable mesh"],
      ]),
      specGroup("Sole", [
        ["Midsole", "EVA foam"],
        ["Outsole", "Rubber"],
        ["Grip", "Multi-direction"],
      ]),
      specGroup("Fit", [
        ["Fit", "Regular"],
        ["Insole", "Removable"],
        ["Heel drop", "8 mm"],
      ]),
    ],
    materials: ["Engineered knit upper", "EVA midsole", "Rubber outsole"],
    care: [
      "Air-dry shoes away from direct heat after use.",
      "Clean the upper with a soft brush and mild soap.",
      "Do not machine-wash or tumble-dry.",
    ],
    certifications: ["BIS Registered"],
    inBox: ["1x Pair of shoes", "1x Spare laces", "1x Care card"],
    guideSteps: [
      ["Try on", "Try the shoes with the socks you will normally wear."],
      ["Lace up", "Adjust the lacing for a snug heel hold."],
      ["Break in", "Wear for short walks for the first three days."],
    ],
  },
  fashion: {
    brand: "Marvel Fashion",
    warranty: "30-day manufacturer warranty against fabric and stitching defects",
    returnDays: 14,
    colors: [
      { label: "Charcoal", value: "#374151" },
      { label: "Off White", value: "#f5f5f4" },
      { label: "Olive", value: "#4d7c0f" },
    ],
    sizes: ["S", "M", "L", "XL", "XXL"],
    dimensions: { height: "2 cm", width: "30 cm", depth: "22 cm", weight: "220 g" },
    highlights: [
      "Soft breathable cotton blend that holds its shape after washing",
      "Regular fit with a clean, reinforced hem",
      "Colour-fast dye tested for repeated washing",
      "Tagless neck label to avoid irritation",
      "Designed for everyday wear across seasons",
    ],
    specGroups: [
      specGroup("Fabric", [
        ["Material", "Cotton blend"],
        ["Weave", "Knit"],
        ["GSM", "180"],
        ["Finish", "Pre-shrunk"],
      ]),
      specGroup("Fit", [
        ["Fit", "Regular"],
        ["Neck", "Round"],
        ["Sleeve", "Short"],
        ["Length", "Hip length"],
      ]),
      specGroup("Care", [
        ["Wash", "Machine wash cold"],
        ["Bleach", "Do not bleach"],
        ["Iron", "Low heat"],
      ]),
    ],
    materials: ["95% cotton", "5% elastane", "Recycled polyester thread"],
    care: [
      "Machine wash cold with similar colours.",
      "Do not bleach or tumble-dry.",
      "Iron on low heat, inside out.",
    ],
    certifications: ["OEKO-TEX Standard 100"],
    inBox: ["1x Apparel item", "1x Care label"],
    guideSteps: [
      ["Check the size", "Compare the chest measurement with the size chart."],
      ["Wash first", "Wash before the first wear to set the dye."],
      ["Dry flat", "Dry in shade to protect the colour."],
    ],
  },
  home: {
    brand: "Marvel Home",
    warranty: "1-year manufacturer warranty against manufacturing defects",
    returnDays: 10,
    colors: [
      { label: "Natural", value: "#e7e5e4" },
      { label: "Charcoal", value: "#3f3f46" },
      { label: "Terracotta", value: "#c2410c" },
    ],
    sizes: ["Standard", "Large"],
    dimensions: { height: "24 cm", width: "32 cm", depth: "26 cm", weight: "1.8 kg" },
    highlights: [
      "Durable food-safe materials built for daily use",
      "Heat-resistant construction up to 180°C",
      "Easy-clean surface that does not retain odours",
      "Stackable design for compact storage",
      "Balanced base for stable handling",
    ],
    specGroups: [
      specGroup("Material", [
        ["Body", "Food-grade material"],
        ["Finish", "Matte"],
        ["Heat resistance", "Up to 180°C"],
      ]),
      specGroup("Dimensions", [
        ["Capacity", "1.5 L"],
        ["Diameter", "24 cm"],
        ["Weight", "1.8 kg"],
      ]),
      specGroup("Care", [
        ["Dishwasher", "Safe"],
        ["Microwave", "Not safe"],
        ["Oven", "Not safe"],
      ]),
    ],
    materials: ["Food-grade stainless steel", "Borosilicate glass", "Silicone seals"],
    care: [
      "Wash with warm soapy water before the first use.",
      "Avoid sudden temperature changes on glass parts.",
      "Dry fully before storing.",
    ],
    certifications: ["BIS Registered", "Food-grade certified"],
    inBox: ["1x Main unit", "1x User guide", "1x Warranty card"],
    guideSteps: [
      ["Unpack", "Remove all packaging and wash the product before use."],
      ["Assemble", "Fit the seal and lid as shown in the guide."],
      ["First use", "Run a plain-water cycle or wash before cooking."],
    ],
  },
  beauty: {
    brand: "Marvel Beauty",
    warranty: "6-month manufacturer warranty against packaging and formulation defects",
    returnDays: 7,
    colors: [
      { label: "Natural", value: "#f5d0c5" },
      { label: "Rose", value: "#e11d48" },
    ],
    sizes: ["30 ml", "50 ml", "100 ml"],
    dimensions: { height: "12 cm", width: "5 cm", depth: "5 cm", weight: "120 g" },
    highlights: [
      "Dermatologically tested formulation for daily use",
      "Free from parabens and mineral oil",
      "Lightweight texture that absorbs without residue",
      "Suitable for all skin types",
      "Sealed pump bottle for hygienic dispensing",
    ],
    specGroups: [
      specGroup("Formulation", [
        ["Type", "Leave-on"],
        ["Skin type", "All skin types"],
        ["Fragrance", "Light"],
      ]),
      specGroup("Usage", [
        ["Frequency", "Twice daily"],
        ["Application", "Face and neck"],
        ["Shelf life", "24 months"],
      ]),
      specGroup("Packaging", [
        ["Bottle", "Recyclable"],
        ["Dispenser", "Pump"],
        ["Seal", "Tamper-evident"],
      ]),
    ],
    materials: ["Recyclable PET bottle", "Polypropylene pump", "FSC-certified carton"],
    care: [
      "Store away from direct sunlight.",
      "Close the cap after each use.",
      "Discontinue if irritation occurs.",
    ],
    certifications: ["Dermatologically tested", "Cruelty-free"],
    inBox: ["1x Product", "1x Outer carton", "1x Usage leaflet"],
    guideSteps: [
      ["Patch test", "Apply a small amount to the inner forearm and wait 24 hours."],
      ["Apply", "Use two pumps on clean, dry skin."],
      ["Store", "Keep the bottle closed and away from heat."],
    ],
  },
  sports: {
    brand: "Marvel Sports",
    warranty: "6-month manufacturer warranty against material and stitching defects",
    returnDays: 10,
    colors: [
      { label: "Black", value: "#0f172a" },
      { label: "Blue", value: "#1d4ed8" },
      { label: "Grey", value: "#6b7280" },
    ],
    sizes: ["S", "M", "L", "XL"],
    dimensions: { height: "12 cm", width: "28 cm", depth: "12 cm", weight: "600 g" },
    highlights: [
      "Moisture-wicking fabric that dries quickly",
      "Reinforced stitching at high-stress seams",
      "Four-way stretch for unrestricted movement",
      "Reflective detail for low-light training",
      "Machine-washable and colour-fast",
    ],
    specGroups: [
      specGroup("Material", [
        ["Fabric", "Polyester blend"],
        ["Stretch", "Four-way"],
        ["Finish", "Moisture-wicking"],
      ]),
      specGroup("Fit", [
        ["Fit", "Athletic"],
        ["Waistband", "Elastic"],
        ["Pockets", "Two"],
      ]),
      specGroup("Care", [
        ["Wash", "Machine wash cold"],
        ["Dry", "Line dry"],
        ["Iron", "Do not iron print"],
      ]),
    ],
    materials: ["Recycled polyester", "Elastane", "Nylon mesh panels"],
    care: ["Wash cold with like colours.", "Do not use fabric softener.", "Line-dry in shade."],
    certifications: ["OEKO-TEX Standard 100"],
    inBox: ["1x Sports item", "1x Care label"],
    guideSteps: [
      ["Choose the size", "Use the size chart and measure the waist or chest."],
      ["Wash first", "Wash before the first use."],
      ["Air dry", "Line-dry to preserve the stretch."],
    ],
  },
  toys: {
    brand: "Marvel Kids",
    warranty: "6-month manufacturer warranty against manufacturing defects",
    returnDays: 10,
    colors: [
      { label: "Multi-colour", value: "#f59e0b" },
      { label: "Sky Blue", value: "#0ea5e9" },
      { label: "Coral", value: "#fb7185" },
    ],
    sizes: ["One size"],
    dimensions: { height: "18 cm", width: "24 cm", depth: "10 cm", weight: "450 g" },
    highlights: [
      "Non-toxic, child-safe materials with rounded edges",
      "Age-appropriate design tested for small parts",
      "Encourages imaginative and motor-skill play",
      "Easy to wipe clean after play",
      "Sturdy construction that survives everyday handling",
    ],
    specGroups: [
      specGroup("Safety", [
        ["Age range", "3 years and up"],
        ["Materials", "Non-toxic"],
        ["Small parts", "None"],
      ]),
      specGroup("Build", [
        ["Pieces", "Complete set"],
        ["Finish", "Wipe-clean"],
        ["Storage", "Box included"],
      ]),
      specGroup("Care", [
        ["Clean", "Wipe with a damp cloth"],
        ["Battery", "Not required"],
      ]),
    ],
    materials: ["BPA-free plastic", "Water-based paint", "Recycled board packaging"],
    care: [
      "Wipe with a damp cloth and mild soap.",
      "Do not submerge electronic parts.",
      "Inspect regularly for loose parts.",
    ],
    certifications: ["BIS Registered", "Non-toxic certified"],
    inBox: ["1x Toy set", "1x Storage box", "1x Instruction sheet"],
    guideSteps: [
      ["Unpack", "Remove all packaging before handing it to a child."],
      ["Assemble", "Fit the parts as shown on the instruction sheet."],
      ["Play", "Supervise play and store the pieces in the box."],
    ],
  },
  accessories: {
    brand: "Marvel Accessories",
    warranty: "6-month manufacturer warranty against connector and material defects",
    returnDays: 7,
    colors: [
      { label: "Black", value: "#111827" },
      { label: "White", value: "#f8fafc" },
      { label: "Navy", value: "#1e3a8a" },
    ],
    sizes: ["Standard", "Large"],
    dimensions: { height: "8 cm", width: "12 cm", depth: "4 cm", weight: "180 g" },
    highlights: [
      "Reinforced strain relief for daily plugging and unplugging",
      "Compact design that fits a laptop sleeve or pocket",
      "Compatible with USB-C and USB-A devices",
      "Over-current and short-circuit protection",
      "Tested for repeated connect and disconnect cycles",
    ],
    specGroups: [
      specGroup("Compatibility", [
        ["Interface", "USB-C / USB-A"],
        ["Devices", "Phones, tablets, laptops"],
        ["Cable length", "1 m"],
      ]),
      specGroup("Build", [
        ["Shell", "Recycled ABS"],
        ["Connector", "Nickel-plated"],
        ["Strain relief", "Reinforced"],
      ]),
      specGroup("Safety", [
        ["Protection", "Over-current"],
        ["Certification", "BIS"],
      ]),
    ],
    materials: ["Recycled ABS shell", "Nickel-plated connectors", "TPE cable jacket"],
    care: [
      "Do not pull the cable by the connector.",
      "Keep the connectors dry and free of dust.",
      "Coil loosely when storing.",
    ],
    certifications: ["BIS Registered", "CE", "RoHS"],
    inBox: ["1x Accessory", "1x User guide"],
    guideSteps: [
      ["Connect", "Plug the accessory in and check the indicator."],
      ["Test", "Charge or connect a device to confirm it works."],
      ["Store", "Coil loosely and keep it dry."],
    ],
  },
  general: {
    brand: "Marvel Select",
    warranty: "1-year manufacturer warranty against manufacturing defects",
    returnDays: 7,
    colors: [
      { label: "Charcoal", value: "#374151" },
      { label: "Natural", value: "#e7e5e4" },
    ],
    sizes: ["Standard"],
    dimensions: { height: "20 cm", width: "20 cm", depth: "10 cm", weight: "500 g" },
    highlights: [
      "Built from durable materials for everyday use",
      "Quality checked before dispatch",
      "Compact packaging with recyclable materials",
      "Backed by the manufacturer warranty",
    ],
    specGroups: [
      specGroup("General", [
        ["Condition", "New"],
        ["Packaging", "Recyclable"],
      ]),
      specGroup("Care", [
        ["Clean", "Wipe with a dry cloth"],
        ["Storage", "Keep in a dry place"],
      ]),
    ],
    materials: ["Recycled materials", "Durable composite"],
    care: ["Wipe with a dry cloth.", "Keep away from moisture."],
    certifications: ["BIS Registered"],
    inBox: ["1x Product", "1x User guide"],
    guideSteps: [
      ["Unpack", "Remove the packaging and check the contents."],
      ["Use", "Follow the included guide."],
      ["Register", "Keep the invoice for warranty support."],
    ],
  },
};

/** Ordered keyword rules; the first match wins. */
const PROFILE_RULES = [
  {
    profile: "audio",
    words: ["headphone", "earbud", "speaker", "soundbar", "microphone", "audio"],
  },
  {
    profile: "mobile",
    words: ["smartphone", "feature phone", "refurbished phone", "mobile", "phone", "mobiles"],
  },
  {
    profile: "computer",
    words: ["laptop", "desktop", "monitor", "printer", "storage", "computer", "computers"],
  },
  {
    profile: "camera",
    words: ["camera", "dslr", "mirrorless", "webcam", "lens", "lenses"],
  },
  { profile: "gaming", words: ["gaming", "console", "controller", "vr headset", "vr"] },
  { profile: "wearable", words: ["watch", "wearable", "smartwatch", "band"] },
  { profile: "footwear", words: ["shoe", "shoes", "footwear", "sneaker", "boot", "sandal"] },
  { profile: "beauty", words: ["beauty", "perfume", "skin", "makeup", "cosmetic", "hair care"] },
  { profile: "toys", words: ["toy", "toys", "baby", "kids"] },
  {
    profile: "sports",
    words: ["sport", "sports", "fitness", "gym", "outdoor", "cycling", "yoga"],
  },
  {
    profile: "home",
    words: ["home", "kitchen", "cookware", "furniture", "decor", "dining", "bedding"],
  },
  {
    profile: "fashion",
    words: ["fashion", "t-shirt", "tshirt", "shirt", "jeans", "dress", "clothing", "apparel"],
  },
  {
    profile: "accessories",
    words: ["accessor", "charger", "power bank", "cable", "case", "cover", "screen guard", "bag"],
  },
  { profile: "electronics", words: ["electronic", "electronics", "gadget", "device"] },
];

const ELECTRONICS_FALLBACK = {
  ...PROFILES.general,
  brand: "Marvel Electronics",
  warranty: "1-year manufacturer warranty against manufacturing defects",
  highlights: [
    "Solid build quality with quality-checked components",
    "Plug-and-play setup with the included guide",
    "Energy-efficient operation",
    "Backed by the manufacturer warranty",
  ],
  specGroups: [
    specGroup("General", [
      ["Condition", "New"],
      ["Packaging", "Recyclable"],
      ["Warranty", "1 year"],
    ]),
    specGroup("Power", [
      ["Source", "Mains / USB"],
      ["Efficiency", "Energy Star rated"],
    ]),
  ],
  certifications: ["CE", "RoHS", "BIS Registered"],
};

/** Pick the content profile for a category label, falling back on the title. */
export function profileFor(category, title = "") {
  const haystack = `${category || ""} ${title || ""}`.toLowerCase();
  for (const rule of PROFILE_RULES) {
    if (rule.words.some((word) => haystack.includes(word))) {
      return rule.profile === "electronics" ? ELECTRONICS_FALLBACK : PROFILES[rule.profile];
    }
  }
  return PROFILES.general;
}

/* -------------------------------------------------------------------------- */
/* Rows                                                                       */
/* -------------------------------------------------------------------------- */

const BANKS = [
  { name: "HDFC Bank", code: "HDFC" },
  { name: "ICICI Bank", code: "ICICI" },
  { name: "Axis Bank", code: "AXIS" },
  { name: "State Bank of India", code: "SBI" },
  { name: "Kotak Mahindra Bank", code: "KOTAK" },
];

const COUPON_PERCENTS = [5, 10, 15];

const EMI_PLANS = [
  { months: 3, rate: 0, interest: "No Cost" },
  { months: 6, rate: 0, interest: "No Cost" },
  { months: 9, rate: 0.03, interest: "3% Standard" },
  { months: 12, rate: 0.05, interest: "5% Standard" },
];

function skuFor(product) {
  const prefix = tokenFor(product.category || "GENERAL").slice(0, 5) || "GEN";
  return `MRV-${prefix}-${suffixFor(`sku:${product.id}`, 6).toUpperCase()}`;
}

/** The new products columns for one product row. */
export function buildProductContent(product) {
  const category = product.category || "General";
  const profile = profileFor(category, product.title);
  const price = Number(product.price) || 0;
  const hash = hashFor(product.id);
  const sku = skuFor(product);

  const standardDays = 2 + (hash % 4);

  return {
    brand: profile.brand,
    sku,
    offer_text: price > 0 ? `No Cost EMI from ₹${round2(price / 6)}/month` : null,
    // `offer_ends_at` is preserved by the caller: a seeded countdown would be
    // fabricated, and a re-run must not erase one an admin set.
    warranty: profile.warranty,
    highlights: [...profile.highlights],
    specifications: [
      specGroup("General", [
        ["Model", product.title || "Product"],
        ["SKU", sku],
        ["Category", category],
        ["Warranty", profile.warranty],
      ]),
      ...profile.specGroups.map((group) => ({
        category: group.category,
        items: group.items.map((item) => ({ ...item })),
      })),
    ],
    dimensions: { ...profile.dimensions },
    materials: [...profile.materials],
    care_instructions: [...profile.care],
    certifications: [...profile.certifications],
    in_box: [...profile.inBox],
    delivery_info: {
      free_shipping: true,
      standard_days: standardDays,
      express_available: true,
      return_days: profile.returnDays,
    },
    user_guide: {
      title: `${product.title || "Product"} — getting started`,
      steps: profile.guideSteps.map(([title, description], index) => ({
        step: index + 1,
        title,
        description,
      })),
    },
  };
}

/** Four EMI rows, one bank offer and one coupon for one product. */
export function buildOffers(product) {
  const price = Number(product.price) || 0;
  const hash = hashFor(product.id);
  const bank = BANKS[hash % BANKS.length];
  const couponPercent = COUPON_PERCENTS[hash % COUPON_PERCENTS.length];
  const couponCode = `${tokenFor(product.category || "MARVEL").slice(0, 6) || "MARVEL"}${couponPercent}`;

  const rows = EMI_PLANS.map((plan, index) => {
    const amount = round2((price * (1 + plan.rate)) / plan.months);
    return {
      id: seedUuid(`offer:${product.id}:emi:${plan.months}`),
      product_id: product.id,
      kind: "emi",
      title: plan.rate === 0 ? `${plan.months}-month No Cost EMI` : `${plan.months}-month EMI`,
      bank: null,
      code: null,
      description: `Pay ₹${amount} per month for ${plan.months} months.`,
      months: plan.months,
      amount,
      interest: plan.interest,
      position: index,
      is_active: true,
    };
  });

  rows.push({
    id: seedUuid(`offer:${product.id}:bank`),
    product_id: product.id,
    kind: "bank",
    title: `${bank.name} Credit Card Offer`,
    bank: bank.name,
    code: `${bank.code}10`,
    description: `10% instant discount up to ₹1,500 on ${bank.name} credit cards.`,
    months: null,
    amount: null,
    interest: null,
    position: EMI_PLANS.length,
    is_active: true,
  });

  rows.push({
    id: seedUuid(`offer:${product.id}:coupon`),
    product_id: product.id,
    kind: "coupon",
    title: `${couponPercent}% off coupon`,
    bank: null,
    code: couponCode,
    description: `Extra ${couponPercent}% off at checkout with this coupon.`,
    months: null,
    amount: null,
    interest: null,
    position: EMI_PLANS.length + 1,
    is_active: true,
  });

  return rows;
}

const REVIEW_AUTHORS = [
  "Aarav Sharma",
  "Priya Nair",
  "Rohan Mehta",
  "Ananya Iyer",
  "Vikram Singh",
  "Neha Kapoor",
  "Arjun Reddy",
  "Ishita Bose",
  "Karan Malhotra",
  "Meera Joshi",
  "Siddharth Rao",
  "Diya Patel",
  "Aditya Kulkarni",
  "Sneha Verma",
];

const REVIEW_TEMPLATES = {
  5: [
    [
      "Exactly as described",
      (title) => `The ${title} arrived well packed and works exactly as described.`,
    ],
    [
      "Excellent purchase",
      (title) => `Very happy with the ${title}. Build quality is excellent for the price.`,
    ],
  ],
  4: [
    [
      "Good value",
      (title) =>
        `The ${title} does what it promises. Delivery was quick and the packaging was intact.`,
    ],
    ["Happy with it", (title) => `Using the ${title} daily and it has held up well so far.`],
  ],
  3: [
    [
      "Decent, with caveats",
      (title) => `The ${title} is fine, though the finish could be better at this price.`,
    ],
    [
      "Average experience",
      (title) => `Works, but the ${title} took longer than expected to arrive.`,
    ],
  ],
  2: [
    [
      "Below expectations",
      (title) => `The ${title} looks different from the photos and feels light.`,
    ],
    ["Needs improvement", (title) => `The ${title} developed a small issue within the first week.`],
  ],
  1: [
    ["Not recommended", (title) => `The ${title} stopped working soon after delivery.`],
    ["Disappointed", (title) => `The ${title} did not match the listing description.`],
  ],
};

/**
 * A deterministic, spread-out set of ratings for one product. The count, the
 * cycle offset and the target average all come from the product id, so two
 * products rarely share the same average.
 */
export function buildRatings(productId) {
  const hash = hashFor(`reviews:${productId}`);
  const count = 4 + (hash % 6); // 4..9
  const targetAverage = 3.5 + ((hash >>> 8) % 14) / 10; // 3.5..4.8
  const cycle = [5, 4, 5, 3, 4, 5, 2];
  const offset = hash % cycle.length;
  const ratings = Array.from(
    { length: count },
    (_, index) => cycle[(index + offset) % cycle.length]
  );

  let sum = ratings.reduce((total, rating) => total + rating, 0);
  const target = Math.round(targetAverage * count);
  let cursor = 0;
  let guard = 0;

  while (sum !== target && guard < count * 10) {
    const index = cursor % count;
    if (sum < target && ratings[index] < 5) {
      ratings[index] += 1;
      sum += 1;
    } else if (sum > target && ratings[index] > 1) {
      ratings[index] -= 1;
      sum -= 1;
    }
    cursor += 1;
    guard += 1;
  }

  return ratings;
}

export function buildReviews(product) {
  const ratings = buildRatings(product.id);
  const hash = hashFor(`reviews:${product.id}`);
  const title = product.title || "this product";
  const authorOffset = hash % REVIEW_AUTHORS.length;

  return ratings.map((rating, index) => {
    const templates = REVIEW_TEMPLATES[rating];
    const [reviewTitle, bodyFor] = templates[(hash + index) % templates.length];
    const daysAgo = (hash % 30) + index * 4;
    const createdAt = new Date(
      REVIEW_ANCHOR_MS - daysAgo * DAY_MS - ((hash + index * 7) % 24) * 60 * 60 * 1000
    ).toISOString();

    return {
      id: seedUuid(`review:${product.id}:${index}`),
      product_id: product.id,
      author_name: REVIEW_AUTHORS[(authorOffset + index) % REVIEW_AUTHORS.length],
      author_avatar: null,
      rating,
      title: reviewTitle,
      body: bodyFor(title),
      is_verified: (hash + index) % 4 !== 0,
      created_at: createdAt,
    };
  });
}

export function buildVariants(product) {
  const profile = profileFor(product.category || "General", product.title);
  const rows = [];

  profile.colors.forEach((color, index) => {
    rows.push({
      id: seedUuid(`variant:${product.id}:color:${index}`),
      product_id: product.id,
      kind: "color",
      label: color.label,
      value: color.value,
      position: index,
      is_active: true,
    });
  });

  profile.sizes.forEach((size, index) => {
    rows.push({
      id: seedUuid(`variant:${product.id}:size:${index}`),
      product_id: product.id,
      kind: "size",
      label: size,
      value: size,
      position: profile.colors.length + index,
      is_active: true,
    });
  });

  return rows;
}

/**
 * Only the product's own image becomes media. No gallery URL is invented: an
 * existing gallery row (added by an admin) is never touched or deleted.
 */
export function buildMedia(product) {
  if (!product.image_url) return [];
  return [
    {
      id: seedUuid(`media:${product.id}:hero`),
      product_id: product.id,
      url: product.image_url,
      kind: "hero",
      position: 0,
      is_active: true,
    },
  ];
}

/* -------------------------------------------------------------------------- */
/* Database                                                                   */
/* -------------------------------------------------------------------------- */

function createServiceClient() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env before seeding product content."
    );
  }
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function upsertInChunks(client, table, rows, chunkSize = 200) {
  for (let start = 0; start < rows.length; start += chunkSize) {
    const chunk = rows.slice(start, start + chunkSize);
    const { error } = await client.from(table).upsert(chunk, { onConflict: "id" });
    if (error) throw new Error(`Could not upsert ${table}: ${error.message}`);
  }
}

/**
 * Every product, read in pages.
 *
 * PostgREST caps a single response at 1000 rows by default, and the cap does
 * not raise an error — it just truncates. A catalogue larger than that would
 * silently leave the tail with no content, so the read is paged explicitly.
 */
async function readProducts(client) {
  const pageSize = 500;
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from("products")
      .select("id, title, category, price, image_url, offer_ends_at")
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Could not read products: ${error.message}`);
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

/**
 * The store's settings rows. Everything the storefront used to hardcode —
 * the currency, the country, the free-shipping threshold, the footer's
 * marketing chrome and the hero's rescue slide — lives here so the admin can
 * change it without a deploy.
 */
const SITE_SETTINGS = [
  {
    key: "currency",
    group_name: "general",
    value: { code: "INR", symbol: "₹", locale: "en-IN" },
  },
  {
    key: "store",
    group_name: "general",
    value: {
      name: "Marvel Market",
      tagline: "Electronics, fashion and lifestyle, delivered across India",
      description:
        "Your ultimate online shopping destination for top electronics, fashion, home essentials, and lifestyle products with unbeatable deals and fast doorstep delivery.",
      country: "India",
      support_email: "support@marvel.com",
      support_phone: "1800-419-0123",
      logo_url: "/header.png",
    },
  },
  {
    key: "shipping",
    group_name: "commerce",
    value: {
      free_threshold: 499,
      standard_days: "2-3 Business Days",
      express_available: true,
      return_days: 14,
    },
  },
  {
    key: "inventory",
    group_name: "commerce",
    value: { low_stock_threshold: 5 },
  },
  {
    key: "footer",
    group_name: "chrome",
    value: {
      value_props: [
        {
          icon: "Truck",
          title: "Free & Fast Delivery",
          subtitle: "On orders over ₹499 across India",
        },
        {
          icon: "RefreshCw",
          title: "7 Days Replacement",
          subtitle: "Easy, hassle-free returns policy",
        },
        {
          icon: "BadgeCheck",
          title: "100% Genuine Products",
          subtitle: "Sourced directly from top brands",
        },
        {
          icon: "Headset",
          title: "24/7 Dedicated Support",
          subtitle: "We're here to help anytime",
        },
      ],
      payment_methods: ["VISA", "Mastercard", "RuPay", "UPI", "PayTM", "NetBanking"],
      socials: [
        { label: "Facebook", href: "#", icon: "Facebook" },
        { label: "Twitter", href: "#", icon: "Twitter" },
        { label: "Instagram", href: "#", icon: "Instagram" },
        { label: "YouTube", href: "#", icon: "Youtube" },
        { label: "LinkedIn", href: "#", icon: "Linkedin" },
      ],
      copyright: `© ${new Date().getFullYear()} Marvel Inc. All Rights Reserved.`,
      security_note: "128-bit SSL Encrypted & Secure Shopping",
      brand_logo: "/header.png",
      brand_alt: "MARVEL MARKET Logo",
    },
  },
  {
    key: "trust",
    group_name: "chrome",
    value: {
      promises: [
        { title: "Free Express Shipping", subtitle: "On every order, no minimum" },
        { title: "Brand Warranty", subtitle: "Backed by the manufacturer" },
        { title: "Easy Returns", subtitle: "Simple, hassle-free returns" },
      ],
    },
  },
  {
    key: "reviews",
    group_name: "commerce",
    value: { allow_write: true },
  },
  {
    key: "hero_fallback",
    group_name: "chrome",
    value: {
      badge: "⚡ SMART TECH SALE",
      title: "Upgrade Your Everyday",
      subtitle: "Next-gen gadgets at prices that don't break the bank. Up to 50% OFF.",
      btn_text: "Shop Now",
      btn_path: "/products",
      bg_gradient: "linear-gradient(135deg, #091322 0%, #172a45 100%)",
    },
  },
];

/**
 * Fill the backend-owned content for every product. Safe to run twice: every
 * write is an upsert keyed by a deterministic id, and nothing is deleted.
 */
export async function seedBackendContent({ client, log = console.log } = {}) {
  const db = client ?? createServiceClient();
  const products = await readProducts(db);

  if (products.length === 0) {
    log("No products found — nothing to seed.");
    return { products: 0, offers: 0, reviews: 0, variants: 0, media: 0, settings: 0 };
  }

  const productRows = products.map((product) => ({
    id: product.id,
    title: product.title,
    price: product.price,
    category: product.category,
    ...buildProductContent(product),
    // Preserve an admin-configured deadline rather than rewriting it to null.
    offer_ends_at: product.offer_ends_at ?? null,
  }));

  const offerRows = products.flatMap((product) => buildOffers(product));
  const reviewRows = products.flatMap((product) => buildReviews(product));
  const variantRows = products.flatMap((product) => buildVariants(product));
  const mediaRows = products.flatMap((product) => buildMedia(product));

  await upsertInChunks(db, "products", productRows);
  await upsertInChunks(db, "product_offers", offerRows);
  await upsertInChunks(db, "product_reviews", reviewRows);
  await upsertInChunks(db, "product_variants", variantRows);
  if (mediaRows.length > 0) await upsertInChunks(db, "product_media", mediaRows);

  // site_settings is keyed by `key`, not `id`, so it needs its own upsert.
  const { error: settingsError } = await db
    .from("site_settings")
    .upsert(SITE_SETTINGS, { onConflict: "key" });
  if (settingsError) throw new Error(`Could not upsert site_settings: ${settingsError.message}`);

  log(`🧩  Updated content columns on ${productRows.length} products.`);
  log(
    `💳  Seeded ${offerRows.length} offers (${EMI_PLANS.length} EMI + 1 bank + 1 coupon per product).`
  );
  log(`⭐  Seeded ${reviewRows.length} reviews across ${products.length} products.`);
  log(`🎨  Seeded ${variantRows.length} colour/size variants.`);
  log(`🖼️  Seeded ${mediaRows.length} hero media rows (no gallery URLs invented).`);
  log(`⚙️  Seeded ${SITE_SETTINGS.length} site settings rows.`);

  return {
    products: productRows.length,
    offers: offerRows.length,
    reviews: reviewRows.length,
    variants: variantRows.length,
    media: mediaRows.length,
    settings: SITE_SETTINGS.length,
  };
}

const isDirectRun =
  typeof process.argv[1] === "string" && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  seedBackendContent()
    .then((counts) => {
      console.log(
        `✅  Content seed complete: ${counts.products} products, ${counts.offers} offers, ` +
          `${counts.reviews} reviews, ${counts.variants} variants, ${counts.media} media.`
      );
    })
    .catch((error) => {
      console.error(`❌ seed:content-details failed: ${error.message}`);
      process.exitCode = 1;
    });
}
