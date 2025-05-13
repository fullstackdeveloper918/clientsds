import { Link, useSearchParams } from "@remix-run/react";

function setSearchParamsString(searchParams, changes) {
  const newSearchParams = new URLSearchParams(searchParams);

  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined) {
      newSearchParams.delete(key);
      continue;
    }
    newSearchParams.set(key, String(value));
  }

  return `?${newSearchParams.toString()}`;
}

export default function PaginationBar({ total }) {
  const [searchParams] = useSearchParams();
  const currentPage = Number(searchParams.get("page_index")) || 0; // Default to page 0
  const pageSize = Number(searchParams.get("page_size")) || 10;

  const totalPages = Math.ceil(total / pageSize);
  const lastPageIndex = totalPages - 1; // Zero-based index

  const maxPages = 5;
  const halfMaxPages = Math.floor(maxPages / 2);

  const canPageBackwards = currentPage > 0;
  const canPageForwards = currentPage < lastPageIndex;

  const pageNumbers = [];
  if (totalPages <= maxPages) {
    for (let i = 0; i < totalPages; i++) {
      pageNumbers.push(i);
    }
  } else {
    let startPage = currentPage - halfMaxPages;
    let endPage = currentPage + halfMaxPages;

    if (startPage < 0) {
      endPage += Math.abs(startPage);
      startPage = 0;
    }

    if (endPage >= totalPages) {
      startPage -= endPage - lastPageIndex;
      endPage = lastPageIndex;
    }

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }
  }






  

  return (
    <div className="flex items-center gap-2" style={{float:"left", width:"100%"}}>
      {/* First Page Button */}
      <button disabled={!canPageBackwards}>
        <Link
          to={setSearchParamsString(searchParams, { page_index: 0 })}
          preventScrollReset
          prefetch="intent"
          className="text-neutral-600"
        >
          First
        </Link>
      </button>

      {/* Previous Page Button */}
      <button disabled={!canPageBackwards}>
        <Link
          to={setSearchParamsString(searchParams, {
            page_index: Math.max(currentPage - 1, 0),
          })}
          preventScrollReset
          prefetch="intent"
          className="text-neutral-600"
        >
          Prev
        </Link>
      </button>

      {/* Page Number Buttons */}
      {pageNumbers.map((pageNumber) => (
        <button key={pageNumber} disabled={pageNumber === currentPage}>
          <Link
            to={setSearchParamsString(searchParams, { page_index: pageNumber })}
            preventScrollReset
            prefetch="intent"
            className={`px-3 py-1 rounded-md ${
              pageNumber === currentPage
                ? "bg-neutral-800 text-white"
                : "text-neutral-600"
            }`}
          >
            {pageNumber}
          </Link>
        </button>
      ))}

      {/* Next Page Button */}
      <button disabled={!canPageForwards}>
        <Link
          to={setSearchParamsString(searchParams, { page_index: currentPage + 1 })}
          preventScrollReset
          prefetch="intent"
          className="text-neutral-600"
        >
          Next
        </Link>
      </button>

      {/* Last Page Button */}
      <button disabled={!canPageForwards}>
        <Link
          to={setSearchParamsString(searchParams, {
            page_index: lastPageIndex,
          })}
          preventScrollReset
          prefetch="intent"
          className="text-neutral-600"
        >
          Last
        </Link>
      </button>
    </div>
  );
}
