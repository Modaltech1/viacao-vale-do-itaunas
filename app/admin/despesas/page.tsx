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
import {
  expenseCategories,
  type ExpenseListItem,
  type ExpenseLookups,
} from '@/types/expense'

const emptyLookups: ExpenseLookups = {
  vehicles: [],
  drivers: [],
  trips: [],
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<ExpenseListItem[]>([])
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

  const metrics = useMemo(() => ({
    total: expenses.reduce((sum, expense) => sum + expense.value, 0),
    toll: expenses
      .filter((expense) => expense.category === 'Pedágio')
      .reduce((sum, expense) => sum + expense.value, 0),
    food: expenses
      .filter((expense) => expense.category === 'Alimentação')
      .reduce((sum, expense) => sum + expense.value, 0),
    categories: new Set(expenses.map((expense) => expense.category)).size,
  }), [expenses])

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
        description="Pedágio, alimentação, hospedagem, descarga e demais custos operacionais das viagens."
      >
        <Button className="gap-2" onClick={openNewExpense}>
          <Plus className="size-4" />
          Nova despesa
        </Button>
      </PageHeader>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total" value={brl(metrics.total)} icon={CircleDollarSign} />
        <MetricCard title="Pedágio" value={brl(metrics.toll)} icon={ReceiptText} />
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
                  filteredExpenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="whitespace-nowrap">{dateTime(expense.registeredAt)}</TableCell>
                      <TableCell>{expense.category}</TableCell>
                      <TableCell>
                        <p className="font-semibold">{expense.vehicleLabel}</p>
                        <p className="text-xs text-muted-foreground">
                          {expense.tripId ? 'Vinculada a viagem' : 'Registro avulso'}
                        </p>
                      </TableCell>
                      <TableCell>{expense.driverName}</TableCell>
                      <TableCell className="font-medium">{brl(expense.value)}</TableCell>
                      <TableCell className="max-w-[280px]">
                        <p className="truncate">{expense.notes || '—'}</p>
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
