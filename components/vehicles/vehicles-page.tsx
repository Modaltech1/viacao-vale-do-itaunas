'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@prodexy/ui'
import { BadgeAlert, Bus, CircleCheckBig, Plus, TriangleAlert, Wrench } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { FilterInput, FilterSelect } from '@/components/shared/filters'
import { MetricCard } from '@/components/shared/metric-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { TablePagination, useTablePagination } from '@/components/shared/table-pagination'
import { VehicleDialog } from '@/components/vehicles/vehicle-dialog'
import { number } from '@/lib/format'
import type { VehicleFormOptions, VehicleListItem } from '@/types/vehicle'

type VehiclePageMode = 'admin' | 'mechanic'

const emptyOptions: VehicleFormOptions = { routes: [], drivers: [] }

export function VehiclesPage({ mode }: { mode: VehiclePageMode }) {
  const [vehicles, setVehicles] = useState<VehicleListItem[]>([])
  const [options, setOptions] = useState<VehicleFormOptions>(emptyOptions)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('todos')
  const [type, setType] = useState('todos')
  const [driverId, setDriverId] = useState('todos')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const isAdmin = mode === 'admin'
  const basePath = isAdmin ? '/admin/veiculos' : '/mechanic/veiculos'
  const endpoint = `/api/${mode}/veiculos`

  const loadVehicles = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch(endpoint, { cache: 'no-store' })
      const result = await response.json()

      if (!response.ok) throw new Error(result.error || 'Não foi possível carregar os veículos.')

      setVehicles(result.items ?? [])
      setOptions(result.options ?? emptyOptions)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar os veículos.')
    } finally {
      setLoading(false)
    }
  }, [endpoint])

  useEffect(() => {
    void loadVehicles()
  }, [loadVehicles])

  const vehicleTypes = useMemo(
    () => [...new Set(vehicles.map((vehicle) => vehicle.type).filter(Boolean))].sort(),
    [vehicles],
  )

  const filteredVehicles = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')

    return vehicles.filter((vehicle) => {
      const matchesSearch =
        !term
        || vehicle.plate.toLocaleLowerCase('pt-BR').includes(term)
        || vehicle.brand.toLocaleLowerCase('pt-BR').includes(term)
        || vehicle.model.toLocaleLowerCase('pt-BR').includes(term)
      const matchesStatus = status === 'todos' || vehicle.status === status
      const matchesType = type === 'todos' || vehicle.type === type
      const matchesDriver =
        driverId === 'todos' || vehicle.drivers.some((driver) => driver.id === driverId)

      return matchesSearch && matchesStatus && matchesType && matchesDriver
    })
  }, [driverId, search, status, type, vehicles])
  const vehiclePagination = useTablePagination(
    filteredVehicles,
    `${search}|${status}|${type}|${driverId}`,
  )

  const ceturbExpired = vehicles.filter((vehicle) => (
    vehicle.documents.some((document) => document.code === 'ceturb' && document.status === 'vencido')
  )).length
  const vehiclesWithPendings = vehicles.filter((vehicle) => vehicle.pendingCount > 0).length

  return (
    <>
      <PageHeader
        title="Veículos"
        description={isAdmin
          ? 'Cadastro dos ativos, vínculos com motoristas, rota fixa, documentos e situação operacional.'
          : 'Consulta técnica da frota, documentos, manutenções, alertas e serviços programados.'}
      >
        {isAdmin ? (
          <Button className="gap-2" onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" />
            Novo veículo
          </Button>
        ) : null}
      </PageHeader>

      <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total" value={vehicles.length} icon={Bus} />
        <MetricCard
          title="Ativos"
          value={vehicles.filter((vehicle) => vehicle.status === 'ativo').length}
          icon={CircleCheckBig}
          tone="success"
        />
        <MetricCard
          title="Em manutenção"
          value={vehicles.filter((vehicle) => vehicle.status === 'em_manutencao').length}
          icon={Wrench}
          tone="warning"
        />
        {isAdmin ? (
          <MetricCard title="CETURB vencida" value={ceturbExpired} icon={BadgeAlert} tone="danger" />
        ) : (
          <MetricCard
            title="Com pendências"
            value={vehiclesWithPendings}
            subtitle={`${vehicles.reduce((total, vehicle) => total + vehicle.criticalPendingCount, 0)} críticas`}
            icon={TriangleAlert}
            tone={vehiclesWithPendings ? 'danger' : 'success'}
          />
        )}
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className={`grid gap-3 ${
            isAdmin
              ? 'lg:grid-cols-[minmax(240px,1fr)_minmax(180px,0.5fr)_minmax(180px,0.5fr)_minmax(220px,0.65fr)]'
              : 'lg:grid-cols-[minmax(260px,1fr)_minmax(200px,0.55fr)_minmax(200px,0.55fr)]'
          }`}>
            <FilterInput
              placeholder="Buscar por placa, marca ou modelo..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <FilterSelect value={status} onValueChange={setStatus}>
              <option value="todos">Todos os status</option>
              <option value="ativo">Ativos</option>
              <option value="em_manutencao">Em manutenção</option>
              <option value="reservado">Reservados</option>
              <option value="indisponivel">Indisponíveis</option>
              <option value="inativo">Inativos</option>
            </FilterSelect>
            <FilterSelect value={type} onValueChange={setType}>
              <option value="todos">Todos os tipos</option>
              {vehicleTypes.map((vehicleType) => (
                <option key={vehicleType} value={vehicleType}>{vehicleType}</option>
              ))}
            </FilterSelect>
            {isAdmin ? (
              <FilterSelect value={driverId} onValueChange={setDriverId}>
                <option value="todos">Qualquer motorista</option>
                {options.drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>{driver.name}</option>
                ))}
              </FilterSelect>
            ) : null}
          </div>

          {error ? (
            <div className="flex flex-col gap-3 border-t py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={() => void loadVehicles()}>
                Tentar novamente
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Placa</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Rota fixa</TableHead>
                  {isAdmin ? <TableHead>Motoristas</TableHead> : null}
                  <TableHead>KM atual</TableHead>
                  <TableHead>{isAdmin ? 'CETURB' : 'Pendências'}</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 8 : 7} className="h-24 text-center text-muted-foreground">
                      Carregando veículos...
                    </TableCell>
                  </TableRow>
                ) : filteredVehicles.length ? (
                  vehiclePagination.pageItems.map((vehicle) => {
                    const ceturb = vehicle.documents.find((document) => document.code === 'ceturb')

                    return (
                      <TableRow key={vehicle.id}>
                        <TableCell className="font-semibold">{vehicle.plate}</TableCell>
                        <TableCell>
                          {vehicle.brand} {vehicle.model}
                          {vehicle.year ? ` · ${vehicle.year}` : ''}
                          <br />
                          <span className="text-xs text-muted-foreground">{vehicle.type}</span>
                        </TableCell>
                        <TableCell>
                          {vehicle.route
                            ? `${vehicle.route.origin} → ${vehicle.route.destination}`
                            : 'Sem rota fixa'}
                        </TableCell>
                        {isAdmin ? (
                          <TableCell>
                            {vehicle.drivers.length
                              ? vehicle.drivers.map((driver) => driver.name).join(', ')
                              : 'Sem motorista'}
                          </TableCell>
                        ) : null}
                        <TableCell>{number(vehicle.currentKm)}</TableCell>
                        <TableCell>
                          {isAdmin ? (
                            ceturb
                              ? <StatusBadge type="document" value={ceturb.status} />
                              : <span className="text-sm text-muted-foreground">Não cadastrado</span>
                          ) : (
                            <span className={vehicle.criticalPendingCount ? 'font-semibold text-destructive' : ''}>
                              {vehicle.pendingCount}
                              {vehicle.criticalPendingCount
                                ? ` (${vehicle.criticalPendingCount} críticas)`
                                : ''}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge type="vehicle" value={vehicle.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="link" asChild>
                            <Link href={`${basePath}/${vehicle.id}`}>Detalhes →</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 8 : 7} className="h-24 text-center text-muted-foreground">
                      Nenhum veículo encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
          {!error && !loading ? <TablePagination {...vehiclePagination} /> : null}
        </CardContent>
      </Card>

      {isAdmin ? (
        <VehicleDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          options={options}
          onSaved={loadVehicles}
        />
      ) : null}
    </>
  )
}
