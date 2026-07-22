import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import {
  TablePagination,
  useTablePagination,
} from '@/components/shared/table-pagination'

afterEach(cleanup)

function Harness({ totalItems }: { totalItems: number }) {
  const pagination = useTablePagination(
    Array.from({ length: totalItems }, (_, index) => index + 1),
  )

  return <TablePagination {...pagination} />
}

describe('paginacao compartilhada', () => {
  it('mantem o contador visivel quando ha menos de dez registros', () => {
    render(<Harness totalItems={6} />)

    expect(screen.getByText('1 - 6 de 6')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('exibe um estado vazio sem controles de navegacao', () => {
    render(<Harness totalItems={0} />)

    expect(screen.getByText('0 de 0')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('mantem contador e navegacao sincronizados em varias paginas', async () => {
    const user = userEvent.setup()
    render(<Harness totalItems={12} />)

    expect(screen.getByText('1 - 10 de 12')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Pr\u00f3xima p\u00e1gina' }))
    expect(screen.getByText('11 - 12 de 12')).toBeInTheDocument()
    expect(screen.getByText('P\u00e1gina 2 de 2')).toBeInTheDocument()
  })
})
