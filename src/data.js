// ─── Navigation ───────────────────────────────────────────────
export const navCategories = [
  { name: "All Categories", hasDropdown: false },
  { name: "Electronics", hasDropdown: true },
  { name: "Fashion", hasDropdown: true },
  { name: "Home & Kitchen", hasDropdown: true },
  { name: "Beauty", hasDropdown: true },
  { name: "Sports", hasDropdown: true },
  { name: "Toys & Baby", hasDropdown: true },
  { name: "Books", hasDropdown: false },
  { name: "Accessories", hasDropdown: true },
  { name: "More", hasDropdown: false },
];

// ─── Mega Menu ────────────────────────────────────────────────
export const megaMenuData = {
  Electronics: {
    columns: [
      {
        title: "Mobiles",
        icon: "📱",
        items: [
          { label: "Smartphones", badge: "Hot", badgeVariant: "accent" },
          "Feature Phones",
          "Mobile Accessories",
          { label: "Refurbished Phones", badge: "Deals", badgeVariant: "secondary" },
        ],
      },
      {
        title: "Computers",
        icon: "💻",
        items: [
          { label: "Laptops", badge: "Popular", badgeVariant: "accent" },
          "Desktops",
          "Monitors",
          "Printers",
          "Storage Devices",
        ],
      },
      {
        title: "Audio",
        icon: "🎧",
        items: [
          "Headphones",
          { label: "Earbuds", badge: "New", badgeVariant: "success" },
          "Speakers",
          "Soundbars",
          "Microphones",
        ],
      },
      {
        title: "Cameras",
        icon: "📷",
        items: [
          "DSLR Cameras",
          "Mirrorless",
          "Action Cameras",
          "Webcams",
          "Lenses",
        ],
      },
      {
        title: "Accessories",
        icon: "🔌",
        items: [
          "Chargers",
          "Power Banks",
          "Cables",
          "Cases & Covers",
          "Screen Guards",
        ],
      },
      {
        title: "Gaming",
        icon: "🎮",
        items: [
          { label: "Consoles", badge: "New", badgeVariant: "success" },
          "Controllers",
          "Gaming Headsets",
          "Gaming Chairs",
          "VR Headsets",
        ],
      },
    ],
  },
  Fashion: [
    { title: "Men's Fashion", icon: "👔", items: ["T-Shirts", "Shirts", "Jeans & Trousers", "Formal Wear", "Ethnic Wear"] },
    { title: "Women's Fashion", icon: "👗", items: ["Dresses", "Tops & Tees", "Sarees", "Ethnic Wear", "Western Wear"] },
    { title: "Kids", icon: "👕", items: ["Boys Clothing", "Girls Clothing", "Baby Clothes", "School Uniforms"] },
    { title: "Footwear", icon: "👟", items: ["Sneakers", "Sandals", "Heels & Wedges", "Sports Shoes", "Formal Shoes"] },
    { title: "Accessories", icon: "👜", items: ["Bags & Handbags", "Watches", "Sunglasses", "Jewelry", "Belts & Wallets"] },
  ],
  "Home & Kitchen": [
    { title: "Furniture", icon: "🛋️", items: ["Sofas & Seating", "Beds & Mattresses", "Dining Tables", "Chairs", "Wardrobes"] },
    { title: "Kitchen", icon: "🍳", items: ["Cookware Sets", "Kitchen Appliances", "Food Storage", "Cutlery", "Kitchen Tools"] },
    { title: "Decor", icon: "🖼️", items: ["Wall Art", "Lighting", "Clocks & Mirrors", "Vases & Plants", "Curtains"] },
    { title: "Bedding", icon: "🛏️", items: ["Bed Sheets", "Pillows & Cushions", "Blankets", "Comforters", "Mattress Protectors"] },
    { title: "Cleaning", icon: "🧹", items: ["Vacuum Cleaners", "Mops & Brooms", "Cleaning Agents", "Air Purifiers"] },
  ],
  Beauty: [
    { title: "Skincare", icon: "✨", items: ["Moisturizers", "Serums & Essence", "Sunscreen", "Face Wash", "Toners & Mists"] },
    { title: "Makeup", icon: "💄", items: ["Lipstick & Lip Gloss", "Foundation", "Mascara & Eyeliner", "Eyeshadow", "Blush & Bronzer"] },
    { title: "Haircare", icon: "💇", items: ["Shampoo", "Conditioner", "Hair Oils & Serums", "Hair Dryers", "Styling Tools"] },
    { title: "Fragrances", icon: "🌸", items: ["Perfumes for Women", "Perfumes for Men", "Deodorants", "Body Sprays"] },
  ],
  Sports: [
    { title: "Fitness", icon: "💪", items: ["Gym Equipment", "Yoga Mats & Props", "Resistance Bands", "Dumbbells", "Treadmills"] },
    { title: "Outdoor", icon: "🏕️", items: ["Camping Gear", "Trekking & Hiking", "Cycling Accessories", "Swimming Gear"] },
    { title: "Team Sports", icon: "⚽", items: ["Cricket", "Football", "Badminton", "Basketball", "Tennis"] },
    { title: "Sports Wear", icon: "🏃", items: ["Running Shoes", "Sports T-Shirts", "Track Pants", "Sports Caps", "Compression Wear"] },
  ],
  "Toys & Baby": [
    { title: "Toys", icon: "🧸", items: ["Action Figures", "Board Games", "Educational Toys", "Remote Control Toys", "Dolls"] },
    { title: "Baby Care", icon: "👶", items: ["Diapers", "Baby Food & Formula", "Baby Monitors", "Baby Clothes", "Strollers"] },
    { title: "Learning", icon: "🎨", items: ["Art & Craft Kits", "Puzzles", "STEM Toys", "Activity Books", "Musical Toys"] },
  ],
  Accessories: [
    { title: "Watches", icon: "⌚", items: ["Smartwatches", "Analog Watches", "Digital Watches", "Luxury Watches", "Sports Watches"] },
    { title: "Bags", icon: "👜", items: ["Backpacks", "Handbags & Clutches", "Wallets", "Luggage & Trolleys", "Travel Bags"] },
    { title: "Jewelry", icon: "💍", items: ["Gold Jewelry", "Silver Jewelry", "Rings", "Necklaces & Chains", "Earrings & Studs"] },
    { title: "Eyewear", icon: "👓", items: ["Sunglasses", "Reading Glasses", "Blue Light Glasses", "Contact Lenses"] },
  ],
};

// ─── Vertical Category Menu ───────────────────────────────────
export const verticalCategories = [
  { icon: "📱", name: "Mobiles & Tablets", subs: ["Smartphones", "Tablets", "Mobile Accessories", "Smartwatches", "Feature Phones"] },
  { icon: "💻", name: "Laptops & Computers", subs: ["Laptops", "Desktops & All-in-One", "Monitors", "Printers & Scanners", "PC Accessories"] },
  { icon: "⚡", name: "Electronics", subs: ["Televisions", "Cameras & Accessories", "Smart Home Devices", "Gaming Consoles", "Audio & Video"] },
  { icon: "👗", name: "Fashion", subs: ["Men's Clothing", "Women's Clothing", "Kids' Fashion", "Footwear", "Ethnic Wear"] },
  { icon: "🏠", name: "Home & Kitchen", subs: ["Furniture & Decor", "Kitchen Appliances", "Bedding & Bath", "Garden & Outdoor", "Cleaning Supplies"] },
  { icon: "✨", name: "Beauty", subs: ["Skincare", "Makeup & Cosmetics", "Haircare", "Fragrances", "Personal Hygiene"] },
  { icon: "⚽", name: "Sports", subs: ["Fitness Equipment", "Outdoor Sports", "Team Sports", "Sports Apparel", "Cycling"] },
  { icon: "🧸", name: "Toys & Baby", subs: ["Toys & Games", "Baby Care Essentials", "Educational Toys", "Baby Clothing", "Nursery Furniture"] },
  { icon: "📚", name: "Books", subs: ["Fiction & Literature", "Non-Fiction", "Textbooks & Study", "Comics & Manga", "Children's Books"] },
  { icon: "👜", name: "Accessories", subs: ["Watches", "Bags & Luggage", "Jewelry", "Eyewear", "Belts & Wallets"] },
  { icon: "🎮", name: "Gaming", subs: ["Consoles & Systems", "Video Games", "Gaming Accessories", "Gaming Chairs & Desks", "VR & AR"] },
  { icon: "🍳", name: "Appliances", subs: ["Refrigerators", "Washing Machines", "Microwaves & OTGs", "Air Conditioners", "Small Appliances"] },
];

// ─── Hero Slides ──────────────────────────────────────────────
export const heroSlides = [
  {
    badge: "⚡ SMART TECH SALE",
    title: "Upgrade Your\nEveryday",
    subtitle: "Next-gen gadgets at prices that don't break the bank. Up to 50% OFF.",
    btn: "Shop Electronics",
    image: "https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=900&h=420&fit=crop&q=85",
    bg: "#0f2444",
  },
  {
    badge: "✨ FASHION WEEK SALE",
    title: "Style That\nSpeaks Volumes",
    subtitle: "Premium designer apparel & footwear. Up to 60% OFF.",
    btn: "Shop Fashion",
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=900&h=420&fit=crop&q=85",
    bg: "#1a0a2e",
  },
  {
    badge: "🏠 HOME & KITCHEN DEALS",
    title: "Elevate Your\nLiving Space",
    subtitle: "Transform your home with premium essentials. Up to 40% OFF.",
    btn: "Shop Home",
    image: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=900&h=420&fit=crop&q=85",
    bg: "#0d2b1a",
  },
];

// ─── Category Slider ──────────────────────────────────────────
export const categorySliderItems = [
  { name: "Mobiles", image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=120&h=120&fit=crop" },
  { name: "Laptops", image: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=120&h=120&fit=crop" },
  { name: "TVs", image: "https://images.unsplash.com/photo-1593784991095-a205069470b6?w=120&h=120&fit=crop" },
  { name: "Headphones", image: "https://images.unsplash.com/photo-1545127398-14699f92334b?w=120&h=120&fit=crop" },
  { name: "Watches", image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=120&h=120&fit=crop" },
  { name: "Shoes", image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=120&h=120&fit=crop" },
  { name: "Bags", image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=120&h=120&fit=crop" },
  { name: "Perfumes", image: "https://images.unsplash.com/photo-1541643600914-78b084683702?w=120&h=120&fit=crop" },
  { name: "Cameras", image: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=120&h=120&fit=crop" },
  { name: "Gaming", image: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=120&h=120&fit=crop" },
];

// ─── Promotional Banners ──────────────────────────────────────
export const promoBannersData = [
  { id: "promo-savings", title: "Big Savings Days", subtitle: "Up to 70% Off", bg: "#fff7ed", accent: "#f97316", emoji: "🛍️", btn: "Shop Now" },
  { id: "promo-prepaid", title: "Extra 10% Off", subtitle: "On Prepaid Orders", code: "PREPAID10", bg: "#f0fdf4", accent: "#16a34a", emoji: "💳", btn: "Avail Offer" },
  { id: "promo-emi", title: "No Cost EMI", subtitle: "Up to 12 Months", bg: "#eff6ff", accent: "#2563eb", emoji: "📅", btn: "Know More" },
];

// ─── Banner Layout ────────────────────────────────────────────
export const bannerLayoutData = {
  large: { title: "Make Your Home Beautiful", subtitle: "Up to 40% Off on Home Essentials", btn: "Shop Home", image: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=750&h=520&fit=crop&q=85" },
  small1: { title: "Style That Speaks", subtitle: "Up to 60% Off on Fashion", btn: "Shop Fashion", image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=500&h=252&fit=crop&q=85" },
  small2: { title: "Beauty for You", subtitle: "Up to 50% Off on Beauty", btn: "Shop Beauty", image: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=500&h=252&fit=crop&q=85" },
};

// ─── Trending Products (15) ───────────────────────────────────
export const trendingProducts = [
  { id: 1, name: "boAt Airdopes 141 True Wireless Earbuds", desc: "42Hr Playback, IPX4, Instant Voice Assistant", price: 1499, originalPrice: 4999, discount: 55, rating: 4.1, reviews: 23400, image: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=300&h=300&fit=crop", badge: "55% OFF" },
  { id: 2, name: "Noise ColorFit Pulse 3 Smart Watch", desc: "1.96\" AMOLED, SpO2 & Heart Rate Monitor", price: 1599, originalPrice: 4999, discount: 50, rating: 4.0, reviews: 46500, image: "https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=300&h=300&fit=crop", badge: "50% OFF" },
  { id: 3, name: "realme Narzo-70 Pro 5G (8GB+128GB)", desc: "6.67\" AMOLED, 5000mAh, 67W Fast Charge", price: 16999, originalPrice: 22999, discount: 26, rating: 4.3, reviews: 13496, image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=300&h=300&fit=crop", badge: "26% OFF" },
  { id: 4, name: "Puma Men Running Shoes", desc: "Lightweight, Breathable Mesh, Non-slip Sole", price: 2099, originalPrice: 2999, discount: 30, rating: 4.4, reviews: 58170, image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&h=300&fit=crop", badge: "30% OFF" },
  { id: 5, name: "Skybags Casual Backpack (Black)", desc: "32L Capacity, Laptop Sleeve, USB Charging Port", price: 899, originalPrice: 1999, discount: 55, rating: 4.1, reviews: 8500, image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=300&h=300&fit=crop", badge: "55% OFF" },
  { id: 6, name: "OnePlus Bullets Z2 Bluetooth Earphones", desc: "10mm Drivers, 30Hr Playback, IP55 Rated", price: 1299, originalPrice: 2999, discount: 57, rating: 4.2, reviews: 32100, image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&h=300&fit=crop", badge: "57% OFF" },
  { id: 7, name: "boAt Rockerz 450 Bluetooth Headphone", desc: "40mm Drivers, 15Hr Battery, Foldable Design", price: 999, originalPrice: 2490, discount: 60, rating: 4.0, reviews: 15600, image: "https://images.unsplash.com/photo-1583394838336-acd977736f90?w=300&h=300&fit=crop", badge: "60% OFF" },
  { id: 8, name: "Samsung Galaxy A35 5G (8GB+256GB)", desc: "6.6\" Super AMOLED, 50MP Triple Camera", price: 22999, originalPrice: 28999, discount: 21, rating: 4.3, reviews: 9240, image: "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=300&h=300&fit=crop", badge: "21% OFF" },
  { id: 9, name: "Adidas Men's Running T-Shirt", desc: "AEROREADY Moisture-absorbing, Slim Fit", price: 699, originalPrice: 1499, discount: 53, rating: 4.1, reviews: 4200, image: "https://images.unsplash.com/photo-1562157873-818bc0726f68?w=300&h=300&fit=crop", badge: "53% OFF" },
  { id: 10, name: "Prestige Electric Kettle (1.5L)", desc: "1500W, Auto Shutoff, Food-grade Stainless Steel", price: 799, originalPrice: 1295, discount: 38, rating: 4.4, reviews: 7800, image: "https://images.unsplash.com/photo-1544785349-c4a5301826fd?w=300&h=300&fit=crop", badge: "38% OFF" },
  { id: 11, name: "Fossil Gen 6 Hybrid Smartwatch", desc: "Always-on Display, Heart Rate, SpO2, Sleep Track", price: 8995, originalPrice: 15995, discount: 44, rating: 4.3, reviews: 2340, image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&h=300&fit=crop", badge: "44% OFF" },
  { id: 12, name: "Sony Bravia 43\" 4K Smart TV", desc: "X-Reality Pro, Dolby Audio, Android TV 10", price: 34990, originalPrice: 54990, discount: 36, rating: 4.5, reviews: 12800, image: "https://images.unsplash.com/photo-1593784991095-a205069470b6?w=300&h=300&fit=crop", badge: "36% OFF" },
  { id: 13, name: "Nike React Infinity Run Flyknit 3", desc: "ReactX Foam, Flywire, Wider Stable Base", price: 5999, originalPrice: 9999, discount: 40, rating: 4.5, reviews: 18900, image: "https://images.unsplash.com/photo-1579338559194-a162d19bf842?w=300&h=300&fit=crop", badge: "40% OFF" },
  { id: 14, name: "Anker 20000mAh Power Bank", desc: "22.5W Fast Charge, Tri-port, LED Display", price: 1999, originalPrice: 3299, discount: 39, rating: 4.4, reviews: 11200, image: "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=300&h=300&fit=crop", badge: "39% OFF" },
  { id: 15, name: "Logitech MX Master 3 Mouse", desc: "4000 DPI, MagSpeed Scrolling, Multi-device", price: 6495, originalPrice: 9499, discount: 32, rating: 4.6, reviews: 5670, image: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=300&h=300&fit=crop", badge: "32% OFF" },
];

// ─── Featured Products ─────────────────────────────────────────
export const featuredProducts = [
  { id: 20, name: "ASUS Vivobook 15 (Core i5, 12th Gen)", desc: "8GB RAM, 512GB SSD, 15.6\" FHD Display", price: 49990, originalPrice: 62490, discount: 20, rating: 4.2, reviews: 834, image: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=300&h=300&fit=crop", badge: "20% OFF", tag: "Best Seller" },
  { id: 21, name: "OnePlus Nord CE 4 Lite 5G (8+128GB)", desc: "6.67\" FHD+, 5500mAh, 80W SUPERVOOC", price: 18999, originalPrice: 22499, discount: 15, rating: 4.4, reviews: 12248, image: "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=300&h=300&fit=crop", badge: "15% OFF" },
  { id: 22, name: "Sony WH-CH520 Wireless Headphones", desc: "30Hr Battery, Multipoint Connect, Foldable", price: 3580, originalPrice: 3890, discount: 8, rating: 4.0, reviews: 41560, image: "https://images.unsplash.com/photo-1545127398-14699f92334b?w=300&h=300&fit=crop", badge: "8% OFF" },
  { id: 23, name: "Philips HD9252/90 Air Fryer (4.1L)", desc: "1400W, Rapid Air Technology, Digital Display", price: 6999, originalPrice: 9390, discount: 25, rating: 4.5, reviews: 23560, image: "https://images.unsplash.com/photo-1585515320310-259814833e62?w=300&h=300&fit=crop", badge: "25% OFF" },
  { id: 24, name: "Samsung Galaxy Buds2 Pro", desc: "360 Audio, ANC, IPX7, 29Hr Total Battery", price: 8999, originalPrice: 17999, discount: 50, rating: 4.3, reviews: 18900, image: "https://images.unsplash.com/photo-1606400082777-ef05f3c5cde2?w=300&h=300&fit=crop", badge: "50% OFF" },
  { id: 25, name: "Nike Air Max 270 Running Shoes", desc: "Max Air 270 Unit, Foam Midsole, Mesh Upper", price: 4995, originalPrice: 8995, discount: 44, rating: 4.4, reviews: 78300, image: "https://images.unsplash.com/photo-1579338559194-a162d19bf842?w=300&h=300&fit=crop", badge: "44% OFF" },
  { id: 26, name: "Xiaomi 43\" Smart TV 4K Ultra HD", desc: "Dolby Vision, HDR10+, MEMC, Android TV 11", price: 24999, originalPrice: 32999, discount: 24, rating: 4.3, reviews: 34500, image: "https://images.unsplash.com/photo-1593784991095-a205069470b6?w=300&h=300&fit=crop", badge: "24% OFF" },
];

// ─── Product Detail Page Data ─────────────────────────────────
export const productDetailData = {
  id: 101,
  name: "Sony WH-1000XM5 Wireless Noise Cancelling Headphones",
  brand: "Sony",
  sku: "SNY-WH1000XM5-BLK",
  rating: 4.7,
  reviews: 48392,
  badge: "37% OFF",
  tag: "Best Seller",
  price: 24990,
  originalPrice: 39990,
  discount: 37,
  inStock: true,
  stockLeft: 12,

  // Multiple media: images + one video
  media: [
    { type: "image", url: "https://images.unsplash.com/photo-1583394838336-acd977736f90?w=900&h=900&fit=crop&q=90", thumb: "https://images.unsplash.com/photo-1583394838336-acd977736f90?w=120&h=120&fit=crop&q=80" },
    { type: "image", url: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&h=900&fit=crop&q=90", thumb: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=120&h=120&fit=crop&q=80" },
    { type: "image", url: "https://images.unsplash.com/photo-1545127398-14699f92334b?w=900&h=900&fit=crop&q=90", thumb: "https://images.unsplash.com/photo-1545127398-14699f92334b?w=120&h=120&fit=crop&q=80" },
    { type: "image", url: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=900&h=900&fit=crop&q=90", thumb: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=120&h=120&fit=crop&q=80" },
    { type: "image", url: "https://images.unsplash.com/photo-1484704849700-f032a568e944?w=900&h=900&fit=crop&q=90", thumb: "https://images.unsplash.com/photo-1484704849700-f032a568e944?w=120&h=120&fit=crop&q=80" },
    { type: "video", url: "https://www.w3schools.com/html/mov_bbb.mp4", thumb: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=120&h=120&fit=crop&q=80", poster: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=900&h=900&fit=crop&q=90" },
  ],

  colors: [
    { name: "Midnight Black", hex: "#1a1a1a", available: true },
    { name: "Platinum Silver", hex: "#c0c0c0", available: true },
    { name: "Smoky Blue", hex: "#4a6fa5", available: true },
    { name: "Forest Green", hex: "#2d6a4f", available: false },
  ],

  sizes: ["One Size"],

  highlights: [
    "Industry-leading 30dB Noise Cancellation with dual IC processors",
    "Up to 30 Hours Battery Life with Quick Charge (3 min → 3 hrs)",
    "8 Built-in mics for crystal-clear calls & voice assistants",
    "Multipoint Connection — pair to 2 devices simultaneously",
    "Adaptive Sound Control adjusts ANC to your activity",
    "Foldable, lightweight design (250g) with memory foam earpads",
  ],

  offerDetails: {
    bankOffers: [
      { bank: "HDFC Bank", offer: "10% Instant Discount up to ₹1,500 on Credit Cards", code: "HDFC10" },
      { bank: "SBI Credit", offer: "5% Unlimited Cashback on SBI Credit Cards", code: "" },
      { bank: "Axis Bank", offer: "Extra 5% Off on Axis Bank Credit Cards", code: "AXIS5" },
    ],
    couponOffers: [
      { code: "SONIC500", desc: "Extra ₹500 Off on orders above ₹20,000" },
      { code: "FIRSTBUY", desc: "Flat ₹250 Off for first-time buyers" },
    ],
    emiOptions: [
      { months: 3, emi: 8330, interest: "No Cost" },
      { months: 6, emi: 4165, interest: "No Cost" },
      { months: 9, emi: 2777, interest: "5.5% p.a." },
      { months: 12, emi: 2082, interest: "6% p.a." },
    ],
  },

  deliveryInfo: {
    freeShipping: true,
    estimatedDays: "2-3 Business Days",
    expressAvailable: true,
    returnDays: 10,
    warranty: "2 Years Sony Warranty",
  },

  seller: {
    name: "Sony Official Store",
    rating: 4.8,
    soldBy: "Cloudtail India Pvt Ltd",
    verified: true,
  },

  // Info Tabs content
  specifications: [
    { group: "Connectivity", specs: [{ label: "Bluetooth Version", value: "5.2" }, { label: "Wireless Range", value: "Up to 30m" }, { label: "NFC", value: "Yes" }, { label: "Multi-device Pairing", value: "2 Devices" }] },
    { group: "Audio", specs: [{ label: "Driver Size", value: "30mm Dynamic" }, { label: "Frequency Response", value: "4Hz – 40,000Hz" }, { label: "Impedance", value: "16Ω (wireless), 48Ω (wired)" }, { label: "Sound Pressure Level", value: "101 dB/mW" }] },
    { group: "Battery", specs: [{ label: "Battery Life (ANC On)", value: "30 Hours" }, { label: "Battery Life (ANC Off)", value: "40 Hours" }, { label: "Quick Charge", value: "3 min charge = 3 hrs playback" }, { label: "Charging Port", value: "USB-C" }] },
    { group: "Noise Cancellation", specs: [{ label: "ANC Type", value: "Hybrid Active NC" }, { label: "ANC Level", value: "30dB reduction" }, { label: "Transparency Mode", value: "Yes (Ambient Sound)" }, { label: "Mic Count", value: "8 Microphones" }] },
  ],

  dimensions: {
    weight: "250g",
    headbandWidth: "Adjustable (up to 21cm)",
    earcupDepth: "3.5cm",
    foldedSize: "20.5cm × 16cm × 7cm",
    cableLength: "1.2m (3.5mm analog)",
  },

  materials: [
    { part: "Earpads", material: "Soft urethane leather with memory foam" },
    { part: "Headband", material: "Synthetic leather over stainless-steel slider" },
    { part: "Housing", material: "High-impact ABS plastic" },
    { part: "Mesh", material: "Acoustic fiber mesh" },
  ],

  careInstructions: [
    "Clean earpads with a slightly damp, lint-free cloth",
    "Do not expose to extreme temperatures or high humidity",
    "Store in the included soft-shell case when not in use",
    "Avoid contact with chemicals, solvents, or abrasive materials",
    "Charge only with the included USB-C cable or certified alternatives",
  ],

  manufacturer: {
    name: "Sony Corporation",
    country: "Japan",
    address: "1-7-1 Konan, Minato-ku, Tokyo 108-0075, Japan",
    supportEmail: "support.sony.com",
    supportPhone: "1800-103-7799",
    manufacturingDate: "2024",
    importedBy: "Sony India Pvt Ltd, A-31, Mohan Co-operative, New Delhi",
  },

  userGuide: {
    pdfUrl: "#",
    steps: [
      { step: 1, title: "Pairing for the First Time", desc: "Hold the power button for 7 seconds until the LED flashes blue. Open Bluetooth on your device and select 'WH-1000XM5'." },
      { step: 2, title: "Switching ANC Modes", desc: "Press the NC/Ambient button on the left earcup to cycle between Noise Cancellation, Ambient Sound, and Off modes." },
      { step: 3, title: "Touch Controls", desc: "Use the touch panel on the right earcup: swipe to adjust volume, tap to play/pause, swipe up/down for next/previous track." },
      { step: 4, title: "Quick Charge", desc: "Connect via USB-C for just 3 minutes to get 3 hours of playback. Full charge takes approximately 3.5 hours." },
      { step: 5, title: "Speak-to-Chat", desc: "Simply start talking — the headphones automatically pause music and reduce ANC to let you hear the conversation." },
    ],
  },

  additionalDetails: {
    inBox: ["Sony WH-1000XM5 Headphones", "USB-C Charging Cable (1m)", "3.5mm Audio Cable (1.2m)", "Airplane Adapter", "Carrying Case", "Quick Start Guide"],
    certifications: ["CE Certified", "BIS Certified", "FCC ID Approved", "Bluetooth SIG Qualified"],
    modelNumber: "WH1000XM5/B",
    countryOfOrigin: "Malaysia",
    hsn: "85183000",
    gst: "18%",
  },

  reviewSummary: {
    overall: 4.7,
    totalReviews: 48392,
    breakdown: [
      { stars: 5, count: 32400, percent: 67 },
      { stars: 4, count: 10500, percent: 22 },
      { stars: 3, count: 3600, percent: 7 },
      { stars: 2, count: 1000, percent: 2 },
      { stars: 1, count: 892, percent: 2 },
    ],
    attributes: [
      { label: "Sound Quality", score: 4.8 },
      { label: "Comfort", score: 4.6 },
      { label: "Battery Life", score: 4.7 },
      { label: "Noise Cancellation", score: 4.9 },
      { label: "Value for Money", score: 4.3 },
    ],
  },

  topReviews: [
    {
      id: 1, author: "Rahul M.", verified: true, rating: 5, date: "Aug 2, 2026",
      title: "Best headphones I've ever owned!",
      body: "The noise cancellation is absolutely mind-blowing. I use these on my daily commute and it's like being in a silent bubble. Battery life is outstanding — I charge them once a week. The sound quality is warm, detailed and perfect for all genres.",
      helpful: 342, images: ["https://images.unsplash.com/photo-1583394838336-acd977736f90?w=120&h=120&fit=crop"],
    },
    {
      id: 2, author: "Priya S.", verified: true, rating: 5, date: "Jul 28, 2026",
      title: "Premium build, premium sound",
      body: "Coming from Bose QC45, this is a significant upgrade in every way. The multipoint connection is so useful — switching between laptop and phone is seamless. Comfort for long sessions is excellent thanks to the memory foam earcups.",
      helpful: 218, images: [],
    },
    {
      id: 3, author: "Arjun K.", verified: false, rating: 4, date: "Jul 15, 2026",
      title: "Great but the app needs work",
      body: "Sound and ANC are exceptional. The Sony Headphones Connect app is useful but occasionally glitchy on Android 14. Touch controls take a few days to get used to. Overall a fantastic pair of cans at this price, especially with the discount.",
      helpful: 97, images: [],
    },
  ],
};

// ─── Frequently Visited Products ─────────────────────────────
export const frequentlyVisitedProducts = [
  { id: 201, name: "Bose QuietComfort 45 Headphones", price: 21990, originalPrice: 32990, discount: 33, rating: 4.6, reviews: 28400, image: "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=300&h=300&fit=crop", badge: "33% OFF" },
  { id: 202, name: "Apple AirPods Pro (2nd Gen)", price: 19900, originalPrice: 26900, discount: 26, rating: 4.8, reviews: 91200, image: "https://images.unsplash.com/photo-1606400082777-ef05f3c5cde2?w=300&h=300&fit=crop", badge: "26% OFF" },
  { id: 203, name: "JBL Tune 770NC Wireless", price: 6499, originalPrice: 9999, discount: 35, rating: 4.3, reviews: 14500, image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&h=300&fit=crop", badge: "35% OFF" },
  { id: 204, name: "Sennheiser HD 450BT", price: 8990, originalPrice: 13990, discount: 36, rating: 4.4, reviews: 8300, image: "https://images.unsplash.com/photo-1484704849700-f032a568e944?w=300&h=300&fit=crop", badge: "36% OFF" },
  { id: 205, name: "Jabra Evolve2 55 UC", price: 34990, originalPrice: 49990, discount: 30, rating: 4.5, reviews: 5200, image: "https://images.unsplash.com/photo-1545127398-14699f92334b?w=300&h=300&fit=crop", badge: "30% OFF" },
  { id: 206, name: "Anker Soundcore Life Q45", price: 4999, originalPrice: 7999, discount: 37, rating: 4.2, reviews: 18700, image: "https://images.unsplash.com/photo-1583394838336-acd977736f90?w=300&h=300&fit=crop", badge: "37% OFF" },
];

// ─── Promo Banner Carousel ─────────────────────────────────────
export const promoCarouselSlides = [
  {
    tag: "🔥 Limited Time Offer",
    title: "End of Season Sale",
    highlight: "Up to 70% Off",
    desc: "Grab the best deals across all categories before they're gone!",
    btn: "Shop Now",
    images: [
      "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=220&h=220&fit=crop",
      "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=220&h=220&fit=crop",
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=220&h=220&fit=crop",
    ],
  },
  {
    tag: "⚡ Flash Sale",
    title: "Electronics Mega Sale",
    highlight: "Up to 65% Off",
    desc: "Best prices on top electronics brands — today only!",
    btn: "Shop Electronics",
    images: [
      "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=220&h=220&fit=crop",
      "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=220&h=220&fit=crop",
      "https://images.unsplash.com/photo-1593784991095-a205069470b6?w=220&h=220&fit=crop",
    ],
  },
  {
    tag: "👗 Fashion Week",
    title: "Style Redefined",
    highlight: "Up to 80% Off on Fashion",
    desc: "New season styles from top brands at unbeatable prices.",
    btn: "Shop Fashion",
    images: [
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=220&h=220&fit=crop",
      "https://images.unsplash.com/photo-1562157873-818bc0726f68?w=220&h=220&fit=crop",
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=220&h=220&fit=crop",
    ],
  },
];
