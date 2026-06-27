import * as React from 'react';
import { ChevronsUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, type EmptyStateProps } from './empty-state';

export interface DataTableColumn<T> {
  /** Stable key; also the default sort accessor when `sortValue` is omitted. */
  id: string;
  header: React.ReactNode;
  /** Cell renderer. */
  cell: (row: T) => React.ReactNode;
  /** When provided, the column is sortable; returns the comparable value. */
  sortValue?: (row: T) => string | number;
  className?: string;
  headerClassName?: string;
  align?: 'left' | 'right' | 'center';
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  isLoading?: boolean;
  /** Shown when there are no rows and not loading. */
  empty?: EmptyStateProps;
  onRowClick?: (row: T) => void;
  /** Client-side page size. Omit to disable pagination. */
  pageSize?: number;
  className?: string;
}

type SortState = { columnId: string; dir: 'asc' | 'desc' } | null;

const alignClass = { left: 'text-left', right: 'text-right', center: 'text-center' } as const;

/**
 * Generic, accessible data table with client-side sorting and pagination,
 * loading skeletons, and an empty state. Built on the Table primitive, which
 * was presentation-only.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  isLoading = false,
  empty,
  onRowClick,
  pageSize,
  className,
}: DataTableProps<T>) {
  const [sort, setSort] = React.useState<SortState>(null);
  const [page, setPage] = React.useState(0);

  // Guard against a non-array `rows` (e.g. a `{ success, data }` envelope passed
  // by mistake): coerce to [] so a shape mismatch degrades to an empty table
  // instead of throwing `.slice is not a function` and blanking the page.
  const safeRows = Array.isArray(rows) ? rows : [];

  const sortedRows = React.useMemo(() => {
    if (!sort) return safeRows;
    const col = columns.find((c) => c.id === sort.columnId);
    if (!col?.sortValue) return safeRows;
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...safeRows].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (av < bv) return -1 * factor;
      if (av > bv) return 1 * factor;
      return 0;
    });
  }, [safeRows, sort, columns]);

  const pageCount = pageSize ? Math.max(1, Math.ceil(sortedRows.length / pageSize)) : 1;
  const safePage = Math.min(page, pageCount - 1);
  const pagedRows = pageSize
    ? sortedRows.slice(safePage * pageSize, safePage * pageSize + pageSize)
    : sortedRows;

  // Reset to first page whenever the underlying set shrinks past the cursor.
  React.useEffect(() => {
    if (page > pageCount - 1) setPage(0);
  }, [page, pageCount]);

  function toggleSort(columnId: string) {
    setSort((prev) => {
      if (prev?.columnId !== columnId) return { columnId, dir: 'asc' };
      if (prev.dir === 'asc') return { columnId, dir: 'desc' };
      return null;
    });
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {columns.map((col) => {
                  const sortable = Boolean(col.sortValue);
                  const active = sort?.columnId === col.id;
                  return (
                    <TableHead
                      key={col.id}
                      scope="col"
                      className={cn(col.align && alignClass[col.align], col.headerClassName)}
                      aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    >
                      {sortable ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(col.id)}
                          className="inline-flex items-center gap-1 font-medium text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {col.header}
                          {active ? (
                            sort!.dir === 'asc' ? (
                              <ChevronUp className="size-3.5" />
                            ) : (
                              <ChevronDown className="size-3.5" />
                            )
                          ) : (
                            <ChevronsUpDown className="size-3.5 opacity-50" />
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
              {isLoading ? (
                Array.from({ length: pageSize ?? 5 }).map((_, i) => (
                  <TableRow key={`skeleton-${i}`} className="hover:bg-transparent">
                    {columns.map((col) => (
                      <TableCell key={col.id} className={col.className}>
                        <Skeleton className="h-4 w-[60%]" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : pagedRows.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={columns.length} className="p-0">
                    <EmptyState
                      compact
                      title={empty?.title ?? 'Nothing here yet'}
                      description={empty?.description}
                      icon={empty?.icon}
                      action={empty?.action}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                pagedRows.map((row) => (
                  <TableRow
                    key={rowKey(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(onRowClick && 'cursor-pointer')}
                  >
                    {columns.map((col) => (
                      <TableCell
                        key={col.id}
                        className={cn(col.align && alignClass[col.align], col.className)}
                      >
                        {col.cell(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {pageSize && !isLoading && sortedRows.length > pageSize ? (
        <div className="flex items-center justify-between gap-4 px-1">
          <p className="text-sm text-muted-foreground tabular-nums">
            {safePage * pageSize + 1}–{Math.min((safePage + 1) * pageSize, sortedRows.length)} of{' '}
            {sortedRows.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={safePage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground tabular-nums">
              {safePage + 1} / {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
