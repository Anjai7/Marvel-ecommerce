import { useEffect, useMemo, useState } from "react";
import { Home, Search, Package } from "lucide-react";
import CategoryListing from "./CategoryListing";
import SeoHead from "../pages/SeoHead";
import { navigateToPath } from "../../lib/routes";
import "./all-products.css";

/**
 * The shop's "All products" page.
 *
 * It is the page every "View all" link, every hero call-to-action and every
 * recent search points at. Before it existed, `/products` fell through to the
 * single-product page and showed "No product was requested", and the "View
 * all" links opened the first product instead of the list.
 *
 * The listing is the same one the category pages use — the same filters, the
 * same sort, the same pagination — only without a category in front of it.
 */
export default function AllProductsPage({ onSelectProduct }) {
  // The search term lives in the URL, so the page can be linked to and
  // reloaded without losing it.
  const [search, setSearch] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("search") ?? "";
  });
  const [draft, setDraft] = useState(search);

  // A search typed somewhere else (the header's search, a recent search)
  // moves the page with it.
  useEffect(() => {
    const term = new URLSearchParams(window.location.search).get("search") ?? "";
    setSearch(term);
    setDraft(term);
  }, []);

  const submitSearch = (event) => {
    event.preventDefault();
    const term = draft.trim();
    const query = term === "" ? "" : `?search=${encodeURIComponent(term)}`;
    navigateToPath(`/products${query}`);
    setSearch(term);
  };

  const heading = search.trim() === "" ? "All products" : `Results for “${search.trim()}”`;

  const seo = useMemo(
    () => ({
      title: search.trim() === "" ? "All products" : `${search.trim()} — products`,
      description: "Every product in the store — electronics, fashion, home, beauty and more.",
    }),
    [search]
  );

  return (
    <div id="all-products-page">
      <SeoHead page={seo} />

      <div className="pvp-breadcrumb-wrap">
        <div className="container">
          <nav className="pvp-breadcrumb" aria-label="Breadcrumb">
            <button type="button" className="pvp-bc-link" onClick={() => navigateToPath("/")}>
              <Home size={13} /> Home
            </button>
            <span className="category-page-bc-node">
              <span className="pvp-bc-sep" aria-hidden="true">
                /
              </span>
              <span className="pvp-bc-link">All products</span>
            </span>
          </nav>
        </div>
      </div>

      <div className="container all-products-intro">
        <span className="all-products-intro-icon" aria-hidden="true">
          <Package size={20} />
        </span>
        <div className="all-products-intro-text">
          <h1 className="all-products-title">{heading}</h1>
          <p className="all-products-subtitle">
            Everything the store sells — sort it, narrow it by price or stock, and page through it.
          </p>
        </div>

        <form className="all-products-search" onSubmit={submitSearch} role="search">
          <label className="all-products-search-label" htmlFor="all-products-search-input">
            Search the catalogue
          </label>
          <div className="all-products-search-field">
            <Search size={16} aria-hidden="true" />
            <input
              id="all-products-search-input"
              type="search"
              value={draft}
              placeholder="Search products…"
              onChange={(event) => setDraft(event.target.value)}
            />
            <button type="submit" className="all-products-search-btn">
              Search
            </button>
          </div>
        </form>
      </div>

      <div className="container all-products-listing-wrap">
        <CategoryListing
          scope="all"
          search={search}
          config={{ pageSize: 24, showSort: true, showFilters: true }}
          onSelectProduct={onSelectProduct}
        />
      </div>
    </div>
  );
}
