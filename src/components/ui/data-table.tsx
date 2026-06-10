"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface DataTableColumn<T> {
  /** Identifiant unique de la colonne (clé React + état de tri). */
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  /** Active le tri client sur cette colonne — nécessite sortValue. */
  sortable?: boolean;
  sortValue?: (row: T) => string | number | null | undefined;
  headerClassName?: string;
  cellClassName?: string;
}

export interface DataTablePagination {
  /** Index de page 0-based. */
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  rowKey: (row: T) => string | number;
  loading?: boolean;
  skeletonRows?: number;
  /** Rendu quand data est vide (typiquement un <EmptyState />). */
  emptyState?: React.ReactNode;
  onRowClick?: (row: T) => void;
  rowClassName?: string | ((row: T) => string);
  pagination?: DataTablePagination;
  /** Classes du conteneur de la table (ex: zone scrollable). */
  containerClassName?: string;
  className?: string;
}

type SortState = { key: string; direction: "asc" | "desc" } | null;

function compareValues(
  a: string | number | null | undefined,
  b: string | number | null | undefined
): number {
  // Valeurs absentes toujours en fin de tri, quel que soit le sens.
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "fr", { sensitivity: "base" });
}

const SKELETON_WIDTHS = ["w-32", "w-24", "w-20", "w-28", "w-16"];

export function DataTable<T>({
  columns,
  data,
  rowKey,
  loading = false,
  skeletonRows = 5,
  emptyState,
  onRowClick,
  rowClassName,
  pagination,
  containerClassName,
  className,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState>(null);

  const sortedData = useMemo(() => {
    if (!sort) return data;
    const column = columns.find((c) => c.key === sort.key);
    if (!column?.sortValue) return data;
    const dir = sort.direction === "asc" ? 1 : -1;
    return [...data].sort((a, b) => {
      const result = compareValues(column.sortValue!(a), column.sortValue!(b));
      // compareValues place déjà les null en fin : ne pas inverser leur position.
      const aNull = column.sortValue!(a) == null;
      const bNull = column.sortValue!(b) == null;
      if (aNull || bNull) return result;
      return dir * result;
    });
  }, [data, sort, columns]);

  const toggleSort = (key: string) => {
    setSort((prev) => {
      if (prev?.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  };

  const isEmpty = !loading && sortedData.length === 0;
  const showPagination =
    !loading && !isEmpty && pagination && pagination.totalPages > 1;

  return (
    <div className={cn("flex flex-col", className)}>
      <div className={containerClassName}>
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => {
                const isSorted = sort?.key === col.key;
                return (
                  <TableHead
                    key={col.key}
                    className={col.headerClassName}
                    aria-sort={
                      col.sortable
                        ? isSorted
                          ? sort.direction === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                        : undefined
                    }
                  >
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className="-ml-1 flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:text-foreground"
                      >
                        {col.header}
                        {isSorted ? (
                          sort.direction === "asc" ? (
                            <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                          )
                        ) : (
                          <ChevronsUpDown
                            className="h-3.5 w-3.5 opacity-40"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: skeletonRows }).map((_, rowIndex) => (
                <TableRow key={`skeleton-${rowIndex}`}>
                  {columns.map((col, colIndex) => (
                    <TableCell key={col.key}>
                      <div
                        className={cn(
                          "h-4 animate-pulse rounded bg-muted",
                          SKELETON_WIDTHS[
                            (rowIndex + colIndex) % SKELETON_WIDTHS.length
                          ]
                        )}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : isEmpty ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length}>{emptyState}</TableCell>
              </TableRow>
            ) : (
              sortedData.map((row) => (
                <TableRow
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    onRowClick && "cursor-pointer",
                    typeof rowClassName === "function"
                      ? rowClassName(row)
                      : rowClassName
                  )}
                >
                  {columns.map((col) => (
                    <TableCell key={col.key} className={col.cellClassName}>
                      {col.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {showPagination && (
        <div className="mt-4 flex shrink-0 items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {pagination.page + 1} sur {pagination.totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page === 0}
              aria-label="Page précédente"
              onClick={() => pagination.onPageChange(pagination.page - 1)}
            >
              Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages - 1}
              aria-label="Page suivante"
              onClick={() => pagination.onPageChange(pagination.page + 1)}
            >
              Suivant
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
