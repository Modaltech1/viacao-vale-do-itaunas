'use client'

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Button, Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tabs, TabsContent, TabsList, TabsTrigger } from '@prodexy/ui'
import { PageHeader } from '@/components/layout/page-header'
import { MetricCard } from '@/components/shared/metric-card'
import { Section } from '@/components/shared/section'
import { StatusBadge } from '@/components/shared/status-badge'
import { brl, date, dateTime, maskCpf, number } from '@/lib/format'
import { drivers } from '@/lib/mock-data'
import { driverExpenses, driverRefuelings, driverTrips, getVehicle } from '@/lib/selectors'
import { driverTotalExpenses, driverTotalKm, driverTotalLiters } from '@/lib/calculations'

export default async function DriverDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const driver = drivers.find((item) => item.id === id)
  if (!driver) notFound()
  const vehicle = getVehicle(driver.mainVehicleId ?? '')
  const trips = driverTrips(driver.id)
  const refuelings = driverRefuelings(driver.id)
  const expenses = driverExpenses(driver.id)
  return (
    <>
      <PageHeader title={driver.name} description="Detalhes do motorista: cadastro, CNH, veículo principal, viagens, consumo e despesas."><Button variant="outline">Editar motorista</Button><Button>Alterar veículo principal</Button></PageHeader>
      <div className="mb-5 grid gap-4 md:grid-cols-5"><MetricCard title="Viagens" value={trips.length}/><MetricCard title="KM rodados" value={number(driverTotalKm(driver.id))}/><MetricCard title="Litros registrados" value={number(driverTotalLiters(driver.id))}/><MetricCard title="Despesas" value={brl(driverTotalExpenses(driver.id))}/><MetricCard title="Status CNH" value={driver.licenseStatus==='em_dia'?'Em dia':driver.licenseStatus==='proximo'?'Próxima':'Vencida'} tone={driver.licenseStatus==='vencido'?'danger':'default'}/></div>
      <div className="mb-5 grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle>Cadastro</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><p><b>Telefone:</b> {driver.phone}</p><p><b>Endereço:</b> {driver.address}</p><p><b>CPF:</b> {maskCpf(driver.cpf)}</p><p><b>Habilitação:</b> {driver.licenseNumber}</p><p><b>Validade:</b> {date(driver.licenseDueDate)} <StatusBadge type="document" value={driver.licenseStatus}/></p></CardContent></Card><Card><CardHeader><CardTitle>Veículo principal</CardTitle></CardHeader><CardContent>{vehicle ? <div className="space-y-2 text-sm"><p className="text-lg font-semibold">{vehicle.plate} — {vehicle.brand} {vehicle.model}</p><p>KM atual: {number(vehicle.currentKm)}</p><p>Status: <StatusBadge type="vehicle" value={vehicle.status}/></p><Button variant="outline" asChild><Link href={`/admin/veiculos/${vehicle.id}`}>Abrir veículo</Link></Button></div> : 'Sem veículo principal'}</CardContent></Card></div>
      <Tabs defaultValue="viagens"><TabsList><TabsTrigger value="viagens">Viagens</TabsTrigger><TabsTrigger value="abastecimentos">Abastecimentos</TabsTrigger><TabsTrigger value="despesas">Despesas</TabsTrigger></TabsList><TabsContent value="viagens"><Section title="Viagens"><Table><TableHeader><TableRow><TableHead>Rota</TableHead><TableHead>Saída</TableHead><TableHead>Chegada</TableHead><TableHead>KM</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader><TableBody>{trips.map((trip)=><TableRow key={trip.id}><TableCell>{trip.origin} → {trip.destination}</TableCell><TableCell>{dateTime(trip.startedAt)}</TableCell><TableCell>{dateTime(trip.finishedAt)}</TableCell><TableCell>{trip.finalKm?number(trip.finalKm-trip.initialKm):'—'}</TableCell><TableCell><StatusBadge type="trip" value={trip.status}/></TableCell><TableCell><Button variant="link" asChild><Link href={`/admin/viagens/${trip.id}`}>Detalhes →</Link></Button></TableCell></TableRow>)}</TableBody></Table></Section></TabsContent><TabsContent value="abastecimentos"><Section title="Abastecimentos"><Table><TableBody>{refuelings.map((item)=><TableRow key={item.id}><TableCell>{dateTime(item.date)}</TableCell><TableCell>{item.fuelType}</TableCell><TableCell>{number(item.liters)} litros</TableCell><TableCell>{number(item.currentKm)} km</TableCell></TableRow>)}</TableBody></Table></Section></TabsContent><TabsContent value="despesas"><Section title="Despesas"><Table><TableBody>{expenses.map((item)=><TableRow key={item.id}><TableCell>{dateTime(item.date)}</TableCell><TableCell>{item.type}</TableCell><TableCell>{brl(item.value)}</TableCell><TableCell>{item.notes}</TableCell></TableRow>)}</TableBody></Table></Section></TabsContent></Tabs>
    </>
  )
}
