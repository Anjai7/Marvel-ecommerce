import { Fragment } from "react";
import { Button } from "../ui";

/**
 * The page numbers a compact pager shows: the current page and up to two of its
 * neighbours, plus the last page. Every skipped page becomes one ellipsis, so a
 * 50-page catalogue costs five buttons instead of fifty.
 */
function compactPageNumbers(currentPage, totalPages) {
  // A list this short is already shorter than the compact strip — an ellipsis
  // standing in for a single page would just puzzle the admin.
  if (totalPages <= 5) {
    return Array.from({ length: Math.max(0, totalPages) }, (_, index) => index + 1);
  }

  const windowSize = 3;
  let start = Math.max(1, currentPage - 1);
  const end = Math.min(totalPages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);

  const numbers = [];
  for (let page = start; page <= end; page += 1) numbers.push(page);
  // The last page is always one click away, whichever page the admin is on.
  if (numbers[numbers.length - 1] !== totalPages) numbers.push(totalPages);
  return numbers;
}

/** The pager shared by every list in the console (products, orders, customers). */
export default function ConsolePagination({ currentPage, totalPages, onPageChange }) {
  const numbers = compactPageNumbers(currentPage, totalPages);

  return (
    <div className="console-pagination-controls">
      <Button
        variant="outline"
        size="sm"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        Previous
      </Button>
      <div className="console-pagination-numbers">
        {numbers.map((pageNum, index) => {
          const previous = numbers[index - 1];
          const skipped = previous !== undefined && pageNum - previous > 1;
          return (
            <Fragment key={pageNum}>
              {skipped && (
                <span className="console-pagination-ellipsis" aria-hidden="true">
                  …
                </span>
              )}
              <button
                type="button"
                className={`menu-page-number-btn ${pageNum === currentPage ? "active" : ""}`}
                onClick={() => onPageChange(pageNum)}
                aria-label={`Page ${pageNum}`}
                aria-current={pageNum === currentPage ? "page" : undefined}
              >
                {pageNum}
              </button>
            </Fragment>
          );
        })}
      </div>
      <Button
        variant="outline"
        size="sm"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
      >
        Next
      </Button>
    </div>
  );
}
