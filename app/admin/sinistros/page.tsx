'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { AlertTriangle, CircleDollarSign, Plus, ShieldAlert } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { FilterInput, FilterSelect } from '@/components/shared/filters'
import { MetricCard } from '@/components/shared/metric-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { TableDetailsButton } from '@/components/shared/table-details-button'
import { TablePagination, useTablePagination } from '@/components/shared/table-pagination'
import { SinisterDialog } from '@/components/sinisters/sinister-dialog'
import { brl, dateTime } from '@/lib/format'
import {
  sinisterStatusLabel,
  sinisterStatuses,
  sinisterTypeLabel,
  sinisterTypes,
  type SinisterListItem,
  type SinisterLookups,
} from '@/types/sinister'
import type { Severity } from '@/types/fleet'

const emptyLookups: SinisterLookups = {
  vehicles: [],
  drivers: [],
  trips: [],
}

const severityLabel: Record<Severity, string> = {
  baixa: 'Baixa',
  atencao: 'Atenção',
  critica: 'Crítica',
}

export default function SinistersPage() {
  const [items, setItems] = useState<SinisterListItem[]>([])
  const [lookups, setLookups] = useState<SinisterLookups>(emptyLookups)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [initialVehicleId, setInitialVehicleId] = useState<string | undefined>()
  const [search, setSearch] = useState('')
  const [type, setType] = useState('todos')
  const [status, setStatus] = useState('todos')
  const [severity, setSeverity] = useState('todas')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const queryHandled = useRef(false)

  const loadSinisters = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/admin/sinistros', { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Não foi possível carregar os sinistros.')

      setItems(result.items ?? [])
      setLookups(result.lookups ?? emptyLookups)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar os sinistros.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSinisters()
  }, [loadSinisters])

  useEffect(() => {
    if (queryHandled.current || !lookups.vehicles.length) return
    queryHandled.current = true

    const params = new URLSearchParams(window.location.search)
    const vehicleId = params.get('vehicleId')
    if (params.get('newSinister') !== '1' || !vehicleId) return
    if (!lookups.vehicles.some((vehicle) => vehicle.id === vehicleId)) return

    setInitialVehicleId(vehicleId)
    setDialogOpen(true)
  }, [lookups.vehicles])

  const filteredItems = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')

    return items.filter((item) => {
      const matchesSearch =
        !term
        || item.vehicleFleetCode.toLocaleLowerCase('pt-BR').includes(term)
        || item.vehicleLabel.toLocaleLowerCase('pt-BR').includes(term)
        || item.driverName.toLocaleLowerCase('pt-BR').includes(term)
        || item.description.toLocaleLowerCase('pt-BR').includes(term)
        || item.location.toLocaleLowerCase('pt-BR').includes(term)
      return (
        matchesSearch
        && (type === 'todos' || item.type === type)
        && (status === 'todos' || item.status === status)
        && (severity === 'todas' || item.severity === severity)
      )
    })
  }, [items, search, severity, status, type])

  const pagination = useTablePagination(
    filteredItems,
    `${search}|${type}|${status}|${severity}`,
  )

  const activeItems = items.filter((item) => item.status !== 'cancelado')
  const metrics = {
    total: activeItems.length,
    open: items.filter((item) => item.status === 'aberto' || item.status === 'em_analise').length,
    critical: items.filter((item) => item.severity === 'critica' && item.status !== 'cancelado').length,
    cost: activeItems.reduce((total, item) => total + item.totalCost, 0),
  }

  return (
    <>
      <PageHeader
        title="Sinistros"
        description="Controle de avarias, acidentes, ocorrências operacionais e seus custos por veículo."
      >
        <Button className="gap-2" onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" />
          Novo sinistro
        </Button>
      </PageHeader>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total ativo" value={metrics.total} icon={ShieldAlert} />
        <MetricCard title="Em aberto" value={metrics.open} icon={AlertTriangle} tone="warning" />
        <MetricCard title="Críticos" value={metrics.critical} icon={AlertTriangle} tone="danger" />
        <MetricCard title="Custo total" value={brl(metrics.cost)} icon={CircleDollarSign} tone="danger" />
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_minmax(180px,0.35fr)_minmax(180px,0.35fr)_minmax(180px,0.35fr)]">
            <FilterInput
              placeholder="Buscar por frota, veículo, motorista, local ou descrição..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <FilterSelect value={type} onValueChange={setType}>
              <option value="todos">Todos os tipos</option>
              {sinisterTypes.map((item) => (
                <option key={item} value={item}>{sinisterTypeLabel[item]}</option>
              ))}
            </FilterSelect>
            <FilterSelect value={status} onValueChange={setStatus}>
              <option value="todos">Todos os status</option>
              {sinisterStatuses.map((item) => (
                <option key={item} value={item}>{sinisterStatusLabel[item]}</option>
              ))}
            </FilterSelect>
            <FilterSelect value={severity} onValueChange={setSeverity}>
              <option value="todas">Todas as severidades</option>
              {Object.entries(severityLabel).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </FilterSelect>
          </div>

          {error ? (
            <div className="flex flex-col gap-3 border-t py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={() => void loadSinisters()}>
                Tentar novamente
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Motorista</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      Carregando sinistros...
                    </TableCell>
                  </TableRow>
                ) : filteredItems.length ? pagination.pageItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="whitespace-nowrap">{dateTime(item.occurredAt)}</TableCell>
                    <TableCell>
                      <p className="font-semibold">{item.vehicleFleetCode}</p>
                      <p className="truncate text-xs text-muted-foreground">{item.vehicleLabel}</p>
                    </TableCell>
                    <TableCell className="max-w-[180px]">
                      <p className="truncate" title={item.driverName}>{item.driverName}</p>
                    </TableCell>
                    <TableCell>
                      <p>{sinisterTypeLabel[item.type]}</p>
                      <StatusBadge type="severity" value={item.severity} />
                    </TableCell>
                    <TableCell className="max-w-[300px]">
                      <p className="truncate font-medium" title={item.description}>{item.description}</p>
                      <p className="truncate text-xs text-muted-foreground">{item.location || 'Sem local informado'}</p>
                    </TableCell>
                    <TableCell className="font-medium">{brl(item.totalCost)}</TableCell>
                    <TableCell>
                      <StatusBadge type="raw" value={item.status} label={sinisterStatusLabel[item.status]} />
                    </TableCell>
                    <TableCell className="text-right">
                      <TableDetailsButton href={`/admin/sinistros/${item.id}`} />
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      Nenhum sinistro encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
          {!error && !loading ? <TablePagination {...pagination} /> : null}
        </CardContent>
      </Card>

      <SinisterDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setInitialVehicleId(undefined)
        }}
        lookups={lookups}
        initialVehicleId={initialVehicleId}
        onSaved={loadSinisters}
      />
    </>
  )
}
