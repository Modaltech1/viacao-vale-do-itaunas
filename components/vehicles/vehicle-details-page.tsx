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
import { DollarSign, Edit3, Fuel, Gauge, TriangleAlert, Users } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { MetricCard } from '@/components/shared/metric-card'
import { Section } from '@/components/shared/section'
import { StatusBadge } from '@/components/shared/status-badge'
import { VehicleDialog, VehicleDriversDialog } from '@/components/vehicles/vehicle-dialog'
import { brl, dateTime, number } from '@/lib/format'
import type { VehicleDetails, VehicleFormOptions } from '@/types/vehicle'

const emptyOptions: VehicleFormOptions = { routes: [], drivers: [] }

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

export function VehicleDetailsPage({ vehicleId }: { vehicleId: string }) {
  const [vehicle, setVehicle] = useState<VehicleDetails | null>(null)
  const [options, setOptions] = useState<VehicleFormOptions>(emptyOptions)
  const [editOpen, setEditOpen] = useState(false)
  const [driversOpen, setDriversOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadVehicle = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/admin/veiculos/${vehicleId}`, { cache: 'no-store' })
      const result = await response.json()

      if (!response.ok) throw new Error(result.error || 'Não foi possível carregar o veículo.')

      setVehicle(result.vehicle)
      setOptions(result.options ?? emptyOptions)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar o veículo.')
    } finally {
      setLoading(false)
    }
  }, [vehicleId])

  useEffect(() => {
    void loadVehicle()
  }, [loadVehicle])

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
            <Link href="/admin/veiculos">Voltar para veículos</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  const criticalPendings = vehicle.pendings.filter((pending) => pending.severity === 'critica').length

  return (
    <>
      <PageHeader
        title={`${vehicle.plate} · ${vehicle.brand} ${vehicle.model}`}
        description="Dados do ativo, vínculos, documentos e histórico operacional consolidado."
      >
        <Button variant="outline" className="gap-2" onClick={() => setEditOpen(true)}>
          <Edit3 className="size-4" />
          Editar veículo
        </Button>
        <Button className="gap-2" onClick={() => setDriversOpen(true)}>
          <Users className="size-4" />
          Gerenciar motoristas
        </Button>
      </PageHeader>

      <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="KM atual" value={number(vehicle.currentKm)} icon={Gauge} />
        <MetricCard
          title="Consumo médio"
          value={vehicle.averageConsumption == null ? 'Sem dados' : `${number(vehicle.averageConsumption, 2)} km/L`}
          icon={Fuel}
        />
        <MetricCard
          title="Custo total"
          value={brl(vehicle.totalOperationalCost)}
          icon={DollarSign}
          tone="danger"
        />
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
          <TabsTrigger value="viagens">Viagens</TabsTrigger>
          <TabsTrigger value="abastecimentos">Abastecimentos</TabsTrigger>
          <TabsTrigger value="manutencoes">Manutenções</TabsTrigger>
          <TabsTrigger value="servicos">Serviços e pneus</TabsTrigger>
          <TabsTrigger value="pendencias">Pendências</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo">
          <div className="grid gap-4 xl:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Dados do veículo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p><b>Tipo:</b> {vehicle.type}</p>
                <p><b>Ano:</b> {vehicle.year ?? 'Não informado'}</p>
                <p><b>Capacidade:</b> {vehicle.capacity || 'Não informada'}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <b>Status:</b>
                  <StatusBadge type="vehicle" value={vehicle.status} />
                </div>
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
                        : `${number(vehicle.route.estimatedKm)} km`}
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
                {(['documentacao', 'tacografo', 'ceturb'] as const).map((code) => {
                  const document = vehicle.documents.find((item) => item.code === code)
                  const fallbackLabel = code === 'documentacao'
                    ? 'Documentação / CRLV'
                    : code === 'tacografo'
                      ? 'Tacógrafo'
                      : 'CETURB'

                  return (
                    <div key={code} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <span>
                        <span className="block font-medium">{document?.name ?? fallbackLabel}</span>
                        <span className="text-muted-foreground">{formatDateOnly(document?.dueDate)}</span>
                      </span>
                      {document
                        ? <StatusBadge type="document" value={document.status} />
                        : <span className="text-muted-foreground">Não cadastrado</span>}
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

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
                {vehicle.trips.length ? vehicle.trips.map((trip) => (
                  <TableRow key={trip.id}>
                    <TableCell>{trip.origin} → {trip.destination}</TableCell>
                    <TableCell>{trip.driverName}</TableCell>
                    <TableCell>{dateTime(trip.startedAt)}</TableCell>
                    <TableCell>{dateTime(trip.finishedAt ?? undefined)}</TableCell>
                    <TableCell>
                      {number(trip.initialKm)} / {trip.finalKm == null ? '—' : number(trip.finalKm)}
                    </TableCell>
                    <TableCell><StatusBadge type="trip" value={trip.status} /></TableCell>
                    <TableCell className="text-right">
                      <Button variant="link" asChild>
                        <Link href={`/admin/viagens/${trip.id}`}>Detalhes →</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                )) : (
                  <EmptyTableRow columns={7}>Nenhuma viagem registrada para este veículo.</EmptyTableRow>
                )}
              </TableBody>
            </Table>
          </Section>
        </TabsContent>

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
                {vehicle.refuelings.length ? vehicle.refuelings.map((refueling) => (
                  <TableRow key={refueling.id}>
                    <TableCell>{dateTime(refueling.registeredAt)}</TableCell>
                    <TableCell>{number(refueling.registeredKm)}</TableCell>
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
          </Section>
        </TabsContent>

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
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicle.maintenances.length ? vehicle.maintenances.map((maintenance) => (
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
                    <TableCell className="text-right">
                      <Button variant="link" asChild>
                        <Link href={`/admin/manutencoes/${maintenance.id}`}>Detalhes →</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                )) : (
                  <EmptyTableRow columns={8}>Nenhuma manutenção registrada para este veículo.</EmptyTableRow>
                )}
              </TableBody>
            </Table>
          </Section>
        </TabsContent>

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
                {vehicle.serviceSchedules.length ? vehicle.serviceSchedules.map((schedule) => (
                  <TableRow key={schedule.id}>
                    <TableCell className="font-semibold">{schedule.serviceName}</TableCell>
                    <TableCell>{schedule.category}</TableCell>
                    <TableCell>
                      {schedule.lastDoneKm != null
                        ? `${number(schedule.lastDoneKm)} km`
                        : formatDateOnly(schedule.lastDoneAt)}
                    </TableCell>
                    <TableCell>
                      {schedule.nextDueKm != null
                        ? `${number(schedule.nextDueKm)} km`
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
                          {pending.dueKm != null ? `Vencimento: ${number(pending.dueKm)} km` : ''}
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
  )
}
