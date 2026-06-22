'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Button,
  Card,
  CardContent,
} from '@prodexy/ui'
import {
  AlertTriangle,
  BellRing,
  Plus,
  TriangleAlert,
  XCircle,
} from 'lucide-react'
import {
  PendingActionDialog,
  type PendingUiAction,
} from '@/components/pendings/pending-action-dialog'
import { PendingDialog } from '@/components/pendings/pending-dialog'
import { PageHeader } from '@/components/layout/page-header'
import { FilterInput, FilterSelect } from '@/components/shared/filters'
import { MetricCard } from '@/components/shared/metric-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { date, number } from '@/lib/format'
import { formatKm } from '@/lib/km'
import { vehicleDocumentLabel } from '@/lib/vehicle-documents'
import type {
  PendingFormOptions,
  PendingListItem,
} from '@/types/pending'

type PendingMode = 'admin' | 'mechanic'

const emptyOptions: PendingFormOptions = {
  vehicles: [],
  drivers: [],
  mechanics: [],
  services: [],
  maintenances: [],
  currentMechanicId: null,
}

const severityGroups = [
  { key: 'critica', title: 'Críticas' },
  { key: 'atencao', title: 'Atenção' },
  { key: 'baixa', title: 'Baixas' },
] as const

export function PendingsPage({ mode }: { mode: PendingMode }) {
  const [items, setItems] = useState<PendingListItem[]>([])
  const [options, setOptions] = useState<PendingFormOptions>(emptyOptions)
  const [search, setSearch] = useState('')
  const [severity, setSeverity] = useState('todas')
  const [origin, setOrigin] = useState('todas')
  const [type, setType] = useState('todos')
  const [createOpen, setCreateOpen] = useState(false)
  const [selected, setSelected] = useState<PendingListItem | null>(null)
  const [action, setAction] = useState<PendingUiAction>('resolvida_manual')
  const [actionOpen, setActionOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const endpoint = `/api/${mode}/pendencias`

  const loadPendings = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(endpoint, { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Não foi possível carregar as pendências.')
      setItems(result.items ?? [])
      setOptions(result.options ?? emptyOptions)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar as pendências.')
    } finally {
      setLoading(false)
    }
  }, [endpoint])

  useEffect(() => {
    void loadPendings()
  }, [loadPendings])

  const pendingTypes = useMemo(
    () => [...new Set(items.map((item) => item.type))].sort(),
    [items],
  )

  const filteredItems = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')
    return items.filter((item) => (
      (!term
        || item.title.toLocaleLowerCase('pt-BR').includes(term)
        || item.description.toLocaleLowerCase('pt-BR').includes(term))
      && (severity === 'todas' || item.severity === severity)
      && (origin === 'todas' || item.origin === origin)
      && (type === 'todos' || item.type === type)
    ))
  }, [items, origin, search, severity, type])

  function openAction(item: PendingListItem, nextAction: PendingUiAction) {
    setSelected(item)
    setAction(nextAction)
    setActionOpen(true)
  }

  return (
    <>
      <PageHeader
        title="Pendências"
        description={mode === 'admin'
          ? 'Central operacional de alertas calculados e demandas manuais da frota.'
          : 'Fila técnica de alertas, serviços, documentos e demandas operacionais.'}
      >
        <Button className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          Nova pendência
        </Button>
      </PageHeader>

      <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total abertas" value={items.length} icon={BellRing} />
        <MetricCard title="Críticas" value={items.filter((item) => item.severity === 'critica').length} icon={TriangleAlert} tone="danger" />
        <MetricCard title="Atenção" value={items.filter((item) => item.severity === 'atencao').length} icon={AlertTriangle} tone="warning" />
        <MetricCard title="Manuais" value={items.filter((item) => item.origin === 'manual').length} />
      </div>

      <Card>
        <CardContent className="space-y-5 p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_minmax(180px,0.45fr)_minmax(180px,0.45fr)_minmax(210px,0.55fr)]">
            <FilterInput
              placeholder="Buscar por título ou descrição..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <FilterSelect value={severity} onValueChange={setSeverity}>
              <option value="todas">Todas as severidades</option>
              <option value="critica">Críticas</option>
              <option value="atencao">Atenção</option>
              <option value="baixa">Baixas</option>
            </FilterSelect>
            <FilterSelect value={origin} onValueChange={setOrigin}>
              <option value="todas">Todas as origens</option>
              <option value="calculada">Calculadas</option>
              <option value="manual">Manuais</option>
            </FilterSelect>
            <FilterSelect value={type} onValueChange={setType}>
              <option value="todos">Todos os tipos</option>
              {pendingTypes.map((pendingType) => (
                <option key={pendingType} value={pendingType}>{typeLabel(pendingType)}</option>
              ))}
            </FilterSelect>
          </div>

          {error ? (
            <div className="flex flex-col gap-3 border-t py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={() => void loadPendings()}>
                Tentar novamente
              </Button>
            </div>
          ) : loading ? (
            <p className="border-t py-12 text-center text-sm text-muted-foreground">
              Carregando pendências...
            </p>
          ) : filteredItems.length ? (
            <div className="border-t">
              {severityGroups.map((group) => {
                const groupItems = filteredItems.filter((item) => item.severity === group.key)
                if (!groupItems.length) return null

                return (
                  <section key={group.key}>
                    <div className="border-b bg-muted/30 px-3 py-2">
                      <h2 className="text-sm font-semibold">{group.title} ({groupItems.length})</h2>
                    </div>
                    <div className="divide-y">
                      {groupItems.map((item) => (
                        <div
                          key={item.key}
                          className="flex flex-col gap-4 px-3 py-4 xl:flex-row xl:items-center xl:justify-between"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold">{item.title}</p>
                              <StatusBadge type="severity" value={item.severity} />
                              <StatusBadge
                                type="raw"
                                value={item.origin}
                                label={item.origin === 'manual' ? 'Manual' : 'Calculada'}
                              />
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                            <p className="mt-2 text-xs text-muted-foreground">
                              {typeLabel(item.type)}
                              {item.dueDate ? ` · Data ${date(item.dueDate)}` : ''}
                              {item.dueKm != null ? ` · Vencimento ${formatKm(item.dueKm)} km` : ''}
                              {item.currentKm != null ? ` · KM atual ${formatKm(item.currentKm)}` : ''}
                            </p>
                          </div>

                          <div className="flex shrink-0 flex-wrap items-center gap-2">
                            <Button variant="outline" size="sm" asChild>
                              <Link href={item.href}>{item.actionLabel}</Link>
                            </Button>
                            {item.origin === 'manual' ? (
                              <Button size="sm" onClick={() => openAction(item, 'resolvida_manual')}>
                                Resolver
                              </Button>
                            ) : null}
                            {item.origin === 'manual' ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Cancelar pendência"
                                onClick={() => openAction(item, 'cancelada')}
                              >
                                <XCircle className="size-4" />
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )
              })}
            </div>
          ) : (
            <p className="border-t py-12 text-center text-sm text-muted-foreground">
              Nenhuma pendência encontrada.
            </p>
          )}
        </CardContent>
      </Card>

      <PendingDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode={mode}
        options={options}
        onSaved={loadPendings}
      />
      <PendingActionDialog
        item={selected}
        action={action}
        open={actionOpen}
        onOpenChange={setActionOpen}
        mode={mode}
        onSaved={loadPendings}
      />
    </>
  )
}

function typeLabel(type: string) {
  const labels: Record<string, string> = {
    servico_km: 'Serviço por KM',
    servico_tempo: 'Serviço por tempo',
    manutencao_aberta: 'Manutenção aberta',
    veiculo_status: 'Situação do veículo',
    cnh: 'CNH',
    manual: 'Geral',
    operacional: 'Operacional',
    seguranca: 'Segurança',
    outros: 'Outros',
  }
  return labels[type] ?? vehicleDocumentLabel(type)
}
