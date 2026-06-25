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
} from '@prodexy/ui'
import { AlertTriangle, CircleDollarSign, Edit3, FileText, ListChecks } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { MetricCard } from '@/components/shared/metric-card'
import { Section } from '@/components/shared/section'
import { StatusBadge } from '@/components/shared/status-badge'
import { TablePagination, useTablePagination } from '@/components/shared/table-pagination'
import { SinisterDialog } from '@/components/sinisters/sinister-dialog'
import { brl, dateTime, number } from '@/lib/format'
import {
  sinisterCostCategoryLabel,
  sinisterStatusLabel,
  sinisterTypeLabel,
  type SinisterListItem,
  type SinisterLookups,
} from '@/types/sinister'

const emptyLookups: SinisterLookups = {
  vehicles: [],
  drivers: [],
  trips: [],
}

type SinisterDetailsPageProps = {
  sinisterId: string
}

export function SinisterDetailsPage({ sinisterId }: SinisterDetailsPageProps) {
  const [sinister, setSinister] = useState<SinisterListItem | null>(null)
  const [lookups, setLookups] = useState<SinisterLookups>(emptyLookups)
  const [editOpen, setEditOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadSinister = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/admin/sinistros/${sinisterId}`, { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Não foi possível carregar o sinistro.')

      setSinister(result.sinister)
      setLookups(result.lookups ?? emptyLookups)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar o sinistro.')
    } finally {
      setLoading(false)
    }
  }, [sinisterId])

  useEffect(() => {
    void loadSinister()
  }, [loadSinister])

  const costsPagination = useTablePagination(sinister?.costs ?? [])

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Carregando sinistro...
        </CardContent>
      </Card>
    )
  }

  if (error || !sinister) {
    return (
      <Card>
        <CardContent className="space-y-4 p-8 text-center">
          <p className="text-destructive">{error || 'Sinistro não encontrado.'}</p>
          <Button variant="outline" asChild>
            <Link href="/admin/sinistros">Voltar para sinistros</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <PageHeader
        title={`${sinister.vehicleFleetCode} · ${sinisterTypeLabel[sinister.type]}`}
        description="Dossiê operacional do sinistro, envolvidos e custos registrados."
        backHref="/admin/sinistros"
        backLabel="Voltar para sinistros"
      >
        <Button variant="outline" className="gap-2" onClick={() => setEditOpen(true)}>
          <Edit3 className="size-4" />
          Editar sinistro
        </Button>
      </PageHeader>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Custo total" value={brl(sinister.totalCost)} icon={CircleDollarSign} tone="danger" />
        <MetricCard title="Itens de custo" value={sinister.costsCount} icon={ListChecks} />
        <MetricCard title="Severidade" value={sinister.severity === 'critica' ? 'Crítica' : sinister.severity === 'atencao' ? 'Atenção' : 'Baixa'} icon={AlertTriangle} tone={sinister.severity === 'critica' ? 'danger' : 'warning'} />
        <MetricCard title="Status" value={sinisterStatusLabel[sinister.status]} icon={FileText} />
      </div>

      <div className="mb-5 grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Identificação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p><b>Data:</b> {dateTime(sinister.occurredAt)}</p>
            <p>
              <b>Veículo:</b>{' '}
              <Link className="text-primary" href={`/admin/veiculos/${sinister.vehicleId}`}>
                {sinister.vehicleLabel}
              </Link>
            </p>
            <p><b>Motorista:</b> {sinister.driverName}</p>
            <p><b>Local:</b> {sinister.location || 'Não informado'}</p>
            <div className="flex flex-wrap items-center gap-2">
              <b>Status:</b>
              <StatusBadge type="raw" value={sinister.status} label={sinisterStatusLabel[sinister.status]} />
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Descrição do sinistro</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="whitespace-pre-line">{sinister.description}</p>
            <div className="grid gap-3 border-t pt-4 sm:grid-cols-3">
              <p><b>Tipo:</b> {sinisterTypeLabel[sinister.type]}</p>
              <p><b>Boletim:</b> {sinister.policeReport || 'Não informado'}</p>
              <p><b>Terceiros:</b> {sinister.hasThirdParties ? 'Sim' : 'Não'}</p>
            </div>
            {sinister.notes ? (
              <p className="whitespace-pre-line border-t pt-4">
                <b>Observações:</b><br />
                {sinister.notes}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Section
        title="Custos do sinistro"
        description="Itens informados no dossiê com quantidade, valor unitário e total."
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Categoria</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Qtd</TableHead>
              <TableHead>Valor unit.</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Comprovante</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sinister.costs.length ? costsPagination.pageItems.map((cost) => (
              <TableRow key={cost.id}>
                <TableCell>{sinisterCostCategoryLabel[cost.category]}</TableCell>
                <TableCell className="max-w-[360px]">
                  <p className="truncate" title={cost.description}>{cost.description}</p>
                </TableCell>
                <TableCell>{number(cost.quantity, 3)}</TableCell>
                <TableCell>{brl(cost.unitValue)}</TableCell>
                <TableCell className="font-medium">{brl(cost.totalValue)}</TableCell>
                <TableCell className="max-w-[220px]">
                  <p className="truncate" title={cost.receiptPath}>{cost.receiptPath || '—'}</p>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Nenhum custo registrado para este sinistro.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <TablePagination {...costsPagination} />
      </Section>

      <SinisterDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        sinister={sinister}
        lookups={lookups}
        onSaved={loadSinister}
      />
    </>
  )
}
