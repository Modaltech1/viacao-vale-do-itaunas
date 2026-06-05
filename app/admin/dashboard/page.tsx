'use client'

import Link from 'next/link'
import { AlertTriangle, Bus, DollarSign, Fuel, Gauge, Route, Wrench } from 'lucide-react'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@prodexy/ui'
import { PageHeader } from '@/components/layout/page-header'
import { FilterSelect } from '@/components/shared/filters'
import { MetricCard } from '@/components/shared/metric-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { brl, number } from '@/lib/format'
import { dashboardTotals } from '@/lib/calculations'
import { pendingItems, vehicles } from '@/lib/mock-data'
import { vehicleStatusLabel } from '@/lib/status'

export default function AdminDashboardPage() {
  const totals = dashboardTotals()
  const totalCost = totals.refuelingCost + totals.maintenanceCost + totals.travelExpenseCost

  return (
    <div className="space-y-8">
      <PageHeader title="Dashboard" description="Visão gerencial da operação, com indicadores gerais da frota.">
        <FilterSelect className="sm:w-[200px]">
          <option>Mês atual</option>
          <option>Últimos 30 dias</option>
          <option>Trimestre</option>
          <option>Personalizado</option>
        </FilterSelect>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total de veículos" value={totals.totalVehicles} icon={Bus} />
        <MetricCard title="Em manutenção" value={totals.maintenanceVehicles} icon={Wrench} tone="warning" />
        <MetricCard title="Viagens em andamento" value={totals.openTrips} icon={Route} />
        <MetricCard title="Pendências críticas" value={totals.criticalPendings} icon={AlertTriangle} tone="danger" />
        <MetricCard title="KM rodados" value={number(totals.totalKm)} subtitle="no período" icon={Route} />
        <MetricCard title="Litros abastecidos" value={number(totals.totalLiters)} subtitle="no período" icon={Fuel} />
        <MetricCard title="Consumo médio" value={`${number(totals.averageConsumption, 2)} km/L`} icon={Gauge} />
        <MetricCard title="Gasto total" value={brl(totalCost)} subtitle="no período" icon={DollarSign} tone="danger" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Alertas recentes</CardTitle>
            <Button variant="link" asChild>
              <Link href="/admin/pendencias">Ver todas →</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingItems.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-4 border-b pb-4 last:border-0 last:pb-0"
                >
                  <div className="space-y-1">
                    <p className="font-semibold">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                  <StatusBadge type="severity" value={item.severity} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Status dos veículos</CardTitle>
            <Button variant="link" asChild>
              <Link href="/admin/veiculos">Ver todos →</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {vehicles.slice(0, 6).map((vehicle) => (
                <div
                  key={vehicle.id}
                  className="flex items-center justify-between gap-4 border-b pb-4 last:border-0 last:pb-0"
                >
                  <div className="space-y-1">
                    <Link href={`/admin/veiculos/${vehicle.id}`} className="font-semibold text-primary hover:underline">
                      {vehicle.plate} — {vehicle.brand} {vehicle.model}
                    </Link>
                    <p className="text-sm text-muted-foreground">KM atual: {number(vehicle.currentKm)}</p>
                  </div>
                  <Badge variant="outline">{vehicleStatusLabel[vehicle.status]}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
