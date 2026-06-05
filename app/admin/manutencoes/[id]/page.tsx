'use client'

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@prodexy/ui'
import { PageHeader } from '@/components/layout/page-header'
import { MetricCard } from '@/components/shared/metric-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { brl, date, number } from '@/lib/format'
import { getMaintenance, getMechanic, getService, getVehicle } from '@/lib/selectors'

export default async function MaintenanceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const maintenance = getMaintenance(id)
  if (!maintenance) notFound()
  const vehicle = getVehicle(maintenance.vehicleId)
  const mechanic = getMechanic(maintenance.mechanicId)
  const services = maintenance.serviceIds.map((id) => getService(id)).filter(Boolean)
  return <><PageHeader title={`Manutenção ${vehicle?.plate ?? ''}`} description="Detalhe da manutenção com serviços realizados, causa, valor, mecânico e status."><Button variant="outline">Editar manutenção</Button></PageHeader><div className="mb-5 grid gap-4 md:grid-cols-4"><MetricCard title="Tipo" value={maintenance.maintenanceType}/><MetricCard title="Valor" value={brl(maintenance.value)}/><MetricCard title="KM" value={number(maintenance.currentKm)}/><MetricCard title="Status" value={maintenance.status}/></div><div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle>Registro</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><p><b>Veículo:</b> {vehicle ? <Link className="text-primary" href={`/admin/veiculos/${vehicle.id}`}>{vehicle.plate} · {vehicle.model}</Link> : '—'}</p><p><b>Mecânico:</b> {mechanic?.name}</p><p><b>Data:</b> {date(maintenance.date)}</p><p><b>Causa:</b> {maintenance.cause}</p><p><b>Status:</b> <StatusBadge type="maintenance" value={maintenance.status}/></p><p><b>Observações:</b> {maintenance.notes ?? '—'}</p></CardContent></Card><Card><CardHeader><CardTitle>Serviços realizados</CardTitle></CardHeader><CardContent className="space-y-3">{services.map((service)=><div key={service!.id} className="rounded-lg border p-3"><p className="font-semibold">{service!.name}</p><p className="text-sm text-muted-foreground">{service!.category} · Periodicidade: {service!.periodicityType==='km'?`${number(service!.periodicityKm??0)} km`:service!.periodicityType==='time'?`${service!.periodicityDays} dias`:'sem recorrência'}</p></div>)}</CardContent></Card></div></>
}
