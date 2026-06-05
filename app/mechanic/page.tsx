'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  Button,
  Card,
  CardContent,
  Checkbox,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
} from '@prodexy/ui'
import { ClipboardList, Plus, Wrench } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { FilterInput, FilterSelect } from '@/components/shared/filters'
import { MetricCard } from '@/components/shared/metric-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { brl, date, number } from '@/lib/format'
import { maintenances, mechanics, pendingItems, services, vehicles } from '@/lib/mock-data'
import { getMechanic, getService, getVehicle } from '@/lib/selectors'

export default function MechanicHomePage() {
  const [open, setOpen] = useState(false)

  const activeMaintenances = maintenances.filter((item) => item.status === 'aberta' || item.status === 'em_andamento')
  const inProgress = maintenances.filter((item) => item.status === 'em_andamento')
  const criticalPendings = pendingItems.filter((item) => item.severity === 'critica')

  return (
    <>
      <PageHeader
        title="Manutenções"
        description="Execução operacional de serviços, correções e alertas da frota."
      >
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 size-4" />
          Registrar manutenção
        </Button>
      </PageHeader>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Abertas" value={activeMaintenances.length} icon={Wrench} tone="warning" />
        <MetricCard title="Em andamento" value={inProgress.length} icon={ClipboardList} tone="blue" />
        <MetricCard title="Pendências críticas" value={criticalPendings.length} tone="danger" />
        <MetricCard title="Veículos monitorados" value={vehicles.length} />
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <FilterInput placeholder="Buscar por placa, modelo ou causa..." />
            <FilterSelect defaultValue="abertas">
              <option value="abertas">Abertas e em andamento</option>
              <option value="todas">Todas</option>
              <option value="corretivas">Corretivas</option>
              <option value="preventivas">Preventivas</option>
            </FilterSelect>
          </div>

          <div className="space-y-3">
            {activeMaintenances.map((item) => {
              const vehicle = getVehicle(item.vehicleId)
              const mechanic = getMechanic(item.mechanicId)
              const serviceNames = item.serviceIds
                .map((id) => getService(id)?.name)
                .filter(Boolean)
                .join(', ')

              return (
                <Link
                  key={item.id}
                  href={`/admin/manutencoes/${item.id}`}
                  className="flex flex-col gap-3 rounded-xl border p-4 transition-colors hover:bg-muted/60 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">
                        {vehicle?.plate} - {vehicle?.brand} {vehicle?.model}
                      </p>
                      <StatusBadge type="maintenance" value={item.status} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{item.cause}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {serviceNames} - {item.maintenanceType} - {date(item.date)} - KM {number(item.currentKm)}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col gap-1 text-sm md:items-end">
                    <span className="font-semibold">{brl(item.value)}</span>
                    <span className="text-muted-foreground">{mechanic?.name}</span>
                  </div>
                </Link>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[86vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova manutenção</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Veículo</Label>
              <FilterSelect>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id}>
                    {vehicle.plate} - {vehicle.brand} {vehicle.model}
                  </option>
                ))}
              </FilterSelect>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline">Preventiva</Button>
              <Button variant="outline">Corretiva</Button>
            </div>

            <div className="space-y-2">
              <Label>Serviços realizados</Label>
              <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-3">
                {services.slice(0, 8).map((service) => (
                  <label key={service.id} className="flex items-center gap-2 text-sm">
                    <Checkbox />
                    {service.name}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Causa / descrição</Label>
              <Textarea />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Data" />
              <Field label="KM atual" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Mecânico</Label>
                <FilterSelect>
                  {mechanics.map((mechanic) => (
                    <option key={mechanic.id}>{mechanic.name}</option>
                  ))}
                </FilterSelect>
              </div>
              <Field label="Valor (R$)" />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <FilterSelect>
                <option>Aberta</option>
                <option>Em andamento</option>
                <option>Concluída</option>
              </FilterSelect>
            </div>

            <Button className="w-full" onClick={() => setOpen(false)}>
              Registrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function Field({ label }: { label: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input />
    </div>
  )
}
