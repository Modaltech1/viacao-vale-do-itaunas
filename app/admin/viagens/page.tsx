'use client'

import Link from 'next/link'
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
import { CheckCircle2, Gauge, Plus, Route, Timer } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { FilterInput, FilterSelect } from '@/components/shared/filters'
import { MetricCard } from '@/components/shared/metric-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { TripDialog } from '@/components/trips/trip-dialogs'
import { dateTime, number } from '@/lib/format'
import type { TripFormOptions, TripListItem } from '@/types/trip'

const emptyOptions: TripFormOptions = { drivers: [], vehicles: [] }

export default function TripsPage() {
  const [trips, setTrips] = useState<TripListItem[]>([])
  const [options, setOptions] = useState<TripFormOptions>(emptyOptions)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('todos')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadTrips = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/admin/viagens', { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Não foi possível carregar as viagens.')

      setTrips(result.items ?? [])
      setOptions(result.options ?? emptyOptions)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar as viagens.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTrips()
  }, [loadTrips])

  const filteredTrips = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')
    const start = startDate ? new Date(`${startDate}T00:00:00`).getTime() : null
    const end = endDate ? new Date(`${endDate}T23:59:59.999`).getTime() : null

    return trips.filter((trip) => {
      const startedAt = new Date(trip.startedAt).getTime()
      const matchesSearch =
        !term
        || trip.origin.toLocaleLowerCase('pt-BR').includes(term)
        || trip.destination.toLocaleLowerCase('pt-BR').includes(term)
        || trip.driverName.toLocaleLowerCase('pt-BR').includes(term)
        || trip.vehicleLabel.toLocaleLowerCase('pt-BR').includes(term)

      return (
        matchesSearch
        && (status === 'todos' || trip.status === status)
        && (start == null || startedAt >= start)
        && (end == null || startedAt <= end)
      )
    })
  }, [endDate, search, startDate, status, trips])

  const totalKm = trips.reduce((sum, trip) => sum + (trip.totalKm ?? 0), 0)

  return (
    <>
      <PageHeader
        title="Viagens"
        description="Acompanhamento de rotas, motoristas, veículos e quilometragem operacional."
      >
        <Button className="gap-2" onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" />
          Nova viagem
        </Button>
      </PageHeader>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total" value={trips.length} icon={Route} />
        <MetricCard
          title="Em andamento"
          value={trips.filter((trip) => trip.status === 'em_andamento').length}
          icon={Timer}
          tone="warning"
        />
        <MetricCard
          title="Concluídas"
          value={trips.filter((trip) => trip.status === 'concluida').length}
          icon={CheckCircle2}
          tone="success"
        />
        <MetricCard title="KM rodados" value={number(totalKm)} icon={Gauge} />
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_minmax(180px,0.45fr)_minmax(160px,0.4fr)_minmax(160px,0.4fr)]">
            <FilterInput
              placeholder="Buscar rota, motorista ou veículo..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <FilterSelect value={status} onValueChange={setStatus}>
              <option value="todos">Todos os status</option>
              <option value="em_andamento">Em andamento</option>
              <option value="concluida">Concluídas</option>
              <option value="cancelada">Canceladas</option>
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
              <Button variant="outline" size="sm" onClick={() => void loadTrips()}>
                Tentar novamente
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rota</TableHead>
                  <TableHead>Motorista</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Saída</TableHead>
                  <TableHead>Chegada</TableHead>
                  <TableHead>KM</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      Carregando viagens...
                    </TableCell>
                  </TableRow>
                ) : filteredTrips.length ? (
                  filteredTrips.map((trip) => (
                    <TableRow key={trip.id}>
                      <TableCell>
                        <p className="font-semibold">{trip.origin} → {trip.destination}</p>
                        <p className="text-xs text-muted-foreground">
                          {trip.routeName || 'Rota informada na viagem'}
                          {trip.temporaryVehicle ? ' · Veículo temporário' : ''}
                        </p>
                      </TableCell>
                      <TableCell>{trip.driverName}</TableCell>
                      <TableCell>{trip.vehicleLabel}</TableCell>
                      <TableCell className="whitespace-nowrap">{dateTime(trip.startedAt)}</TableCell>
                      <TableCell className="whitespace-nowrap">{dateTime(trip.finishedAt ?? undefined)}</TableCell>
                      <TableCell>
                        <p>{number(trip.initialKm)} / {trip.finalKm == null ? '—' : number(trip.finalKm)}</p>
                        {trip.totalKm != null ? (
                          <p className="text-xs text-muted-foreground">{number(trip.totalKm)} km rodados</p>
                        ) : null}
                      </TableCell>
                      <TableCell><StatusBadge type="trip" value={trip.status} /></TableCell>
                      <TableCell className="text-right">
                        <Button variant="link" asChild>
                          <Link href={`/admin/viagens/${trip.id}`}>Detalhes →</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      Nenhuma viagem encontrada.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <TripDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        options={options}
        onSaved={loadTrips}
      />
    </>
  )
}
