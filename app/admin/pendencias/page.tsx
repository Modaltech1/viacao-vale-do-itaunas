'use client'

import Link from 'next/link'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@prodexy/ui'
import { PageHeader } from '@/components/layout/page-header'
import { MetricCard } from '@/components/shared/metric-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { pendingItems } from '@/lib/mock-data'
import { date, number } from '@/lib/format'
import { getDriver, getService, getVehicle } from '@/lib/selectors'

export default function PendingsPage() {
  const groups = [
    { key: 'critica', title: 'Críticas' },
    { key: 'atencao', title: 'Atenção' },
    { key: 'baixa', title: 'Baixas' },
  ] as const
  return <><PageHeader title="Pendências" description="Central de alertas: serviços, documentação, CETURB, tacógrafo, CNH e manutenções abertas."/><div className="mb-5 grid gap-4 md:grid-cols-4"><MetricCard title="Total" value={pendingItems.length}/><MetricCard title="Críticas" value={pendingItems.filter(p=>p.severity==='critica').length} tone="danger"/><MetricCard title="Atenção" value={pendingItems.filter(p=>p.severity==='atencao').length} tone="warning"/><MetricCard title="CETURB" value={pendingItems.filter(p=>p.type==='ceturb').length}/></div><div className="space-y-5">{groups.map((group)=>{const items=pendingItems.filter((p)=>p.severity===group.key); if(!items.length) return null; return <Card key={group.key}><CardHeader><CardTitle>{group.title} ({items.length})</CardTitle></CardHeader><CardContent className="divide-y px-0">{items.map((item)=>{const vehicle=getVehicle(item.vehicleId??''); const driver=getDriver(item.driverId); const service=getService(item.serviceId); const href=vehicle?`/admin/veiculos/${vehicle.id}`:driver?`/admin/motoristas/${driver.id}`:'/admin/pendencias'; return <div key={item.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between"><div><p className="font-semibold">{item.title}</p><p className="text-sm text-muted-foreground">{item.description}</p><p className="mt-1 text-xs text-muted-foreground">{vehicle?`${vehicle.plate} · ${vehicle.model}`:''}{driver?driver.name:''}{service?` · Serviço: ${service.name}`:''}{item.dueKm?` · Vence em ${number(item.dueKm)} km`:''}{item.dueDate?` · Data ${date(item.dueDate)}`:''}</p></div><div className="flex items-center gap-2"><StatusBadge type="severity" value={item.severity}/><Button variant="outline" size="sm" asChild><Link href={href}>{item.actionLabel}</Link></Button></div></div>})}</CardContent></Card>})}</div></>
}
