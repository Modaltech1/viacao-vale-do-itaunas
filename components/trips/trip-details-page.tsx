'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@prodexy/ui'
import { DollarSign, Edit3, Fuel, Gauge, Route, SquareCheckBig } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { MetricCard } from '@/components/shared/metric-card'
import { Section } from '@/components/shared/section'
import { StatusBadge } from '@/components/shared/status-badge'
import { ConcludeTripDialog, TripDialog } from '@/components/trips/trip-dialogs'
import { brl, dateTime, number } from '@/lib/format'
import type { TripDetails, TripFormOptions } from '@/types/trip'

const emptyOptions: TripFormOptions = { drivers: [], vehicles: [] }

export function TripDetailsPage({ tripId }: { tripId: string }) {
  const [trip, setTrip] = useState<TripDetails | null>(null)
  const [options, setOptions] = useState<TripFormOptions>(emptyOptions)
  const [editOpen, setEditOpen] = useState(false)
  const [concludeOpen, setConcludeOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadTrip = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const detailResponse = await fetch(`/api/admin/viagens/${tripId}`, { cache: 'no-store' })
      const detailResult = await detailResponse.json()

      if (!detailResponse.ok) {
        throw new Error(detailResult.error || 'Não foi possível carregar a viagem.')
      }

      setTrip(detailResult.trip)
      setOptions(detailResult.options ?? emptyOptions)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar a viagem.')
    } finally {
      setLoading(false)
    }
  }, [tripId])

  useEffect(() => {
    void loadTrip()
  }, [loadTrip])

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Carregando viagem...
        </CardContent>
      </Card>
    )
  }

  if (error || !trip) {
    return (
      <Card>
        <CardContent className="space-y-4 p-8 text-center">
          <p className="text-destructive">{error || 'Viagem não encontrada.'}</p>
          <Button variant="outline" asChild>
            <Link href="/admin/viagens">Voltar para viagens</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  const totalCost = trip.refuelingValue + trip.expenseValue
  const consumption = trip.totalKm != null && trip.fuelLiters > 0
    ? trip.totalKm / trip.fuelLiters
    : null

  return (
    <>
      <PageHeader
        title={`${trip.origin} → ${trip.destination}`}
        description="Detalhes operacionais e financeiros preservados no histórico da viagem."
        backHref="/admin/viagens"
        backLabel="Voltar para viagens"
      >
        <Button variant="outline" className="gap-2" onClick={() => setEditOpen(true)}>
          <Edit3 className="size-4" />
          Editar viagem
        </Button>
        {trip.status === 'em_andamento' ? (
          <Button className="gap-2" onClick={() => setConcludeOpen(true)}>
            <SquareCheckBig className="size-4" />
            Concluir viagem
          </Button>
        ) : null}
      </PageHeader>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          title="Status"
          value={trip.status === 'em_andamento' ? 'Em andamento' : trip.status === 'concluida' ? 'Concluída' : 'Cancelada'}
          icon={Route}
        />
        <MetricCard title="KM rodados" value={trip.totalKm == null ? '—' : number(trip.totalKm)} icon={Gauge} />
        <MetricCard title="Litros" value={number(trip.fuelLiters, 1)} icon={Fuel} />
        <MetricCard title="Custo total" value={brl(totalCost)} icon={DollarSign} />
        <MetricCard
          title="Consumo médio"
          value={consumption == null ? '—' : `${number(consumption, 2)} km/L`}
          icon={Gauge}
        />
      </div>

      <div className="mb-5 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Dados da viagem</CardTitle></CardHeader>
          <CardContent className="divide-y text-sm">
            <div className="flex justify-between gap-4 py-3 first:pt-0">
              <span className="text-muted-foreground">Motorista</span>
              <Link className="text-right font-medium text-primary" href={`/admin/motoristas/${trip.driverId}`}>
                {trip.driverName}
              </Link>
            </div>
            <div className="flex justify-between gap-4 py-3">
              <span className="text-muted-foreground">Veículo</span>
              <Link className="text-right font-medium text-primary" href={`/admin/veiculos/${trip.vehicleId}`}>
                {trip.vehicleLabel}
              </Link>
            </div>
            <div className="flex justify-between gap-4 py-3">
              <span className="text-muted-foreground">Saída</span>
              <span className="text-right font-medium">{dateTime(trip.startedAt)}</span>
            </div>
            <div className="flex justify-between gap-4 py-3">
              <span className="text-muted-foreground">Chegada</span>
              <span className="text-right font-medium">{dateTime(trip.finishedAt ?? undefined)}</span>
            </div>
            <div className="flex justify-between gap-4 py-3">
              <span className="text-muted-foreground">KM inicial / final</span>
              <span className="text-right font-medium">
                {number(trip.initialKm)} / {trip.finalKm == null ? '—' : number(trip.finalKm)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 py-3 last:pb-0">
              <span className="text-muted-foreground">Status</span>
              <StatusBadge type="trip" value={trip.status} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Rota registrada</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xl font-semibold">{trip.origin}</p>
              <p className="my-1 text-sm text-muted-foreground">para</p>
              <p className="text-xl font-semibold">{trip.destination}</p>
            </div>
            <div className="border-t pt-4 text-sm">
              <p><b>Rota:</b> {trip.routeName || 'Informada diretamente na viagem'}</p>
              <p className="mt-2">
                <b>KM estimado:</b>{' '}
                {trip.estimatedKm == null ? 'Não informado' : `${number(trip.estimatedKm)} km`}
              </p>
              {trip.temporaryVehicle ? (
                <p className="mt-3 border-l-2 border-amber-500 pl-3 text-amber-700">
                  Veículo registrado como uso temporário para este motorista.
                </p>
              ) : null}
              {trip.notes ? <p className="mt-3"><b>Observações:</b> {trip.notes}</p> : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Abastecimentos da viagem">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>KM</TableHead>
                <TableHead>Combustível</TableHead>
                <TableHead>Litros</TableHead>
                <TableHead>Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trip.refuelings.length ? trip.refuelings.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{dateTime(item.registeredAt)}</TableCell>
                  <TableCell>{number(item.registeredKm)}</TableCell>
                  <TableCell>{item.fuelType}</TableCell>
                  <TableCell>{number(item.liters, 1)} L</TableCell>
                  <TableCell>{item.totalValue == null ? 'Pendente' : brl(item.totalValue)}</TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    Nenhum abastecimento registrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Section>

        <Section title="Despesas da viagem">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Observação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trip.expenses.length ? trip.expenses.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{dateTime(item.registeredAt)}</TableCell>
                  <TableCell>{item.category}</TableCell>
                  <TableCell>{brl(item.value)}</TableCell>
                  <TableCell>{item.notes || '—'}</TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    Nenhuma despesa registrada.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Section>
      </div>

      <TripDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        options={options}
        trip={trip}
        onSaved={loadTrip}
      />
      {trip.status === 'em_andamento' ? (
        <ConcludeTripDialog
          open={concludeOpen}
          onOpenChange={setConcludeOpen}
          trip={trip}
          onSaved={loadTrip}
        />
      ) : null}
    </>
  )
}
