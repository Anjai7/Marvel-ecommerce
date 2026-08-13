import { categories } from "../data";

export default function CategoryScroll() {
  return (
    <div className="cat-scroll-section">
      <div className="container">
        <div className="cat-scroll">
          {categories.map((cat) => (
            <div className="cat-item" key={cat.id} id={`cat-${cat.name.toLowerCase()}`}>
              <div className="cat-img-wrap">
                <img src={cat.image} alt={cat.name} />
              </div>
              <span className="cat-name">{cat.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
