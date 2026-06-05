'use client'

import Link from 'next/link'
import { Button, Card, CardContent } from '@prodexy/ui'
import { Bus, Gauge, Wrench } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { FilterInput, FilterSelect } from '@/components/shared/filters'
import { MetricCard } from '@/components/shared/metric-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { number } from '@/lib/format'
import { vehicles } from '@/lib/mock-data'
import { vehiclePendings } from '@/lib/selectors'

export default function MechanicVehiclesPage() {
  const vehiclesWithPendings = vehicles.filter((vehicle) => vehiclePendings(vehicle.id).length > 0)

  return (
    <>
      <PageHeader
        title="Veículos"
        description="Consulta rápida da frota para manutenção, alertas e serviços programados."
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total" value={vehicles.length} icon={Bus} />
        <MetricCard title="Ativos" value={vehicles.filter((vehicle) => vehicle.status === 'ativo').length} tone="success" />
        <MetricCard title="Em manutenção" value={vehicles.filter((vehicle) => vehicle.status === 'em_manutencao').length} icon={Wrench} tone="warning" />
        <MetricCard title="Com pendências" value={vehiclesWithPendings.length} icon={Gauge} tone="danger" />
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <FilterInput placeholder="Buscar por placa, modelo ou tipo..." />
            <FilterSelect>
              <option>Todos os status</option>
              <option>Ativo</option>
              <option>Em manutenção</option>
              <option>Inativo</option>
            </FilterSelect>
          </div>

          <div className="space-y-3">
            {vehicles.map((vehicle) => {
              const pendings = vehiclePendings(vehicle.id)

              return (
                <Link
                  key={vehicle.id}
                  href={`/mechanic/veiculos/${vehicle.id}`}
                  className="flex flex-col gap-3 rounded-xl border p-4 transition-colors hover:bg-muted/60 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">
                        {vehicle.plate} - {vehicle.brand} {vehicle.model}
                      </p>
                      <StatusBadge type="vehicle" value={vehicle.status} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {vehicle.type} - KM {number(vehicle.currentKm)}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">{pendings.length} pendência(s)</span>
                    <Button variant="link" className="px-0" asChild>
                      <span>Detalhes</span>
                    </Button>
                  </div>
                </Link>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </>
  )
}
