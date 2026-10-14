# 🛒 Marvel - Premium Tech E-Commerce Marketplace

A refined, high-performance, and visually stunning tech e-commerce platform built using **React** and **Vite**, featuring premium UX patterns inspired by industry leaders like Amazon and Flipkart.

---

## ✨ Features & Interactions

### 🛍️ Smart Shopping & Navigation
* **Stable Category Dropdowns**: Hover-safe mega menu interaction with a 260ms mouseleave debounce and invisible cursor bridges preventing accidental closes or HMR flickers.
* **Intelligent Mega Dropdown Alignment**: Dropdowns in the second half of the navigation bar automatically align to the right to prevent horizontal page overflow and clipping.
* **Layered Elevation System**: Product cards designed with soft dual-layer shadows, vertical lift on hover, and an elegant gradient highlight top rim.

### 🎧 Amazon-Style Product detail Page
* **Sticky Media Gallery Column**: The product image gallery stays locked to the viewport side during scrolling, freeing naturally as soon as the details section ends to avoid overlapping other sections.
* **Vertical & Horizontal Thumbnail Modes**: Dynamic vertical-to-horizontal thumbnail strip adjustments based on device size.
* **Plugin-Style Magnifier Zoom**: Cursor-tracking main image lens magnifier supporting `2.5x` and `4x` selectable zoom levels.
* **Full-Screen Lightbox**: Immersive fullscreen gallery with smooth navigation.

### 📊 Rich Product Information Sections
* **Horizontal Carousel Tabs**: Horizontal tab bar that scrolls smoothly on swipe or via circular navigation arrows. Active tabs dynamically slide into center view.
* **Structured EMI & Partner Bank Offers**: Dash-border partner bank rows with one-click copyable promo codes and EMI breakdown cards.
* **Multi-Step Feedback & Price Match Form**: Interactive 3-step reporting wizard.
* **Regulatory Compliance**: Quality certifications, origin details, HSN, and GST compliance tables.

---

## 🎨 Design System

Consistently styled according to a highly polished brand palette:
* **Primary**: Lighter Flipkart-inspired Navy Blue (`#2874f0`) for primary navigation and core branding elements.
* **Secondary / CTA**: Radiant action Orange (`#ff6100`) for primary buy flows and Add to Cart buttons.
* **Success**: Rich Emerald Green for savings, promotions, and verified stock indicators.
* **Base**: Clean solid white cards overlaying soft cool-gray gradients (`linear-gradient(180deg, #f1f4f8 0%, #e2e8f0 100%)`) for excellent visual contrast.

---

## 🚀 Getting Started

### Prerequisites
Make sure you have Node.js 22.12 or newer and npm 10 or newer. The repository includes a `.nvmrc` for nvm users. Browser checks use the installed Chrome channel on Windows by default (override with `PLAYWRIGHT_CHANNEL`) and Playwright Chromium in CI.

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/Anjai7/Marvel-ecommerce.git
   cd Marvel-ecommerce
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the API and Vite together:
   ```bash
   npm run dev:all
   ```
   Open [http://localhost:5173/](http://localhost:5173/) in your browser. Use `npm run dev` when you only need the frontend.

### Quality checks
```bash
npm run check       # Oxlint, unit/component tests, and production build
npm run test:e2e    # Playwright browser and accessibility checks
npm run audit       # high/critical npm vulnerability gate
```

Prettier, EditorConfig, and Lefthook keep formatting and pre-commit checks consistent. Run `npm run format` to format the project, or `npm run format:check` to inspect formatting without writing files. The repository currently has a legacy formatting baseline (97 files at setup time), so avoid a whole-tree `npm run format` during focused changes. `npm run build:analyze` creates `dist/bundle-report.html`, and `npm run analyze:unused` reports dead code and unused dependencies.

### Building for Production
To build the application for deployment:
```bash
npm run build
```
This generates a minified, production-ready bundle in the `dist` directory.
