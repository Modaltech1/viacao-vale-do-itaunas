'use client'

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Button, Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@prodexy/ui'
import { PageHeader } from '@/components/layout/page-header'
import { MetricCard } from '@/components/shared/metric-card'
import { Section } from '@/components/shared/section'
import { StatusBadge } from '@/components/shared/status-badge'
import { brl, dateTime, number } from '@/lib/format'
import { getDriver, getTrip, getVehicle, tripExpenses, tripRefuelings } from '@/lib/selectors'
import { tripKm } from '@/lib/calculations'

export default async function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const trip = getTrip(id)
  if (!trip) notFound()
  const driver = getDriver(trip.driverId)
  const vehicle = getVehicle(trip.vehicleId)
  const refuelings = tripRefuelings(trip.id)
  const expenses = tripExpenses(trip.id)
  const totalExpenses = expenses.reduce((acc, item) => acc + item.value, 0)
  const totalLiters = refuelings.reduce((acc, item) => acc + item.liters, 0)
  const km = tripKm(trip.initialKm, trip.finalKm)
  return <><PageHeader title={`Viagem ${trip.origin} → ${trip.destination}`} description="Detalhes da viagem, com registros operacionais de abastecimento e despesas."><Button variant="outline">Editar viagem</Button></PageHeader><div className="mb-5 grid gap-4 md:grid-cols-5"><MetricCard title="Status" value={trip.status==='em_andamento'?'Em andamento':'Concluída'}/><MetricCard title="KM total" value={km?number(km):'—'}/><MetricCard title="Litros" value={number(totalLiters)}/><MetricCard title="Despesas" value={brl(totalExpenses)}/><MetricCard title="Consumo" value={km&&totalLiters?`${number(km/totalLiters,2)} km/L`:'—'}/></div><div className="mb-5 grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle>Dados da viagem</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><p><b>Motorista:</b> {driver ? <Link className="text-primary" href={`/admin/motoristas/${driver.id}`}>{driver.name}</Link> : '—'}</p><p><b>Veículo:</b> {vehicle ? <Link className="text-primary" href={`/admin/veiculos/${vehicle.id}`}>{vehicle.plate} · {vehicle.model}</Link> : '—'}</p><p><b>Saída:</b> {dateTime(trip.startedAt)}</p><p><b>Chegada:</b> {dateTime(trip.finishedAt)}</p><p><b>KM inicial:</b> {number(trip.initialKm)}</p><p><b>KM final:</b> {trip.finalKm ? number(trip.finalKm) : '—'}</p><p><b>Status:</b> <StatusBadge type="trip" value={trip.status}/></p>{trip.temporaryVehicleAssignment ? <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-amber-700">Veículo usado temporariamente por troca feita pelo admin.</p> : null}</CardContent></Card><Card><CardHeader><CardTitle>Origem e destino</CardTitle></CardHeader><CardContent><p className="text-xl font-semibold">{trip.origin}</p><p className="text-muted-foreground">para</p><p className="text-xl font-semibold">{trip.destination}</p><p className="mt-4 text-sm text-muted-foreground">A origem/destino vêm da rota fixa configurada no veículo, mas ficam gravados na viagem.</p></CardContent></Card></div><div className="grid gap-4 xl:grid-cols-2"><Section title="Abastecimentos da viagem"><Table><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>KM</TableHead><TableHead>Combustível</TableHead><TableHead>Litros</TableHead><TableHead>Valor</TableHead></TableRow></TableHeader><TableBody>{refuelings.map((item)=><TableRow key={item.id}><TableCell>{dateTime(item.date)}</TableCell><TableCell>{number(item.currentKm)}</TableCell><TableCell>{item.fuelType}</TableCell><TableCell>{number(item.liters)}</TableCell><TableCell>{brl(item.totalValue??0)}</TableCell></TableRow>)}</TableBody></Table></Section><Section title="Despesas da viagem"><Table><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Tipo</TableHead><TableHead>Valor</TableHead><TableHead>Obs.</TableHead></TableRow></TableHeader><TableBody>{expenses.map((item)=><TableRow key={item.id}><TableCell>{dateTime(item.date)}</TableCell><TableCell>{item.type}</TableCell><TableCell>{brl(item.value)}</TableCell><TableCell>{item.notes}</TableCell></TableRow>)}</TableBody></Table></Section></div></>
}
