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
import { CircleAlert, DollarSign, Droplets, Fuel, Pencil, Plus } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { RefuelingDialog } from '@/components/refuelings/refueling-dialog'
import { FilterInput, FilterSelect } from '@/components/shared/filters'
import { MetricCard } from '@/components/shared/metric-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { TablePagination, useTablePagination } from '@/components/shared/table-pagination'
import { brl, dateTime, number } from '@/lib/format'
import {
  fuelTypes,
  type RefuelingListItem,
  type RefuelingLookups,
} from '@/types/refueling'

const emptyLookups: RefuelingLookups = {
  vehicles: [],
  drivers: [],
  trips: [],
}

export default function RefuelingsPage() {
  const [refuelings, setRefuelings] = useState<RefuelingListItem[]>([])
  const [lookups, setLookups] = useState<RefuelingLookups>(emptyLookups)
  const [selectedRefueling, setSelectedRefueling] = useState<RefuelingListItem | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [fuelType, setFuelType] = useState('todos')
  const [financialStatus, setFinancialStatus] = useState('todos')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadRefuelings = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/admin/abastecimentos', { cache: 'no-store' })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Não foi possível carregar os abastecimentos.')
      }

      setRefuelings(result.items ?? [])
      setLookups(result.lookups ?? emptyLookups)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Não foi possível carregar os abastecimentos.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadRefuelings()
  }, [loadRefuelings])

  const filteredRefuelings = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')
    const start = startDate ? new Date(`${startDate}T00:00:00`).getTime() : null
    const end = endDate ? new Date(`${endDate}T23:59:59.999`).getTime() : null

    return refuelings.filter((refueling) => {
      const registeredAt = new Date(refueling.registeredAt).getTime()
      const matchesSearch =
        !term
        || refueling.vehicleLabel.toLocaleLowerCase('pt-BR').includes(term)
        || refueling.driverName.toLocaleLowerCase('pt-BR').includes(term)
      const matchesFuel = fuelType === 'todos' || refueling.fuelType === fuelType
      const matchesFinancial =
        financialStatus === 'todos'
        || (financialStatus === 'preenchido' && refueling.totalValue != null)
        || (financialStatus === 'pendente' && refueling.totalValue == null)
      const matchesStart = start == null || registeredAt >= start
      const matchesEnd = end == null || registeredAt <= end

      return matchesSearch && matchesFuel && matchesFinancial && matchesStart && matchesEnd
    })
  }, [endDate, financialStatus, fuelType, refuelings, search, startDate])
  const refuelingPagination = useTablePagination(
    filteredRefuelings,
    `${search}|${fuelType}|${financialStatus}|${startDate}|${endDate}`,
  )

  const metrics = useMemo(() => {
    const totalLiters = refuelings.reduce((sum, item) => sum + item.liters, 0)
    const totalValue = refuelings.reduce((sum, item) => sum + (item.totalValue ?? 0), 0)
    const pendingValues = refuelings.filter((item) => item.totalValue == null).length

    return { totalLiters, totalValue, pendingValues }
  }, [refuelings])

  function openNewRefueling() {
    setSelectedRefueling(null)
    setDialogOpen(true)
  }

  function openEditRefueling(refueling: RefuelingListItem) {
    setSelectedRefueling(refueling)
    setDialogOpen(true)
  }

  return (
    <>
      <PageHeader
        title="Abastecimentos"
        description="Controle operacional de consumo e complementação dos valores registrados pelos motoristas."
      >
        <Button className="gap-2" onClick={openNewRefueling}>
          <Plus className="size-4" />
          Novo abastecimento
        </Button>
      </PageHeader>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Registros" value={refuelings.length} icon={Fuel} />
        <MetricCard title="Litros abastecidos" value={number(metrics.totalLiters, 1)} icon={Droplets} />
        <MetricCard title="Custo registrado" value={brl(metrics.totalValue)} icon={DollarSign} />
        <MetricCard
          title="Aguardando valor"
          value={metrics.pendingValues}
          icon={CircleAlert}
          tone={metrics.pendingValues ? 'warning' : undefined}
        />
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_minmax(180px,0.55fr)_minmax(180px,0.55fr)_minmax(150px,0.45fr)_minmax(150px,0.45fr)]">
            <FilterInput
              placeholder="Buscar por veículo ou motorista..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <FilterSelect value={fuelType} onValueChange={setFuelType}>
              <option value="todos">Todos os combustíveis</option>
              {fuelTypes.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </FilterSelect>
            <FilterSelect value={financialStatus} onValueChange={setFinancialStatus}>
              <option value="todos">Todos os valores</option>
              <option value="preenchido">Valor preenchido</option>
              <option value="pendente">Aguardando valor</option>
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
              <Button variant="outline" size="sm" onClick={() => void loadRefuelings()}>
                Tentar novamente
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Motorista</TableHead>
                  <TableHead>KM</TableHead>
                  <TableHead>Combustível</TableHead>
                  <TableHead>Litros</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      Carregando abastecimentos...
                    </TableCell>
                  </TableRow>
                ) : filteredRefuelings.length ? (
                  refuelingPagination.pageItems.map((refueling) => (
                    <TableRow key={refueling.id}>
                      <TableCell className="whitespace-nowrap">
                        {dateTime(refueling.registeredAt)}
                      </TableCell>
                      <TableCell>
                        <p className="font-semibold">{refueling.vehicleFleetCode}</p>
                        <p className="text-xs text-muted-foreground">
                          {refueling.tripId ? 'Vinculado a viagem' : 'Registro avulso'}
                        </p>
                      </TableCell>
                      <TableCell>{refueling.driverName}</TableCell>
                      <TableCell>{number(refueling.registeredKm)}</TableCell>
                      <TableCell>{refueling.fuelType}</TableCell>
                      <TableCell>{number(refueling.liters, 1)} L</TableCell>
                      <TableCell>
                        {refueling.totalValue == null ? (
                          <StatusBadge type="raw" value="pendente" label="Aguardando valor" />
                        ) : (
                          <div>
                            <p className="font-medium">{brl(refueling.totalValue)}</p>
                            {refueling.unitValue != null ? (
                              <p className="text-xs text-muted-foreground">
                                {brl(refueling.unitValue)}/L
                              </p>
                            ) : null}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => openEditRefueling(refueling)}
                        >
                          <Pencil className="size-4" />
                          Editar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      Nenhum abastecimento encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
          {!error && !loading ? <TablePagination {...refuelingPagination} /> : null}
        </CardContent>
      </Card>

      <RefuelingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        refueling={selectedRefueling}
        lookups={lookups}
        onSaved={loadRefuelings}
      />
    </>
  )
}
