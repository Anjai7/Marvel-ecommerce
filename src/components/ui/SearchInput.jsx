import { Search, X } from "lucide-react";

/**
 * The search field every list in the console filters through.
 *
 * One field, one look: the same height, the same leading icon, the same
 * clear button, so a search never looks like it belongs to a different
 * screen. It is sized for a toolbar row — narrow enough to sit beside
 * the filters — and `fluid` stretches it to fill a panel instead.
 */
export default function SearchInput({
  value = "",
  onValueChange,
  placeholder = "Search...",
  ariaLabel,
  clearLabel = "Clear search",
  fluid = false,
  className = "",
  ...props
}) {
  return (
    <div
      className={`search-input-wrapper app-search-wrapper${
        fluid ? " app-search-wrapper--fluid" : ""
      } ${className}`.trim()}
    >
      <Search size={16} className="search-icon app-search-icon" aria-hidden="true" />
      <input
        type="search"
        className="users-search-field app-search-input"
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel || placeholder}
        onChange={(event) => onValueChange?.(event.target.value)}
        {...props}
      />
      {value ? (
        <button
          type="button"
          className="clear-search-btn app-search-clear"
          onClick={() => onValueChange?.("")}
          aria-label={clearLabel}
        >
          <X size={15} />
        </button>
      ) : null}
    </div>
  );
}
