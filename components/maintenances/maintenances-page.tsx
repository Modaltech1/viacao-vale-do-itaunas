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
import { CircleCheckBig, ClipboardList, Plus, ShieldAlert, Wrench } from 'lucide-react'
import { MaintenanceDialog } from '@/components/maintenances/maintenance-dialog'
import { PageHeader } from '@/components/layout/page-header'
import { FilterInput, FilterSelect } from '@/components/shared/filters'
import { MetricCard } from '@/components/shared/metric-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { brl, dateTime, number } from '@/lib/format'
import type {
  MaintenanceFormOptions,
  MaintenanceListItem,
} from '@/types/maintenance'

type MaintenanceMode = 'admin' | 'mechanic'

const emptyOptions: MaintenanceFormOptions = {
  vehicles: [],
  mechanics: [],
  services: [],
  currentMechanicId: null,
}

export function MaintenancesPage({ mode }: { mode: MaintenanceMode }) {
  const [items, setItems] = useState<MaintenanceListItem[]>([])
  const [options, setOptions] = useState<MaintenanceFormOptions>(emptyOptions)
  const [search, setSearch] = useState('')
  const [type, setType] = useState('todos')
  const [status, setStatus] = useState(mode === 'mechanic' ? 'ativas' : 'todos')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const isAdmin = mode === 'admin'
  const endpoint = `/api/${mode}/manutencoes`
  const detailsBase = isAdmin ? '/admin/manutencoes' : '/mechanic/manutencoes'

  const loadMaintenances = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(endpoint, { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Não foi possível carregar as manutenções.')
      setItems(result.items ?? [])
      setOptions(result.options ?? emptyOptions)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar as manutenções.')
    } finally {
      setLoading(false)
    }
  }, [endpoint])

  useEffect(() => {
    void loadMaintenances()
  }, [loadMaintenances])

  const filteredItems = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')

    return items.filter((item) => {
      const matchesSearch =
        !term
        || item.vehiclePlate.toLocaleLowerCase('pt-BR').includes(term)
        || item.vehicleLabel.toLocaleLowerCase('pt-BR').includes(term)
        || item.cause.toLocaleLowerCase('pt-BR').includes(term)
        || item.services.some((service) => service.name.toLocaleLowerCase('pt-BR').includes(term))
      const matchesType = type === 'todos' || item.maintenanceType === type
      const matchesStatus = status === 'todos'
        || (status === 'ativas'
          ? item.status === 'aberta' || item.status === 'em_andamento'
          : item.status === status)
      return matchesSearch && matchesType && matchesStatus
    })
  }, [items, search, status, type])

  const active = items.filter(
    (item) => item.status === 'aberta' || item.status === 'em_andamento',
  )
  const monitoredVehicles = new Set(active.map((item) => item.vehicleId)).size

  return (
    <>
      <PageHeader
        title="Manutenções"
        description={isAdmin
          ? 'Controle das intervenções preventivas e corretivas, responsáveis, serviços e custos.'
          : 'Execução operacional das intervenções, serviços e liberações da frota.'}
      >
        <Button className="gap-2" onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" />
          Nova manutenção
        </Button>
      </PageHeader>

      <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Abertas" value={items.filter((item) => item.status === 'aberta').length} icon={ShieldAlert} tone="warning" />
        <MetricCard title="Em andamento" value={items.filter((item) => item.status === 'em_andamento').length} icon={Wrench} tone="blue" />
        <MetricCard title="Concluídas" value={items.filter((item) => item.status === 'concluida').length} icon={CircleCheckBig} tone="success" />
        {isAdmin ? (
          <MetricCard title="Custo registrado" value={brl(items.filter((item) => item.status !== 'cancelada').reduce((total, item) => total + item.totalValue, 0))} />
        ) : (
          <MetricCard title="Veículos monitorados" value={monitoredVehicles} icon={ClipboardList} />
        )}
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_minmax(190px,0.45fr)_minmax(210px,0.5fr)]">
            <FilterInput
              placeholder="Buscar por placa, veículo, causa ou serviço..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <FilterSelect value={type} onValueChange={setType}>
              <option value="todos">Todos os tipos</option>
              <option value="preventiva">Preventivas</option>
              <option value="corretiva">Corretivas</option>
            </FilterSelect>
            <FilterSelect value={status} onValueChange={setStatus}>
              <option value="todos">Todos os status</option>
              <option value="ativas">Abertas e em andamento</option>
              <option value="aberta">Abertas</option>
              <option value="em_andamento">Em andamento</option>
              <option value="concluida">Concluídas</option>
              <option value="cancelada">Canceladas</option>
            </FilterSelect>
          </div>

          {error ? (
            <div className="flex flex-col gap-3 border-t py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={() => void loadMaintenances()}>
                Tentar novamente
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Serviços</TableHead>
                  <TableHead>Abertura</TableHead>
                  <TableHead>KM</TableHead>
                  <TableHead>Responsável</TableHead>
                  {isAdmin ? <TableHead>Valor</TableHead> : null}
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 9 : 8} className="h-24 text-center text-muted-foreground">
                      Carregando manutenções...
                    </TableCell>
                  </TableRow>
                ) : filteredItems.length ? (
                  filteredItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <p className="font-semibold">{item.vehiclePlate}</p>
                        <p className="text-xs text-muted-foreground">{item.vehicleLabel.replace(`${item.vehiclePlate} · `, '')}</p>
                      </TableCell>
                      <TableCell>{item.maintenanceType === 'preventiva' ? 'Preventiva' : 'Corretiva'}</TableCell>
                      <TableCell className="max-w-[280px]">
                        <p className="truncate">{item.services.map((service) => service.name).join(', ') || 'Sem serviços'}</p>
                        <p className="truncate text-xs text-muted-foreground">{item.cause}</p>
                      </TableCell>
                      <TableCell>{dateTime(item.openedAt)}</TableCell>
                      <TableCell>{item.vehicleKm == null ? '—' : number(item.vehicleKm)}</TableCell>
                      <TableCell>{item.responsibleMechanicName}</TableCell>
                      {isAdmin ? <TableCell>{brl(item.totalValue)}</TableCell> : null}
                      <TableCell><StatusBadge type="maintenance" value={item.status} /></TableCell>
                      <TableCell className="text-right">
                        <Button variant="link" asChild>
                          <Link href={`${detailsBase}/${item.id}`}>Detalhes →</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 9 : 8} className="h-24 text-center text-muted-foreground">
                      Nenhuma manutenção encontrada.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <MaintenanceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={mode}
        options={options}
        onSaved={loadMaintenances}
      />
    </>
  )
}
