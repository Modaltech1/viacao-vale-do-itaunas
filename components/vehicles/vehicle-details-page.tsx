'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@prodexy/ui'
import { CalendarClock, DollarSign, Edit3, Fuel, Gauge, Plus, TriangleAlert, Users } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { MetricCard } from '@/components/shared/metric-card'
import { Section } from '@/components/shared/section'
import { StatusBadge } from '@/components/shared/status-badge'
import { TableDetailsButton } from '@/components/shared/table-details-button'
import { TablePagination, useTablePagination } from '@/components/shared/table-pagination'
import { VehicleDialog, VehicleDriversDialog } from '@/components/vehicles/vehicle-dialog'
import { VehicleVideotelemetry } from '@/components/vehicles/vehicle-videotelemetry'
import { brl, dateTime, number } from '@/lib/format'
import { formatKm } from '@/lib/km'
import { vehicleStatusLabel } from '@/lib/status'
import { sinisterStatusLabel, sinisterTypeLabel } from '@/types/sinister'
import type { VehicleDetails, VehicleFormOptions } from '@/types/vehicle'

const emptyOptions: VehicleFormOptions = { routes: [], drivers: [], documentTypes: [] }

function formatDateOnly(value?: string | null) {
  if (!value) return 'Não informado'
  return new Intl.DateTimeFormat('pt-BR').format(new Date(`${value}T00:00:00`))
}

function EmptyTableRow({ columns, children }: { columns: number; children: React.ReactNode }) {
  return (
    <TableRow>
      <TableCell colSpan={columns} className="h-24 text-center text-muted-foreground">
        {children}
      </TableCell>
    </TableRow>
  )
}

type VehicleDetailsPageProps = {
  vehicleId: string
  mode?: 'admin' | 'mechanic'
}

export function VehicleDetailsPage({ vehicleId, mode = 'admin' }: VehicleDetailsPageProps) {
  const [vehicle, setVehicle] = useState<VehicleDetails | null>(null)
  const [options, setOptions] = useState<VehicleFormOptions>(emptyOptions)
  const [editOpen, setEditOpen] = useState(false)
  const [driversOpen, setDriversOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const isAdmin = mode === 'admin'
  const basePath = isAdmin ? '/admin/veiculos' : '/mechanic/veiculos'

  const loadVehicle = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/${mode}/veiculos/${vehicleId}`, { cache: 'no-store' })
      const result = await response.json()

      if (!response.ok) throw new Error(result.error || 'Não foi possível carregar o veículo.')

      setVehicle(result.vehicle)
      if (isAdmin) setOptions(result.options ?? emptyOptions)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar o veículo.')
    } finally {
      setLoading(false)
    }
  }, [isAdmin, mode, vehicleId])

  useEffect(() => {
    void loadVehicle()
  }, [loadVehicle])

  const tripPagination = useTablePagination(vehicle?.trips ?? [])
  const refuelingPagination = useTablePagination(vehicle?.refuelings ?? [])
  const maintenancePagination = useTablePagination(vehicle?.maintenances ?? [])
  const sinisterPagination = useTablePagination(vehicle?.sinisters ?? [])
  const servicePagination = useTablePagination(vehicle?.serviceSchedules ?? [])

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Carregando veículo...
        </CardContent>
      </Card>
    )
  }

  if (error || !vehicle) {
    return (
      <Card>
        <CardContent className="space-y-4 p-8 text-center">
          <p className="text-destructive">{error || 'Veículo não encontrado.'}</p>
          <Button variant="outline" asChild>
            <Link href={basePath}>Voltar para veículos</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  const criticalPendings = vehicle.pendings.filter((pending) => pending.severity === 'critica').length

  return (
    <>
      <PageHeader
        title={`${vehicle.fleetCode} · ${vehicle.brand} ${vehicle.model}`}
        description={isAdmin
          ? 'Dados do ativo, vínculos, documentos e histórico operacional consolidado.'
          : 'Visão técnica consolidada do veículo, seus vencimentos, serviços e manutenções.'}
        backHref={basePath}
        backLabel="Voltar para veículos"
      >
        {isAdmin ? (
          <>
            <Button variant="outline" className="gap-2" onClick={() => setEditOpen(true)}>
              <Edit3 className="size-4" />
              Editar veículo
            </Button>
            <Button className="gap-2" onClick={() => setDriversOpen(true)}>
              <Users className="size-4" />
              Gerenciar motoristas
            </Button>
          </>
        ) : null}
      </PageHeader>

      <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="KM atual" value={formatKm(vehicle.currentKm)} icon={Gauge} />
        {isAdmin ? (
          <>
            <MetricCard
              title="Consumo médio"
              value={vehicle.averageConsumption == null ? 'Sem dados' : `${formatKm(vehicle.averageConsumption, 2)} km/L`}
              icon={Fuel}
            />
            <MetricCard
              title="Custo total"
              value={brl(vehicle.totalOperationalCost)}
              icon={DollarSign}
              tone="danger"
            />
          </>
        ) : (
          <>
            <MetricCard
              title="Status"
              value={vehicleStatusLabel[vehicle.status]}
              tone={vehicle.status === 'ativo' ? 'success' : 'warning'}
            />
            <MetricCard
              title="Serviços programados"
              value={vehicle.serviceSchedules.length}
              icon={CalendarClock}
            />
          </>
        )}
        <MetricCard
          title="Pendências"
          value={vehicle.pendings.length}
          subtitle={criticalPendings ? `${criticalPendings} críticas` : 'Nenhuma crítica'}
          icon={TriangleAlert}
          tone={criticalPendings ? 'danger' : vehicle.pendings.length ? 'warning' : 'success'}
        />
      </div>

      <Tabs defaultValue="resumo" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          {isAdmin ? <TabsTrigger value="viagens">Viagens</TabsTrigger> : null}
          {isAdmin ? <TabsTrigger value="abastecimentos">Abastecimentos</TabsTrigger> : null}
          <TabsTrigger value="manutencoes">Manutenções</TabsTrigger>
          {isAdmin ? <TabsTrigger value="sinistros">Sinistros</TabsTrigger> : null}
          <TabsTrigger value="servicos">Serviços e pneus</TabsTrigger>
          <TabsTrigger value="pendencias">Pendências</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo">
          <div className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Dados do veículo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p><b>Tipo:</b> {vehicle.type}</p>
                  <p><b>Frota:</b> {vehicle.fleetCode}</p>
                  <p><b>Placa:</b> {vehicle.plate}</p>
                  <p><b>Ano:</b> {vehicle.year ?? 'Não informado'}</p>
                  <p><b>Capacidade:</b> {vehicle.capacity || 'Não informada'}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <b>Status:</b>
                    <StatusBadge type="vehicle" value={vehicle.status} />
                  </div>
                  {isAdmin ? (
                    <div className="border-t pt-3">
                      <p className="mb-2 font-semibold">Motoristas vinculados</p>
                      {vehicle.drivers.length ? (
                        <div className="space-y-2">
                          {vehicle.drivers.map((driver) => (
                            <div key={driver.id} className="flex flex-wrap items-center justify-between gap-2">
                              <Link className="text-primary" href={`/admin/motoristas/${driver.id}`}>
                                {driver.name}
                              </Link>
                              {driver.principal
                                ? <StatusBadge type="raw" value="ativo" label="Principal" />
                                : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">Nenhum motorista vinculado.</p>
                      )}
                    </div>
                  ) : null}
                  {vehicle.notes ? <p className="border-t pt-3"><b>Observações:</b> {vehicle.notes}</p> : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Rota fixa do veículo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {vehicle.route ? (
                    <>
                      <p className="text-lg font-semibold">
                        {vehicle.route.origin} → {vehicle.route.destination}
                      </p>
                      <p><b>Nome:</b> {vehicle.route.name}</p>
                      <p>
                        <b>KM estimado:</b>{' '}
                        {vehicle.route.estimatedKm == null
                          ? 'Não informado'
                          : `${formatKm(vehicle.route.estimatedKm)} km`}
                      </p>
                      {vehicle.route.notes ? <p><b>Observações:</b> {vehicle.route.notes}</p> : null}
                      <p className="text-muted-foreground">
                        A viagem mantém um snapshot da rota, preservando o histórico mesmo após alterações.
                      </p>
                    </>
                  ) : (
                    <p className="text-muted-foreground">Nenhuma rota fixa configurada.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Vencimentos</CardTitle>
                </CardHeader>
                <CardContent className="divide-y text-sm">
                  {vehicle.documents.length ? vehicle.documents.map((document) => (
                    <div key={document.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <span>
                        <span className="block font-medium">{document.name}</span>
                        <span className="text-muted-foreground">{formatDateOnly(document.dueDate)}</span>
                      </span>
                      <StatusBadge type="document" value={document.status} />
                    </div>
                  )) : (
                    <p className="py-3 text-muted-foreground">Nenhum documento ativo para este veículo.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {isAdmin ? <VehicleVideotelemetry vehicleId={vehicle.id} /> : null}
          </div>
        </TabsContent>

        {isAdmin ? (
          <TabsContent value="viagens">
            <Section title="Viagens do veículo">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rota</TableHead>
                  <TableHead>Motorista</TableHead>
                  <TableHead>Saída</TableHead>
                  <TableHead>Chegada</TableHead>
                  <TableHead>KM inicial/final</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicle.trips.length ? tripPagination.pageItems.map((trip) => (
                  <TableRow key={trip.id}>
                    <TableCell>{trip.origin} → {trip.destination}</TableCell>
                    <TableCell>{trip.driverName}</TableCell>
                    <TableCell>{dateTime(trip.startedAt)}</TableCell>
                    <TableCell>{dateTime(trip.finishedAt ?? undefined)}</TableCell>
                    <TableCell>
                      {formatKm(trip.initialKm)} / {trip.finalKm == null ? '—' : formatKm(trip.finalKm)}
                    </TableCell>
                    <TableCell><StatusBadge type="trip" value={trip.status} /></TableCell>
                    <TableCell className="text-right">
                      <TableDetailsButton href={`/admin/viagens/${trip.id}`} />
                    </TableCell>
                  </TableRow>
                )) : (
                  <EmptyTableRow columns={7}>Nenhuma viagem registrada para este veículo.</EmptyTableRow>
                )}
              </TableBody>
            </Table>
            <TablePagination {...tripPagination} />
            </Section>
          </TabsContent>
        ) : null}

        {isAdmin ? (
          <TabsContent value="abastecimentos">
            <Section title="Abastecimentos">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>KM</TableHead>
                  <TableHead>Combustível</TableHead>
                  <TableHead>Litros</TableHead>
                  <TableHead>Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicle.refuelings.length ? refuelingPagination.pageItems.map((refueling) => (
                  <TableRow key={refueling.id}>
                    <TableCell>{dateTime(refueling.registeredAt)}</TableCell>
                    <TableCell>{formatKm(refueling.registeredKm)}</TableCell>
                    <TableCell>{refueling.fuelType}</TableCell>
                    <TableCell>{number(refueling.liters, 1)}</TableCell>
                    <TableCell>
                      {refueling.totalValue == null ? '—' : brl(refueling.totalValue)}
                    </TableCell>
                  </TableRow>
                )) : (
                  <EmptyTableRow columns={5}>Nenhum abastecimento registrado para este veículo.</EmptyTableRow>
                )}
              </TableBody>
            </Table>
            <TablePagination {...refuelingPagination} />
            </Section>
          </TabsContent>
        ) : null}

        <TabsContent value="manutencoes">
          <Section title="Manutenções">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Causa</TableHead>
                  <TableHead>Serviços</TableHead>
                  <TableHead>Mecânico</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin ? <TableHead /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicle.maintenances.length ? maintenancePagination.pageItems.map((maintenance) => (
                  <TableRow key={maintenance.id}>
                    <TableCell>{dateTime(maintenance.openedAt)}</TableCell>
                    <TableCell>
                      {maintenance.maintenanceType === 'preventiva' ? 'Preventiva' : 'Corretiva'}
                    </TableCell>
                    <TableCell>{maintenance.cause || 'Não informada'}</TableCell>
                    <TableCell>{maintenance.services.join(', ') || 'Sem itens'}</TableCell>
                    <TableCell>{maintenance.mechanicName}</TableCell>
                    <TableCell>{brl(maintenance.value)}</TableCell>
                    <TableCell><StatusBadge type="maintenance" value={maintenance.status} /></TableCell>
                    {isAdmin ? (
                      <TableCell className="text-right">
                        <TableDetailsButton href={`/admin/manutencoes/${maintenance.id}`} />
                      </TableCell>
                    ) : null}
                  </TableRow>
                )) : (
                  <EmptyTableRow columns={isAdmin ? 8 : 7}>
                    Nenhuma manutenção registrada para este veículo.
                  </EmptyTableRow>
                )}
              </TableBody>
            </Table>
            <TablePagination {...maintenancePagination} />
          </Section>
        </TabsContent>

        {isAdmin ? (
          <TabsContent value="sinistros">
            <Section
              title="Sinistros do veículo"
              description="Avarias, acidentes e ocorrências operacionais registradas para este ativo."
              action={(
                <Button size="sm" className="gap-2" asChild>
                  <Link href={`/admin/sinistros?newSinister=1&vehicleId=${vehicle.id}`}>
                    <Plus className="size-4" />
                    Novo sinistro
                  </Link>
                </Button>
              )}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Motorista</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehicle.sinisters.length ? sinisterPagination.pageItems.map((sinister) => (
                    <TableRow key={sinister.id}>
                      <TableCell className="whitespace-nowrap">{dateTime(sinister.occurredAt)}</TableCell>
                      <TableCell>
                        <p>{sinisterTypeLabel[sinister.type]}</p>
                        <StatusBadge type="severity" value={sinister.severity} />
                      </TableCell>
                      <TableCell className="max-w-[360px]">
                        <p className="truncate font-medium" title={sinister.description}>
                          {sinister.description}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {sinister.location || 'Sem local informado'}
                        </p>
                      </TableCell>
                      <TableCell className="max-w-[220px]">
                        <p className="truncate" title={sinister.driverName}>{sinister.driverName}</p>
                      </TableCell>
                      <TableCell className="font-medium">{brl(sinister.totalCost)}</TableCell>
                      <TableCell>
                        <StatusBadge
                          type="raw"
                          value={sinister.status}
                          label={sinisterStatusLabel[sinister.status]}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <TableDetailsButton href={`/admin/sinistros/${sinister.id}`} />
                      </TableCell>
                    </TableRow>
                  )) : (
                    <EmptyTableRow columns={7}>Nenhum sinistro registrado para este veículo.</EmptyTableRow>
                  )}
                </TableBody>
              </Table>
              <TablePagination {...sinisterPagination} />
            </Section>
          </TabsContent>
        ) : null}

        <TabsContent value="servicos">
          <Section
            title="Serviços programados"
            description="Óleo e pneus são categorias do catálogo de serviços e seguem a mesma programação."
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Serviço</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Último registro</TableHead>
                  <TableHead>Próximo vencimento</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicle.serviceSchedules.length ? servicePagination.pageItems.map((schedule) => (
                  <TableRow key={schedule.id}>
                    <TableCell className="font-semibold">{schedule.serviceName}</TableCell>
                    <TableCell>{schedule.category}</TableCell>
                    <TableCell>
                      {schedule.lastDoneKm != null
                        ? `${formatKm(schedule.lastDoneKm)} km`
                        : formatDateOnly(schedule.lastDoneAt)}
                    </TableCell>
                    <TableCell>
                      {schedule.nextDueKm != null
                        ? `${formatKm(schedule.nextDueKm)} km`
                        : formatDateOnly(schedule.nextDueAt)}
                    </TableCell>
                    <TableCell>
                      {schedule.status === 'inativo'
                        ? <StatusBadge type="raw" value="inativo" label="Inativo" />
                        : <StatusBadge type="document" value={schedule.status} />}
                    </TableCell>
                  </TableRow>
                )) : (
                  <EmptyTableRow columns={5}>Nenhum serviço programado para este veículo.</EmptyTableRow>
                )}
              </TableBody>
            </Table>
            <TablePagination {...servicePagination} />
          </Section>
        </TabsContent>

        <TabsContent value="pendencias">
          <Section title="Pendências do veículo">
            {vehicle.pendings.length ? (
              <div className="divide-y">
                {vehicle.pendings.map((pending) => (
                  <div
                    key={pending.id}
                    className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <p className="font-semibold">{pending.title}</p>
                      <p className="text-sm text-muted-foreground">{pending.description}</p>
                      {pending.dueDate || pending.dueKm != null ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {pending.dueDate ? `Vencimento: ${formatDateOnly(pending.dueDate)}` : ''}
                          {pending.dueDate && pending.dueKm != null ? ' · ' : ''}
                          {pending.dueKm != null ? `Vencimento: ${formatKm(pending.dueKm)} km` : ''}
                        </p>
                      ) : null}
                    </div>
                    <StatusBadge type="severity" value={pending.severity} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhuma pendência aberta para este veículo.
              </p>
            )}
          </Section>
        </TabsContent>
      </Tabs>

      {isAdmin ? (
        <>
          <VehicleDialog
            open={editOpen}
            onOpenChange={setEditOpen}
            vehicle={vehicle}
            options={options}
            onSaved={loadVehicle}
          />
          <VehicleDriversDialog
            open={driversOpen}
            onOpenChange={setDriversOpen}
            vehicle={vehicle}
            drivers={options.drivers}
            onSaved={loadVehicle}
          />
        </>
      ) : null}
    </>
  )
}
