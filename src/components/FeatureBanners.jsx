const cards = [
  {
    id: "feature-home",
    title: "Make Your Home Beautiful",
    subtitle: "Up to 40% Off",
    btn: "Shop Home",
    image: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&h=500&fit=crop",
    large: true,
  },
  {
    id: "feature-fashion",
    title: "Style That Speaks",
    subtitle: "Up to 60% Off on Fashion",
    btn: "Shop Fashion",
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=240&fit=crop",
    large: false,
  },
  {
    id: "feature-beauty",
    title: "Beauty for You",
    subtitle: "Up to 50% Off",
    btn: "Shop Beauty",
    image: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=600&h=240&fit=crop",
    large: false,
  },
];

export default function FeatureBanners() {
  return (
    <div className="container">
      <div className="feature-grid">
        {/* Large Left Card */}
        <div
          className={`feature-card feature-card-large`}
          id={cards[0].id}
        >
          <img src={cards[0].image} alt={cards[0].title} />
          <div className="feature-card-overlay" />
          <div className="feature-card-content">
            <h3>{cards[0].title}</h3>
            <p>{cards[0].subtitle}</p>
            <button className="feature-btn" id={`${cards[0].id}-btn`}>{cards[0].btn}</button>
          </div>
        </div>

        {/* Right Column - Two Cards */}
        <div className="feature-right">
          {cards.slice(1).map((card) => (
            <div className="feature-card" key={card.id} id={card.id}>
              <img src={card.image} alt={card.title} />
              <div className="feature-card-overlay" />
              <div className="feature-card-content">
                <h3>{card.title}</h3>
                <p>{card.subtitle}</p>
                <button className="feature-btn" id={`${card.id}-btn`}>{card.btn}</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
