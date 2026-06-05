'use client'

import Link from 'next/link'
import { Button, Card, CardContent, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@prodexy/ui'
import { PageHeader } from '@/components/layout/page-header'
import { MetricCard } from '@/components/shared/metric-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { brl, date, number } from '@/lib/format'
import { maintenances } from '@/lib/mock-data'
import { getMechanic, getService, getVehicle } from '@/lib/selectors'
import { FilterInput, FilterSelect } from '@/components/shared/filters'

export default function MaintenancesPage() {
  return <><PageHeader title="Manutenções" description="Execução de um ou mais serviços em um veículo. Pode ser preventiva ou corretiva."><Button>Nova manutenção</Button></PageHeader><div className="mb-5 grid gap-4 md:grid-cols-5"><MetricCard title="Total" value={maintenances.length}/><MetricCard title="Preventivas" value={maintenances.filter(m=>m.maintenanceType==='preventiva').length} tone="success"/><MetricCard title="Corretivas" value={maintenances.filter(m=>m.maintenanceType==='corretiva').length} tone="danger"/><MetricCard title="Abertas" value={maintenances.filter(m=>m.status==='aberta'||m.status==='em_andamento').length} tone="warning"/><MetricCard title="Custo" value={brl(maintenances.reduce((a,m)=>a+m.value,0))}/></div><Card><CardContent className="space-y-4 p-4"><div className="grid gap-3 md:grid-cols-5"><FilterInput placeholder="Buscar placa, causa, serviço..."/><FilterSelect><option>Todos os tipos</option><option>Preventiva</option><option>Corretiva</option></FilterSelect><FilterSelect><option>Todos os status</option></FilterSelect><FilterInput type="date"/><FilterInput type="date"/></div><Table><TableHeader><TableRow><TableHead>Veículo</TableHead><TableHead>Tipo</TableHead><TableHead>Serviços</TableHead><TableHead>Data</TableHead><TableHead>KM</TableHead><TableHead>Mecânico</TableHead><TableHead>Valor</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader><TableBody>{maintenances.map((item)=>{const vehicle=getVehicle(item.vehicleId); const mechanic=getMechanic(item.mechanicId); return <TableRow key={item.id}><TableCell className="font-semibold">{vehicle?.plate}<br/><span className="text-xs text-muted-foreground">{vehicle?.model}</span></TableCell><TableCell>{item.maintenanceType}</TableCell><TableCell>{item.serviceIds.map(id=>getService(id)?.name).join(', ')}</TableCell><TableCell>{date(item.date)}</TableCell><TableCell>{number(item.currentKm)}</TableCell><TableCell>{mechanic?.name}</TableCell><TableCell>{brl(item.value)}</TableCell><TableCell><StatusBadge type="maintenance" value={item.status}/></TableCell><TableCell><Button variant="link" asChild><Link href={`/admin/manutencoes/${item.id}`}>Detalhes →</Link></Button></TableCell></TableRow>})}</TableBody></Table></CardContent></Card></>
}
