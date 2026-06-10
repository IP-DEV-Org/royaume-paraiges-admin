"use client";

import { Button } from "@/components/ui/button";

interface TablePaginationProps {
  /** Page courante, indexée à partir de 0. */
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}

export function TablePagination({
  page,
  pageCount,
  onPageChange,
}: TablePaginationProps) {
  if (pageCount <= 1) return null;

  return (
    <div className="mt-4 flex items-center justify-between">
      <p className="text-sm text-muted-foreground">
        Page {page + 1} sur {pageCount}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page === 0}
          onClick={() => onPageChange(page - 1)}
        >
          Précédent
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pageCount - 1}
          onClick={() => onPageChange(page + 1)}
        >
          Suivant
        </Button>
      </div>
    </div>
  );
}
