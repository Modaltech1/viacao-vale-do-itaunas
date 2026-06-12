'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@prodexy/ui'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export const TABLE_PAGE_SIZE = 10

export function useTablePagination<T>(
  items: readonly T[],
  resetKey = '',
  pageSize = TABLE_PAGE_SIZE,
) {
  const [page, setPage] = useState(1)
  const totalItems = items.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const currentPage = Math.min(page, totalPages)

  useEffect(() => {
    setPage(1)
  }, [resetKey])

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages))
  }, [totalPages])

  const firstIndex = (currentPage - 1) * pageSize
  const pageItems = useMemo(
    () => items.slice(firstIndex, firstIndex + pageSize),
    [firstIndex, items, pageSize],
  )

  return {
    page: currentPage,
    pageItems,
    pageSize,
    setPage,
    totalItems,
    totalPages,
    startItem: totalItems ? firstIndex + 1 : 0,
    endItem: Math.min(firstIndex + pageSize, totalItems),
  }
}

type TablePaginationProps = Omit<
  ReturnType<typeof useTablePagination<unknown>>,
  'pageItems'
>

export function TablePagination({
  page,
  pageSize,
  setPage,
  totalItems,
  totalPages,
  startItem,
  endItem,
}: TablePaginationProps) {
  if (totalItems <= pageSize) return null

  return (
    <div className="flex min-h-10 flex-col gap-3 border-t pt-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <p>
        {startItem}-{endItem} de {totalItems}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="size-9 p-0"
          aria-label="Página anterior"
          title="Página anterior"
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="min-w-24 text-center text-foreground">
          Página {page} de {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="size-9 p-0"
          aria-label="Próxima página"
          title="Próxima página"
          disabled={page === totalPages}
          onClick={() => setPage(page + 1)}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
