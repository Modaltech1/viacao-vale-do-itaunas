'use client'

import Link from 'next/link'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@prodexy/ui'
import { AlertTriangle, ClipboardList } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { MetricCard } from '@/components/shared/metric-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { date, number } from '@/lib/format'
import { pendingItems } from '@/lib/mock-data'
import { getService, getVehicle } from '@/lib/selectors'

const groups = [
  { key: 'critica', title: 'Críticas' },
  { key: 'atencao', title: 'Atenção' },
  { key: 'baixa', title: 'Baixas' },
] as const

export default function MechanicPendingsPage() {
  return (
    <>
      <PageHeader
        title="Pendências"
        description="Fila operacional de serviços, documentos, CETURB, pneus e manutenções abertas."
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total" value={pendingItems.length} icon={ClipboardList} />
        <MetricCard title="Críticas" value={pendingItems.filter((item) => item.severity === 'critica').length} tone="danger" />
        <MetricCard title="Atenção" value={pendingItems.filter((item) => item.severity === 'atencao').length} tone="warning" />
        <MetricCard title="CETURB" value={pendingItems.filter((item) => item.type === 'ceturb').length} icon={AlertTriangle} />
      </div>

      <div className="space-y-5">
        {groups.map((group) => {
          const items = pendingItems.filter((item) => item.severity === group.key)
          if (!items.length) return null

          return (
            <Card key={group.key}>
              <CardHeader>
                <CardTitle>
                  {group.title} ({items.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="divide-y px-0">
                {items.map((item) => {
                  const vehicle = getVehicle(item.vehicleId ?? '')
                  const service = getService(item.serviceId)
                  const href = vehicle ? `/mechanic/veiculos/${vehicle.id}` : '/mechanic/pendencias'

                  return (
                    <div
                      key={item.id}
                      className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{item.title}</p>
                          <StatusBadge type="severity" value={item.severity} />
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {vehicle ? `${vehicle.plate} - ${vehicle.model}` : ''}
                          {service ? ` - Serviço: ${service.name}` : ''}
                          {item.dueKm ? ` - Vence em ${number(item.dueKm)} km` : ''}
                          {item.dueDate ? ` - Data ${date(item.dueDate)}` : ''}
                        </p>
                      </div>

                      <Button variant="outline" size="sm" asChild>
                        <Link href={href}>{item.actionLabel}</Link>
                      </Button>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </>
  )
}
