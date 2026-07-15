'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { Bus, CircleCheckBig, FileWarning, Plus, TriangleAlert, Wrench } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { FilterInput, FilterSelect } from '@/components/shared/filters'
import { MetricCard } from '@/components/shared/metric-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { TableDetailsButton } from '@/components/shared/table-details-button'
import { TablePagination, useTablePagination } from '@/components/shared/table-pagination'
import { VehicleDialog } from '@/components/vehicles/vehicle-dialog'
import { formatKm } from '@/lib/km'
import { compareByTextPtBr, compareTextPtBr } from '@/lib/sorting'
import type { VehicleFormOptions, VehicleListItem } from '@/types/vehicle'

type VehiclePageMode = 'admin' | 'mechanic'

const emptyOptions: VehicleFormOptions = { routes: [], drivers: [], documentTypes: [] }

function pluralize(count: number, singular: string, plural: string) {
  return count === 1 ? singular : plural
}

function getVehicleDocumentSummary(vehicle: VehicleListItem) {
  const documents = vehicle.documents
  if (!documents.length) {
    return { status: null, label: 'Sem documentos', subtitle: 'Nenhum documento ativo' }
  }

  const expired = documents.filter((document) => document.status === 'vencido').length
  if (expired) {
    return {
      status: 'vencido' as const,
      label: String(expired) + ' ' + pluralize(expired, 'vencido', 'vencidos'),
      subtitle: String(documents.length) + ' ' + pluralize(documents.length, 'documento', 'documentos'),
    }
  }

  const expiring = documents.filter((document) => document.status === 'proximo').length
  if (expiring) {
    return {
      status: 'proximo' as const,
      label: String(expiring) + ' ' + pluralize(expiring, 'próximo', 'próximos'),
      subtitle: String(documents.length) + ' ' + pluralize(documents.length, 'documento', 'documentos'),
    }
  }

  return {
    status: 'em_dia' as const,
    label: 'Em dia',
    subtitle: String(documents.length) + ' ' + pluralize(documents.length, 'documento', 'documentos'),
  }
}

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
    () => [...new Set(vehicles.map((vehicle) => vehicle.type).filter(Boolean))].sort(compareTextPtBr),
    [vehicles],
  )

  const filteredVehicles = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')

    return vehicles.filter((vehicle) => {
      const matchesSearch =
        !term
        || vehicle.fleetCode.toLocaleLowerCase('pt-BR').includes(term)
        || vehicle.plate.toLocaleLowerCase('pt-BR').includes(term)
        || vehicle.brand.toLocaleLowerCase('pt-BR').includes(term)
        || vehicle.model.toLocaleLowerCase('pt-BR').includes(term)
      const matchesStatus = status === 'todos' || vehicle.status === status
      const matchesType = type === 'todos' || vehicle.type === type
      const matchesDriver =
        driverId === 'todos' || vehicle.drivers.some((driver) => driver.id === driverId)

      return matchesSearch && matchesStatus && matchesType && matchesDriver
    }).sort((a, b) => compareByTextPtBr(
      a,
      b,
      (vehicle) => vehicle.fleetCode,
      (vehicle) => vehicle.brand,
      (vehicle) => vehicle.model,
      (vehicle) => vehicle.plate,
    ))
  }, [driverId, search, status, type, vehicles])
  const vehiclePagination = useTablePagination(
    filteredVehicles,
    `${search}|${status}|${type}|${driverId}`,
  )

  const documentsExpired = vehicles.filter((vehicle) => (
    vehicle.documents.some((document) => document.status === 'vencido')
  )).length
  const documentsExpiring = vehicles.filter((vehicle) => (
    !vehicle.documents.some((document) => document.status === 'vencido')
    && vehicle.documents.some((document) => document.status === 'proximo')
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
          <MetricCard
            title="Docs vencidos"
            value={documentsExpired}
            subtitle={String(documentsExpiring) + ' próximos'}
            icon={FileWarning}
            tone={documentsExpired ? 'danger' : documentsExpiring ? 'warning' : 'success'}
          />
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
              placeholder="Buscar por frota, placa, marca ou modelo..."
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
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[9%]">Frota</TableHead>
                  <TableHead className="w-[18%]">Veículo</TableHead>
                  <TableHead className="w-[16%]">Rota fixa</TableHead>
                  {isAdmin ? <TableHead className="w-[22%]">Motoristas</TableHead> : null}
                  <TableHead className="w-[10%]">KM atual</TableHead>
                  <TableHead className="w-[9%]">{isAdmin ? 'Documentos' : 'Pendências'}</TableHead>
                  <TableHead className="w-[11%]">Status</TableHead>
                  <TableHead className="w-[5%]" />
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
                    const documentSummary = getVehicleDocumentSummary(vehicle)

                    return (
                      <TableRow key={vehicle.id}>
                        <TableCell className="align-top">
                          <p className="truncate font-semibold" title={vehicle.fleetCode}>{vehicle.fleetCode}</p>
                          <p className="truncate text-xs text-muted-foreground" title={`Placa ${vehicle.plate}`}>
                            Placa {vehicle.plate}
                          </p>
                        </TableCell>
                        <TableCell className="align-top">
                          <p
                            className="truncate"
                            title={`${vehicle.brand} ${vehicle.model}${vehicle.year ? ` · ${vehicle.year}` : ''}`}
                          >
                            {vehicle.brand} {vehicle.model}
                            {vehicle.year ? ` · ${vehicle.year}` : ''}
                          </p>
                          <span className="block truncate text-xs text-muted-foreground" title={vehicle.type}>
                            {vehicle.type}
                          </span>
                        </TableCell>
                        <TableCell className="align-top">
                          <p
                            className="truncate"
                            title={vehicle.route
                              ? `${vehicle.route.origin} → ${vehicle.route.destination}`
                              : 'Sem rota fixa'}
                          >
                            {vehicle.route
                              ? `${vehicle.route.origin} → ${vehicle.route.destination}`
                              : 'Sem rota fixa'}
                          </p>
                        </TableCell>
                        {isAdmin ? (
                          <TableCell className="align-top">
                            {vehicle.drivers.length ? (
                              <div className="space-y-1">
                                {vehicle.drivers.slice(0, 3).map((driver) => (
                                  <p key={driver.id} className="truncate leading-tight" title={driver.name}>
                                    {driver.name}
                                  </p>
                                ))}
                                {vehicle.drivers.length > 3 ? (
                                  <p className="text-xs text-muted-foreground">
                                    +{vehicle.drivers.length - 3} motorista{vehicle.drivers.length - 3 > 1 ? 's' : ''}
                                  </p>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Sem motorista</span>
                            )}
                          </TableCell>
                        ) : null}
                        <TableCell className="align-top tabular-nums">{formatKm(vehicle.currentKm)}</TableCell>
                        <TableCell className="align-top">
                          {isAdmin ? (
                            <div className="space-y-1">
                              {documentSummary.status ? (
                                <StatusBadge type="document" value={documentSummary.status} />
                              ) : (
                                <span className="text-sm text-muted-foreground">{documentSummary.label}</span>
                              )}
                              {documentSummary.status && documentSummary.status !== 'em_dia' ? (
                                <p className="text-xs text-muted-foreground">{documentSummary.label}</p>
                              ) : null}
                              <p className="text-xs text-muted-foreground">{documentSummary.subtitle}</p>
                            </div>
                          ) : (
                            <span className={vehicle.criticalPendingCount ? 'font-semibold text-destructive' : ''}>
                              {vehicle.pendingCount}
                              {vehicle.criticalPendingCount
                                ? ` (${vehicle.criticalPendingCount} críticas)`
                                : ''}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="align-top">
                          <StatusBadge type="vehicle" value={vehicle.status} />
                        </TableCell>
                        <TableCell className="text-right align-top">
                          <TableDetailsButton href={`${basePath}/${vehicle.id}`} />
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
