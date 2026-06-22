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
import { CarFront, Edit3 } from 'lucide-react'
import { DriverDialog, DriverVehicleDialog } from '@/components/drivers/driver-dialog'
import { PageHeader } from '@/components/layout/page-header'
import { MetricCard } from '@/components/shared/metric-card'
import { Section } from '@/components/shared/section'
import { StatusBadge } from '@/components/shared/status-badge'
import { TablePagination, useTablePagination } from '@/components/shared/table-pagination'
import { brl, dateTime, maskCpf, number } from '@/lib/format'
import { formatKm } from '@/lib/km'
import type { DriverDetails, DriverVehicleOption } from '@/types/driver'

function formatDateOnly(value: string) {
  if (!value) return 'Não informada'
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

export function DriverDetailsPage({ driverId }: { driverId: string }) {
  const [driver, setDriver] = useState<DriverDetails | null>(null)
  const [vehicles, setVehicles] = useState<DriverVehicleOption[]>([])
  const [editOpen, setEditOpen] = useState(false)
  const [vehicleOpen, setVehicleOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadDriver = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/admin/motoristas/${driverId}`, { cache: 'no-store' })
      const result = await response.json()

      if (!response.ok) throw new Error(result.error || 'Não foi possível carregar o motorista.')

      setDriver(result.driver)
      setVehicles(result.vehicles ?? [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar o motorista.')
    } finally {
      setLoading(false)
    }
  }, [driverId])

  useEffect(() => {
    void loadDriver()
  }, [loadDriver])

  const tripPagination = useTablePagination(driver?.trips ?? [])
  const refuelingPagination = useTablePagination(driver?.refuelings ?? [])
  const expensePagination = useTablePagination(driver?.expenses ?? [])

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Carregando motorista...
        </CardContent>
      </Card>
    )
  }

  if (error || !driver) {
    return (
      <Card>
        <CardContent className="space-y-4 p-8 text-center">
          <p className="text-destructive">{error || 'Motorista não encontrado.'}</p>
          <Button variant="outline" asChild>
            <Link href="/admin/motoristas">Voltar para motoristas</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <PageHeader
        title={driver.name}
        description="Detalhes do acesso, cadastro profissional, veículos vinculados e histórico operacional."
        backHref="/admin/motoristas"
        backLabel="Voltar para motoristas"
      >
        <Button variant="outline" className="gap-2" onClick={() => setEditOpen(true)}>
          <Edit3 className="size-4" />
          Editar motorista
        </Button>
        <Button className="gap-2" onClick={() => setVehicleOpen(true)}>
          <CarFront className="size-4" />
          Alterar veículo
        </Button>
      </PageHeader>

      <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard title="Viagens" value={driver.tripsCount} />
        <MetricCard title="KM rodados" value={formatKm(driver.totalKm)} />
        <MetricCard title="Litros registrados" value={number(driver.totalLiters, 1)} />
        <MetricCard title="Despesas" value={brl(driver.totalExpenses)} />
        <MetricCard
          title="Status CNH"
          value={
            driver.licenseStatus === 'em_dia'
              ? 'Em dia'
              : driver.licenseStatus === 'proximo'
                ? 'Próxima'
                : 'Vencida'
          }
          tone={driver.licenseStatus === 'vencido' ? 'danger' : driver.licenseStatus === 'proximo' ? 'warning' : 'success'}
        />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cadastro</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4 border-b pb-3">
              <span className="text-muted-foreground">Acesso</span>
              <StatusBadge
                type="raw"
                value={driver.accessActive ? 'ativo' : 'inativo'}
                label={driver.accessActive ? 'Ativo' : 'Inativo'}
              />
            </div>
            <p><b>Email:</b> {driver.email}</p>
            <p><b>Telefone:</b> {driver.phone || 'Não informado'}</p>
            <p><b>Endereço:</b> {driver.address || 'Não informado'}</p>
            <p><b>CPF:</b> {driver.cpf ? maskCpf(driver.cpf) : 'Não informado'}</p>
            <p><b>CNH:</b> {driver.licenseNumber || 'Não informada'} {driver.licenseCategory ? `· Categoria ${driver.licenseCategory}` : ''}</p>
            <div className="flex flex-wrap items-center gap-2">
              <b>Validade:</b>
              <span>{formatDateOnly(driver.licenseDueDate)}</span>
              <StatusBadge type="document" value={driver.licenseStatus} />
            </div>
            <p><b>Status profissional:</b> {
              driver.professionalStatus === 'ativo'
                ? 'Ativo'
                : driver.professionalStatus === 'afastado'
                  ? 'Afastado'
                  : 'Inativo'
            }</p>
            {driver.notes ? <p><b>Observações:</b> {driver.notes}</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Veículos vinculados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {driver.vehicles.length ? driver.vehicles.map((vehicle) => (
              <div key={vehicle.id} className="border-b pb-4 last:border-b-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-lg font-semibold">{vehicle.fleetCode} · {vehicle.brand} {vehicle.model}</p>
                  {vehicle.principal ? <StatusBadge type="raw" value="ativo" label="Principal" /> : null}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Placa {vehicle.plate} · KM atual: {formatKm(vehicle.currentKm)}
                </p>
                <div className="mt-2">
                  <StatusBadge type="vehicle" value={vehicle.status} />
                </div>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground">Nenhum veículo vinculado.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="viagens">
        <TabsList>
          <TabsTrigger value="viagens">Viagens</TabsTrigger>
          <TabsTrigger value="abastecimentos">Abastecimentos</TabsTrigger>
          <TabsTrigger value="despesas">Despesas</TabsTrigger>
        </TabsList>

        <TabsContent value="viagens">
          <Section title="Viagens">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rota</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Saída</TableHead>
                  <TableHead>Chegada</TableHead>
                  <TableHead>KM</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {driver.trips.length ? tripPagination.pageItems.map((trip) => (
                  <TableRow key={trip.id}>
                    <TableCell>{trip.origin} → {trip.destination}</TableCell>
                    <TableCell>{trip.vehicle}</TableCell>
                    <TableCell>{dateTime(trip.startedAt)}</TableCell>
                    <TableCell>{dateTime(trip.finishedAt ?? undefined)}</TableCell>
                    <TableCell>{trip.finalKm == null ? '—' : formatKm(trip.finalKm - trip.initialKm)}</TableCell>
                    <TableCell><StatusBadge type="trip" value={trip.status} /></TableCell>
                  </TableRow>
                )) : (
                  <EmptyTableRow columns={6}>Nenhuma viagem registrada.</EmptyTableRow>
                )}
              </TableBody>
            </Table>
            <TablePagination {...tripPagination} />
          </Section>
        </TabsContent>

        <TabsContent value="abastecimentos">
          <Section title="Abastecimentos">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Combustível</TableHead>
                  <TableHead>Litros</TableHead>
                  <TableHead>KM</TableHead>
                  <TableHead>Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {driver.refuelings.length ? refuelingPagination.pageItems.map((refueling) => (
                  <TableRow key={refueling.id}>
                    <TableCell>{dateTime(refueling.registeredAt)}</TableCell>
                    <TableCell>{refueling.vehicle}</TableCell>
                    <TableCell>{refueling.fuelType}</TableCell>
                    <TableCell>{number(refueling.liters, 1)}</TableCell>
                    <TableCell>{formatKm(refueling.registeredKm)}</TableCell>
                    <TableCell>{refueling.totalValue == null ? '—' : brl(refueling.totalValue)}</TableCell>
                  </TableRow>
                )) : (
                  <EmptyTableRow columns={6}>Nenhum abastecimento registrado.</EmptyTableRow>
                )}
              </TableBody>
            </Table>
            <TablePagination {...refuelingPagination} />
          </Section>
        </TabsContent>

        <TabsContent value="despesas">
          <Section title="Despesas">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Observação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {driver.expenses.length ? expensePagination.pageItems.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>{dateTime(expense.registeredAt)}</TableCell>
                    <TableCell>{expense.vehicle}</TableCell>
                    <TableCell>{expense.category}</TableCell>
                    <TableCell>{brl(expense.value)}</TableCell>
                    <TableCell>{expense.notes || '—'}</TableCell>
                  </TableRow>
                )) : (
                  <EmptyTableRow columns={5}>Nenhuma despesa registrada.</EmptyTableRow>
                )}
              </TableBody>
            </Table>
            <TablePagination {...expensePagination} />
          </Section>
        </TabsContent>
      </Tabs>

      <DriverDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        driver={driver}
        vehicles={vehicles}
        onSaved={loadDriver}
      />
      <DriverVehicleDialog
        open={vehicleOpen}
        onOpenChange={setVehicleOpen}
        driver={driver}
        vehicles={vehicles}
        onSaved={loadDriver}
      />
    </>
  )
}
