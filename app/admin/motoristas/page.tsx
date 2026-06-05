'use client'

import Link from 'next/link'
import { Button, Card, CardContent, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@prodexy/ui'
import { PageHeader } from '@/components/layout/page-header'
import { MetricCard } from '@/components/shared/metric-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { drivers } from '@/lib/mock-data'
import { getVehicle } from '@/lib/selectors'
import { driverTotalExpenses, driverTotalKm, driverTotalLiters } from '@/lib/calculations'
import { brl, number } from '@/lib/format'
import { FilterInput, FilterSelect } from '@/components/shared/filters'

export default function DriversPage() {
  return (
    <>
      <PageHeader title="Motoristas" description="Controle de dados cadastrais, CNH, veículo principal e histórico operacional."><Button>Novo motorista</Button></PageHeader>
      <div className="mb-5 grid gap-4 md:grid-cols-4"><MetricCard title="Total" value={drivers.length}/><MetricCard title="Ativos" value={drivers.filter(d=>d.status==='ativo').length}/><MetricCard title="CNH vencida" value={drivers.filter(d=>d.licenseStatus==='vencido').length} tone="danger"/><MetricCard title="KM total" value={number(drivers.reduce((a,d)=>a+driverTotalKm(d.id),0))}/></div>
      <Card><CardContent className="space-y-4 p-4"><div className="grid gap-3 md:grid-cols-3"><FilterInput placeholder="Buscar motorista..."/><FilterSelect><option>Todos os status</option></FilterSelect><FilterSelect><option>Situação CNH</option></FilterSelect></div><Table><TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Telefone</TableHead><TableHead>Veículo principal</TableHead><TableHead>CNH</TableHead><TableHead>KM</TableHead><TableHead>Litros</TableHead><TableHead>Despesas</TableHead><TableHead></TableHead></TableRow></TableHeader><TableBody>{drivers.map((driver)=>{const vehicle=getVehicle(driver.mainVehicleId??'');return <TableRow key={driver.id}><TableCell className="font-semibold">{driver.name}</TableCell><TableCell>{driver.phone}</TableCell><TableCell>{vehicle ? `${vehicle.plate} · ${vehicle.model}` : 'Sem veículo'}</TableCell><TableCell><StatusBadge type="document" value={driver.licenseStatus}/></TableCell><TableCell>{number(driverTotalKm(driver.id))}</TableCell><TableCell>{number(driverTotalLiters(driver.id))}</TableCell><TableCell>{brl(driverTotalExpenses(driver.id))}</TableCell><TableCell className="text-right"><Button variant="link" asChild><Link href={`/admin/motoristas/${driver.id}`}>Detalhes →</Link></Button></TableCell></TableRow>})}</TableBody></Table></CardContent></Card>
    </>
  )
}
