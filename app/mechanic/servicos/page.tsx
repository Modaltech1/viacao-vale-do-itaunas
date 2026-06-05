'use client'

import { Card, CardContent } from '@prodexy/ui'
import { ClipboardList, Repeat, Wrench } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { FilterInput, FilterSelect } from '@/components/shared/filters'
import { MetricCard } from '@/components/shared/metric-card'
import { number } from '@/lib/format'
import { services } from '@/lib/mock-data'

export default function MechanicServicesPage() {
  const recurringServices = services.filter((service) => service.periodicityType !== 'none')

  return (
    <>
      <PageHeader
        title="Serviços"
        description="Catálogo operacional usado no registro de manutenções e na geração de pendências."
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total" value={services.length} icon={ClipboardList} />
        <MetricCard title="Preventivos" value={services.filter((service) => service.suggestedMaintenanceType === 'preventiva').length} tone="success" />
        <MetricCard title="Corretivos" value={services.filter((service) => service.suggestedMaintenanceType === 'corretiva').length} icon={Wrench} tone="warning" />
        <MetricCard title="Recorrentes" value={recurringServices.length} icon={Repeat} />
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_220px_220px]">
            <FilterInput placeholder="Buscar serviço..." />
            <FilterSelect>
              <option>Todas as categorias</option>
              <option>Óleo</option>
              <option>Pneus</option>
              <option>Freios</option>
              <option>Motor</option>
            </FilterSelect>
            <FilterSelect>
              <option>Todos os tipos</option>
              <option>Preventiva</option>
              <option>Corretiva</option>
            </FilterSelect>
          </div>

          <div className="space-y-3">
            {services.map((service) => (
              <div
                key={service.id}
                className="flex flex-col gap-3 rounded-xl border p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-semibold">{service.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {service.category} - {service.suggestedMaintenanceType}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">{service.description}</p>
                </div>

                <div className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                  {periodicityLabel(service.periodicityType, service.periodicityKm, service.periodicityDays)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  )
}

function periodicityLabel(type: string, km?: number, days?: number) {
  if (type === 'km') return `${number(km ?? 0)} km`
  if (type === 'time') return `${days ?? 0} dias`
  return 'Sem recorrência'
}
