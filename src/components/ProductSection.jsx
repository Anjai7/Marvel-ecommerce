import ProductCard from "./ProductCard";

export default function ProductSection({ title, products, sectionId }) {
  return (
    <div className="container" id={sectionId}>
      <div className="section-header">
        <h2 className="section-title">{title}</h2>
        <span className="view-all" id={`${sectionId}-view-all`}>
          View All ›
        </span>
      </div>
      <div className="products-scroll">
        {products.map((product, i) => (
          <ProductCard key={product.id} product={product} index={i} />
        ))}
      </div>
    </div>
  );
}
