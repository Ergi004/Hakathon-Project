"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
} from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type Density = "comfortable" | "compact";

/**
 * TanStack table with sticky header, density and loading/empty states (SPEC 3).
 * Filters, column menu and the detail Sheet are added by the feature pages.
 */
export function DataTable<TData, TValue>({
  columns,
  data,
  loading = false,
  density = "comfortable",
  emptyMessage,
  onRowClick,
  caption,
}: {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  loading?: boolean;
  density?: Density;
  emptyMessage?: string;
  onRowClick?: (row: Row<TData>) => void;
  caption?: string;
}) {
  const t = useTranslations("table");
  // TanStack Table returns non-memoizable functions; the React Compiler lint rule knows this.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });
  const cellPad = density === "compact" ? "py-1.5" : "py-3";

  return (
    <div className="relative max-h-[70vh] overflow-auto rounded-xl border border-border" aria-busy={loading}>
      <Table>
        {caption && <caption className="sr-only">{caption}</caption>}
        <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur">
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id}>
              {group.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={`s-${i}`}>
                {columns.map((_c, j) => (
                  <TableCell key={j} className={cellPad}>
                    <Skeleton className="h-4 w-full max-w-32" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === "Enter") onRowClick(row);
                      }
                    : undefined
                }
                className={cn(onRowClick && "cursor-pointer")}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className={cellPad}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                {emptyMessage ?? t("noResults")}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
