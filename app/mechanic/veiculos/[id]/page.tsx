'use client'

import { use } from 'react'
import { notFound } from 'next/navigation'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@prodexy/ui'
import { AlertTriangle, CalendarClock, Gauge, Wrench } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { MetricCard } from '@/components/shared/metric-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { date, number } from '@/lib/format'
import { getService, getVehicle, vehicleMaintenances, vehiclePendings, vehicleSchedules } from '@/lib/selectors'

export default function MechanicVehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const vehicle = getVehicle(id)

  if (!vehicle) notFound()

  const maintenances = vehicleMaintenances(vehicle.id)
  const pendings = vehiclePendings(vehicle.id)
  const schedules = vehicleSchedules(vehicle.id)

  return (
    <>
      <PageHeader
        title={vehicle.plate}
        description={`${vehicle.brand} ${vehicle.model} - ${vehicle.type} - KM ${number(vehicle.currentKm)}`}
      >
        <Button>
          <Wrench className="mr-2 size-4" />
          Registrar manutenção
        </Button>
      </PageHeader>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="KM atual" value={number(vehicle.currentKm)} icon={Gauge} />
        <MetricCard title="Status" value={vehicle.status.replace('_', ' ')} tone={vehicle.status === 'ativo' ? 'success' : 'warning'} />
        <MetricCard title="Pendências" value={pendings.length} icon={AlertTriangle} tone={pendings.length ? 'danger' : 'success'} />
        <MetricCard title="Programados" value={schedules.length} icon={CalendarClock} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Alertas</CardTitle>
          </CardHeader>
          <CardContent className="divide-y px-0">
            {pendings.map((item) => (
              <div key={item.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{item.title}</p>
                  <StatusBadge type="severity" value={item.severity} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {item.dueKm ? `Vence em ${number(item.dueKm)} km` : null}
                  {item.dueDate ? `Data ${date(item.dueDate)}` : null}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Serviços Programados</CardTitle>
          </CardHeader>
          <CardContent className="divide-y px-0">
            {schedules.map((item) => {
              const service = getService(item.serviceId)

              return (
                <div key={item.id} className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{service?.name}</p>
                    <StatusBadge type="document" value={item.status} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{service?.category}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Próximo: {item.nextDueKm ? `${number(item.nextDueKm)} km` : date(item.nextDueAt)}
                  </p>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Histórico de Manutenções</CardTitle>
          </CardHeader>
          <CardContent className="divide-y px-0">
            {maintenances.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{item.cause}</p>
                    <StatusBadge type="maintenance" value={item.status} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.maintenanceType} - {date(item.date)} - KM {number(item.currentKm)}
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  Ver registro
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
