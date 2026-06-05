'use client'

import Link from 'next/link'
import { Button, Card, CardContent, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@prodexy/ui'
import { PageHeader } from '@/components/layout/page-header'
import { MetricCard } from '@/components/shared/metric-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { trips } from '@/lib/mock-data'
import { getDriver, getVehicle } from '@/lib/selectors'
import { dateTime, number } from '@/lib/format'
import { tripKm } from '@/lib/calculations'
import { FilterInput, FilterSelect } from '@/components/shared/filters'

export default function TripsPage() {
  return <><PageHeader title="Viagens" description="Viagens com data/hora de saída e chegada, KM inicial/final, rota, motorista e veículo."><Button>Nova viagem</Button></PageHeader><div className="mb-5 grid gap-4 md:grid-cols-4"><MetricCard title="Total" value={trips.length}/><MetricCard title="Em andamento" value={trips.filter(t=>t.status==='em_andamento').length}/><MetricCard title="Concluídas" value={trips.filter(t=>t.status==='concluida').length}/><MetricCard title="KM total" value={number(trips.reduce((a,t)=>a+tripKm(t.initialKm,t.finalKm),0))}/></div><Card><CardContent className="space-y-4 p-4"><div className="grid gap-3 md:grid-cols-4"><FilterInput placeholder="Buscar origem, destino, placa..."/><FilterSelect><option>Todos os status</option></FilterSelect><FilterInput type="date"/><FilterInput type="date"/></div><Table><TableHeader><TableRow><TableHead>Rota</TableHead><TableHead>Motorista</TableHead><TableHead>Veículo</TableHead><TableHead>Saída</TableHead><TableHead>Chegada</TableHead><TableHead>KM inicial/final</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader><TableBody>{trips.map((trip)=>{const driver=getDriver(trip.driverId); const vehicle=getVehicle(trip.vehicleId);return <TableRow key={trip.id}><TableCell>{trip.origin} → {trip.destination}{trip.temporaryVehicleAssignment?<span className="ml-2 text-xs text-amber-600">temporário</span>:null}</TableCell><TableCell>{driver?.name}</TableCell><TableCell>{vehicle?.plate}</TableCell><TableCell>{dateTime(trip.startedAt)}</TableCell><TableCell>{dateTime(trip.finishedAt)}</TableCell><TableCell>{number(trip.initialKm)} / {trip.finalKm?number(trip.finalKm):'—'}</TableCell><TableCell><StatusBadge type="trip" value={trip.status}/></TableCell><TableCell><Button variant="link" asChild><Link href={`/admin/viagens/${trip.id}`}>Detalhes →</Link></Button></TableCell></TableRow>})}</TableBody></Table></CardContent></Card></>
}
