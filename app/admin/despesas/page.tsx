'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@prodexy/ui'
import {
  CircleDollarSign,
  Pencil,
  Plus,
  ReceiptText,
  Tags,
  Utensils,
} from 'lucide-react'
import { ExpenseDialog } from '@/components/expenses/expense-dialog'
import { PageHeader } from '@/components/layout/page-header'
import { FilterInput, FilterSelect } from '@/components/shared/filters'
import { MetricCard } from '@/components/shared/metric-card'
import { brl, dateTime } from '@/lib/format'
import { StatusBadge } from '@/components/shared/status-badge'
import { TableDetailsButton } from '@/components/shared/table-details-button'
import { TablePagination, useTablePagination } from '@/components/shared/table-pagination'
import {
  expenseCategories,
  type ExpenseListItem,
  type ExpenseLookups,
  type MaintenanceExpenseItem,
} from '@/types/expense'

const emptyLookups: ExpenseLookups = {
  vehicles: [],
  drivers: [],
  trips: [],
  parts: [],
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<ExpenseListItem[]>([])
  const [maintenanceExpenses, setMaintenanceExpenses] = useState<MaintenanceExpenseItem[]>([])
  const [lookups, setLookups] = useState<ExpenseLookups>(emptyLookups)
  const [selectedExpense, setSelectedExpense] = useState<ExpenseListItem | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('todas')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadExpenses = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/admin/despesas', { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Não foi possível carregar as despesas.')

      setExpenses(result.items ?? [])
      setMaintenanceExpenses(result.maintenanceItems ?? [])
      setLookups(result.lookups ?? emptyLookups)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar as despesas.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadExpenses()
  }, [loadExpenses])

  const filteredExpenses = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')
    const start = startDate ? new Date(`${startDate}T00:00:00`).getTime() : null
    const end = endDate ? new Date(`${endDate}T23:59:59.999`).getTime() : null

    return expenses.filter((expense) => {
      const registeredAt = new Date(expense.registeredAt).getTime()
      const matchesSearch =
        !term
        || expense.vehicleLabel.toLocaleLowerCase('pt-BR').includes(term)
        || expense.driverName.toLocaleLowerCase('pt-BR').includes(term)
        || expense.notes.toLocaleLowerCase('pt-BR').includes(term)

      return (
        matchesSearch
        && (category === 'todas' || expense.category === category)
        && (start == null || registeredAt >= start)
        && (end == null || registeredAt <= end)
      )
    })
  }, [category, endDate, expenses, search, startDate])
  const expensePagination = useTablePagination(
    filteredExpenses,
    `${search}|${category}|${startDate}|${endDate}`,
  )
  const maintenanceExpensePagination = useTablePagination(maintenanceExpenses)

  const metrics = useMemo(() => ({
    total: expenses.reduce((sum, expense) => sum + expense.value, 0)
      + maintenanceExpenses.reduce((sum, expense) => sum + expense.value, 0),
    maintenance: maintenanceExpenses.reduce((sum, expense) => sum + expense.value, 0),
    toll: expenses
      .filter((expense) => expense.category === 'Pedágio')
      .reduce((sum, expense) => sum + expense.value, 0),
    food: expenses
      .filter((expense) => expense.category === 'Alimentação')
      .reduce((sum, expense) => sum + expense.value, 0),
    categories: new Set(expenses.map((expense) => expense.category)).size,
  }), [expenses, maintenanceExpenses])

  function openNewExpense() {
    setSelectedExpense(null)
    setDialogOpen(true)
  }

  function openEditExpense(expense: ExpenseListItem) {
    setSelectedExpense(expense)
    setDialogOpen(true)
  }

  return (
    <>
      <PageHeader
        title="Despesas"
        description="Custos operacionais de viagens e consumo de peças vinculado às manutenções."
      >
        <Button className="gap-2" onClick={openNewExpense}>
          <Plus className="size-4" />
          Nova despesa
        </Button>
      </PageHeader>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total" value={brl(metrics.total)} icon={CircleDollarSign} />
        <MetricCard title="Manutenções" value={brl(metrics.maintenance)} icon={ReceiptText} />
        <MetricCard title="Alimentação" value={brl(metrics.food)} icon={Utensils} />
        <MetricCard title="Categorias utilizadas" value={metrics.categories} icon={Tags} />
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_minmax(190px,0.5fr)_minmax(160px,0.4fr)_minmax(160px,0.4fr)]">
            <FilterInput
              placeholder="Buscar por veículo, motorista ou observação..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <FilterSelect value={category} onValueChange={setCategory}>
              <option value="todas">Todas as categorias</option>
              {expenseCategories.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </FilterSelect>
            <FilterInput
              type="date"
              aria-label="Data inicial"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
            <FilterInput
              type="date"
              aria-label="Data final"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </div>

          {error ? (
            <div className="flex flex-col gap-3 border-t py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={() => void loadExpenses()}>
                Tentar novamente
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Motorista</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Observação</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      Carregando despesas...
                    </TableCell>
                  </TableRow>
                ) : filteredExpenses.length ? (
                  expensePagination.pageItems.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="whitespace-nowrap">{dateTime(expense.registeredAt)}</TableCell>
                      <TableCell>{expense.category}</TableCell>
                      <TableCell>
                        <p className="font-semibold">{expense.vehicleFleetCode}</p>
                        <p className="text-xs text-muted-foreground">
                          {expense.tripId ? 'Vinculada a viagem' : 'Registro avulso'}
                        </p>
                      </TableCell>
                      <TableCell>{expense.driverName}</TableCell>
                      <TableCell className="font-medium">{brl(expense.value)}</TableCell>
                      <TableCell className="max-w-[280px]">
                        <p className="truncate">{expense.notes || '—'}</p>
                        {expense.parts.length ? (
                          <p className="truncate text-xs text-muted-foreground">
                            {expense.parts.length} peça(s) · {expense.parts
                              .map((part) => `${part.name} (${part.quantity} ${part.unit})`)
                              .join(', ')}
                          </p>
                        ) : null}
                        {expense.receiptPath ? (
                          <p className="truncate text-xs text-muted-foreground">
                            Comprovante: {expense.receiptPath}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => openEditExpense(expense)}
                        >
                          <Pencil className="size-4" />
                          Editar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      Nenhuma despesa encontrada.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
          {!error && !loading ? <TablePagination {...expensePagination} /> : null}
        </CardContent>
      </Card>

      <Card className="mt-5">
        <CardContent className="space-y-4 p-4">
          <div>
            <h2 className="font-semibold">Custos de manutenção</h2>
            <p className="text-sm text-muted-foreground">
              Valores calculados pelos serviços e peças. A composição é editada dentro da manutenção.
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Veículo</TableHead>
                <TableHead className="w-[220px]">Manutenção</TableHead>
                <TableHead>Peças</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    Carregando custos de manutenção...
                  </TableCell>
                </TableRow>
              ) : maintenanceExpenses.length ? maintenanceExpensePagination.pageItems.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell className="whitespace-nowrap">{dateTime(expense.registeredAt)}</TableCell>
                  <TableCell className="font-semibold">{expense.vehicleFleetCode}</TableCell>
                  <TableCell className="max-w-[220px]">
                    <p
                      className="truncate"
                      title={expense.cause || 'Sem descrição'}
                    >
                      {expense.cause || 'Sem descrição'}
                    </p>
                  </TableCell>
                  <TableCell>{expense.partsCount}</TableCell>
                  <TableCell className="font-medium">{brl(expense.value)}</TableCell>
                  <TableCell>
                    <StatusBadge type="maintenance" value={expense.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <TableDetailsButton href={`/admin/manutencoes/${expense.id}`} />
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    Nenhum custo de manutenção registrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {!loading ? <TablePagination {...maintenanceExpensePagination} /> : null}
        </CardContent>
      </Card>

      <ExpenseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        expense={selectedExpense}
        lookups={lookups}
        onSaved={loadExpenses}
      />
    </>
  )
}
