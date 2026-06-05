'use client'

import Link from 'next/link'
import { use } from 'react'
import { notFound } from 'next/navigation'
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
import { PageHeader } from '@/components/layout/page-header'
import { MetricCard } from '@/components/shared/metric-card'
import { Section } from '@/components/shared/section'
import { StatusBadge } from '@/components/shared/status-badge'
import { brl, date, dateTime, number } from '@/lib/format'
import { services } from '@/lib/mock-data'
import {
  getRoute,
  getService,
  getVehicle,
  vehicleDrivers,
  vehicleExpenses,
  vehicleMaintenances,
  vehiclePendings,
  vehicleRefuelings,
  vehicleSchedules,
  vehicleTrips,
} from '@/lib/selectors'
import { vehicleConsumption, vehicleTotalCost } from '@/lib/calculations'

export default function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const vehicle = getVehicle(id)

  if (!vehicle) notFound()

  const route = getRoute(vehicle.routeId)
  const assignedDrivers = vehicleDrivers(vehicle.id)
  const trips = vehicleTrips(vehicle.id)
  const refuelings = vehicleRefuelings(vehicle.id)
  const expenses = vehicleExpenses(vehicle.id)
  const maintenances = vehicleMaintenances(vehicle.id)
  const pendings = vehiclePendings(vehicle.id)
  const schedules = vehicleSchedules(vehicle.id)

  return (
    <>
      <PageHeader
        title={`${vehicle.plate} — ${vehicle.brand} ${vehicle.model}`}
        description="Detalhes do veículo: métricas próprias, rota fixa, consumo, manutenção, pneus, óleo e pendências."
      >
        <Button variant="outline">Editar veículo</Button>
        <Button>Gerenciar motoristas</Button>
      </PageHeader>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="KM atual" value={number(vehicle.currentKm)} />
        <MetricCard title="Consumo médio" value={`${number(vehicleConsumption(vehicle.id) || vehicle.averageConsumption, 2)} km/L`} />
        <MetricCard title="Custo total" value={brl(vehicleTotalCost(vehicle.id))} tone="danger" />
        <MetricCard title="Pendências" value={pendings.length} tone={pendings.some((pending) => pending.severity === 'critica') ? 'danger' : 'warning'} />
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
              <CardContent className="space-y-2 text-sm">
                <p><b>Tipo:</b> {vehicle.type}</p>
                <p><b>Ano:</b> {vehicle.year}</p>
                <p><b>Capacidade:</b> {vehicle.capacity}</p>
                <p><b>Status:</b> <StatusBadge type="vehicle" value={vehicle.status} /></p>
                <div className="flex flex-wrap gap-1">
                  <b>Motoristas:</b>
                  {assignedDrivers.length ? (
                    assignedDrivers.map((driver, index) => (
                      <span key={driver.id}>
                        <Link className="text-primary" href={`/admin/motoristas/${driver.id}`}>
                          {driver.name}
                        </Link>
                        {index < assignedDrivers.length - 1 ? ', ' : null}
                      </span>
                    ))
                  ) : (
                    <span>Sem motorista</span>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Rota fixa do veículo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-lg font-semibold">{route?.origin} → {route?.destination}</p>
                <p><b>Nome:</b> {route?.name}</p>
                <p><b>KM estimado:</b> {number(route?.estimatedKm ?? 0)} km</p>
                <p className="text-muted-foreground">
                  A rota é configurada no cadastro do veículo e usada como referência nas viagens.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Vencimentos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span>Documentação {date(vehicle.documentationDueDate)}</span>
                  <StatusBadge type="document" value={vehicle.documentationStatus} />
                </div>
                <div className="flex justify-between gap-3">
                  <span>Tacógrafo {date(vehicle.tachographDueDate)}</span>
                  <StatusBadge type="document" value={vehicle.tachographStatus} />
                </div>
                <div className="flex justify-between gap-3">
                  <span>CETURB {date(vehicle.ceturbDueDate)}</span>
                  <StatusBadge type="document" value={vehicle.ceturbStatus} />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="viagens">
          <VehicleTripsTable trips={trips} />
        </TabsContent>

        <TabsContent value="abastecimentos">
          <VehicleRefuelingsTable refuelings={refuelings} />
        </TabsContent>

        <TabsContent value="manutencoes">
          <VehicleMaintenancesTable maintenances={maintenances} />
        </TabsContent>

        <TabsContent value="servicos">
          <Section title="Serviços programados" description="Óleo e pneus aparecem aqui como serviços/categorias, não como módulos soltos.">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Serviço</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Último</TableHead>
                  <TableHead>Próximo</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((schedule) => {
                  const service = getService(schedule.serviceId)

                  return (
                    <TableRow key={schedule.id}>
                      <TableCell className="font-semibold">{service?.name}</TableCell>
                      <TableCell>{service?.category}</TableCell>
                      <TableCell>{schedule.lastDoneKm ? `${number(schedule.lastDoneKm)} km` : date(schedule.lastDoneAt)}</TableCell>
                      <TableCell>{schedule.nextDueKm ? `${number(schedule.nextDueKm)} km` : date(schedule.nextDueAt)}</TableCell>
                      <TableCell><StatusBadge type="document" value={schedule.status} /></TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Section>
        </TabsContent>

        <TabsContent value="pendencias">
          <Section title="Pendências do veículo">
            <div className="space-y-3">
              {pendings.map((item) => (
                <div key={item.id} className="flex flex-col gap-3 rounded-xl border p-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-semibold">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                  <StatusBadge type="severity" value={item.severity} />
                </div>
              ))}
            </div>
          </Section>
        </TabsContent>
      </Tabs>
    </>
  )
}

function VehicleTripsTable({ trips }: { trips: ReturnType<typeof vehicleTrips> }) {
  return (
    <Section title="Viagens do veículo">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Rota</TableHead>
            <TableHead>Saída</TableHead>
            <TableHead>Chegada</TableHead>
            <TableHead>KM inicial</TableHead>
            <TableHead>KM final</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {trips.map((trip) => (
            <TableRow key={trip.id}>
              <TableCell>{trip.origin} → {trip.destination}</TableCell>
              <TableCell>{dateTime(trip.startedAt)}</TableCell>
              <TableCell>{dateTime(trip.finishedAt)}</TableCell>
              <TableCell>{number(trip.initialKm)}</TableCell>
              <TableCell>{trip.finalKm ? number(trip.finalKm) : '—'}</TableCell>
              <TableCell><StatusBadge type="trip" value={trip.status} /></TableCell>
              <TableCell>
                <Button variant="link" asChild>
                  <Link href={`/admin/viagens/${trip.id}`}>Detalhes →</Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Section>
  )
}

function VehicleRefuelingsTable({ refuelings }: { refuelings: ReturnType<typeof vehicleRefuelings> }) {
  return (
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
          {refuelings.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{dateTime(item.date)}</TableCell>
              <TableCell>{number(item.currentKm)}</TableCell>
              <TableCell>{item.fuelType}</TableCell>
              <TableCell>{number(item.liters)}</TableCell>
              <TableCell>{brl(item.totalValue ?? 0)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Section>
  )
}

function VehicleMaintenancesTable({ maintenances }: { maintenances: ReturnType<typeof vehicleMaintenances> }) {
  return (
    <Section title="Manutenções">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Serviços</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {maintenances.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{date(item.date)}</TableCell>
              <TableCell>{item.maintenanceType}</TableCell>
              <TableCell>{item.serviceIds.map((id) => services.find((service) => service.id === id)?.name).join(', ')}</TableCell>
              <TableCell>{brl(item.value)}</TableCell>
              <TableCell><StatusBadge type="maintenance" value={item.status} /></TableCell>
              <TableCell>
                <Button variant="link" asChild>
                  <Link href={`/admin/manutencoes/${item.id}`}>Detalhes →</Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Section>
  )
}
