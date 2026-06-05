'use client'

import Link from 'next/link'
import { Button, Card, CardContent, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@prodexy/ui'
import { PageHeader } from '@/components/layout/page-header'
import { FilterInput, FilterSelect } from '@/components/shared/filters'
import { MetricCard } from '@/components/shared/metric-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { number } from '@/lib/format'
import { drivers, vehicles } from '@/lib/mock-data'
import { getRoute, vehicleDrivers } from '@/lib/selectors'

export default function VehiclesPage() {
  return (
    <>
      <PageHeader title="Veículos" description="Veículos da empresa.">
        <Button>Novo veículo</Button>
      </PageHeader>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total" value={vehicles.length} />
        <MetricCard title="Ativos" value={vehicles.filter((vehicle) => vehicle.status === 'ativo').length} tone="success" />
        <MetricCard title="Em manutenção" value={vehicles.filter((vehicle) => vehicle.status === 'em_manutencao').length} tone="warning" />
        <MetricCard title="CETURB vencida" value={vehicles.filter((vehicle) => vehicle.ceturbStatus === 'vencido').length} tone="danger" />
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <FilterInput placeholder="Buscar por placa ou modelo..." />
            <FilterSelect>
              <option>Todos os status</option>
              <option>Ativo</option>
              <option>Em manutenção</option>
              <option>Inativo</option>
            </FilterSelect>
            <FilterSelect>
              <option>Todos os tipos</option>
              <option>Caminhão</option>
              <option>Ônibus</option>
              <option>Reboque</option>
            </FilterSelect>
            <FilterSelect>
              <option>Qualquer motorista</option>
              {drivers.map((driver) => (
                <option key={driver.id}>{driver.name}</option>
              ))}
            </FilterSelect>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Placa</TableHead>
                <TableHead>Veículo</TableHead>
                <TableHead>Rota fixa</TableHead>
                <TableHead>Motoristas</TableHead>
                <TableHead>KM atual</TableHead>
                <TableHead>CETURB</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehicles.map((vehicle) => {
                const route = getRoute(vehicle.routeId)
                const assignedDrivers = vehicleDrivers(vehicle.id)

                return (
                  <TableRow key={vehicle.id}>
                    <TableCell className="font-semibold">{vehicle.plate}</TableCell>
                    <TableCell>
                      {vehicle.brand} {vehicle.model} · {vehicle.year}
                      <br />
                      <span className="text-xs text-muted-foreground">{vehicle.type}</span>
                    </TableCell>
                    <TableCell>{route?.origin} → {route?.destination}</TableCell>
                    <TableCell>
                      {assignedDrivers.length ? assignedDrivers.map((driver) => driver.name).join(', ') : 'Sem motorista'}
                    </TableCell>
                    <TableCell>{number(vehicle.currentKm)}</TableCell>
                    <TableCell>
                      <StatusBadge type="document" value={vehicle.ceturbStatus} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge type="vehicle" value={vehicle.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="link" asChild>
                        <Link href={`/admin/veiculos/${vehicle.id}`}>Detalhes →</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  )
}
