import { Fragment } from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";

/**
 * The page strip: at most three numbers around the current page and the last
 * page, with one ellipsis for the gap. Skipped pages are never rendered as
 * buttons, so a 50-page catalogue stays a five-item control.
 */
export function compactPageNumbers(currentPage, totalPages) {
  if (totalPages <= 5) {
    return Array.from({ length: Math.max(0, totalPages) }, (_, index) => index + 1);
  }
  const windowSize = 3;
  let start = Math.max(1, currentPage - 1);
  const end = Math.min(totalPages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);

  const numbers = [];
  for (let page = start; page <= end; page += 1) numbers.push(page);
  if (numbers[numbers.length - 1] !== totalPages) numbers.push(totalPages);
  return numbers;
}

/**
 * The console pager, built after shadcn's Pagination: a labelled nav, a list
 * of items, chevron Previous/Next controls, an outlined active page and an
 * icon-only ellipsis that is hidden from assistive tech.
 */
export default function ConsolePagination({ currentPage, totalPages, onPageChange }) {
  const numbers = compactPageNumbers(currentPage, totalPages);

  return (
    <nav className="console-pager" aria-label="pagination">
      <ul className="console-pager-list">
        <li className="console-pager-item">
          <button
            type="button"
            className="console-pager-link console-pager-nav"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            aria-label="Go to previous page"
          >
            <ChevronLeft size={16} aria-hidden="true" />
            <span className="console-pager-nav-text">Previous</span>
          </button>
        </li>

        {numbers.map((pageNum, index) => {
          const previous = numbers[index - 1];
          const skipped = previous !== undefined && pageNum - previous > 1;
          return (
            <Fragment key={pageNum}>
              {skipped && (
                <li className="console-pager-item">
                  <span className="console-pager-ellipsis" aria-hidden="true">
                    <MoreHorizontal size={16} />
                  </span>
                  <span className="console-pager-sr-only">More pages</span>
                </li>
              )}
              <li className="console-pager-item">
                <button
                  type="button"
                  className={`console-pager-link ${
                    pageNum === currentPage ? "console-pager-link--active" : ""
                  }`}
                  onClick={() => onPageChange(pageNum)}
                  aria-label={`Page ${pageNum}`}
                  aria-current={pageNum === currentPage ? "page" : undefined}
                >
                  {pageNum}
                </button>
              </li>
            </Fragment>
          );
        })}

        <li className="console-pager-item">
          <button
            type="button"
            className="console-pager-link console-pager-nav"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            aria-label="Go to next page"
          >
            <span className="console-pager-nav-text">Next</span>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </li>
      </ul>
    </nav>
  );
}
