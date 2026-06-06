'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Textarea,
} from '@prodexy/ui'
import { Ban, CircleCheckBig, Edit3, Gauge, Wrench } from 'lucide-react'
import { MaintenanceDialog } from '@/components/maintenances/maintenance-dialog'
import { PageHeader } from '@/components/layout/page-header'
import { MetricCard } from '@/components/shared/metric-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { brl, dateTime, number } from '@/lib/format'
import type {
  MaintenanceDetails,
  MaintenanceFormOptions,
} from '@/types/maintenance'

type MaintenanceMode = 'admin' | 'mechanic'

const emptyOptions: MaintenanceFormOptions = {
  vehicles: [],
  mechanics: [],
  services: [],
  currentMechanicId: null,
}

export function MaintenanceDetailsPage({
  maintenanceId,
  mode,
}: {
  maintenanceId: string
  mode: MaintenanceMode
}) {
  const [maintenance, setMaintenance] = useState<MaintenanceDetails | null>(null)
  const [options, setOptions] = useState<MaintenanceFormOptions>(emptyOptions)
  const [editOpen, setEditOpen] = useState(false)
  const [action, setAction] = useState<'conclude' | 'cancel' | null>(null)
  const [reason, setReason] = useState('')
  const [acting, setActing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')

  const isAdmin = mode === 'admin'
  const endpoint = `/api/${mode}/manutencoes/${maintenanceId}`
  const listPath = isAdmin ? '/admin/manutencoes' : '/mechanic'
  const vehiclePath = isAdmin ? '/admin/veiculos' : '/mechanic/veiculos'

  const loadMaintenance = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(endpoint, { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Não foi possível carregar a manutenção.')
      setMaintenance(result.maintenance)
      setOptions(result.options ?? emptyOptions)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar a manutenção.')
    } finally {
      setLoading(false)
    }
  }, [endpoint])

  useEffect(() => {
    void loadMaintenance()
  }, [loadMaintenance])

  async function executeAction() {
    if (!action) return
    setActing(true)
    setActionError('')
    try {
      const response = await fetch(`${endpoint}/acao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Não foi possível executar a ação.')
      setAction(null)
      setReason('')
      await loadMaintenance()
    } catch (actionFailure) {
      setActionError(actionFailure instanceof Error ? actionFailure.message : 'Não foi possível executar a ação.')
    } finally {
      setActing(false)
    }
  }

  if (loading) {
    return <Card><CardContent className="p-8 text-center text-muted-foreground">Carregando manutenção...</CardContent></Card>
  }

  if (error || !maintenance) {
    return (
      <Card>
        <CardContent className="space-y-4 p-8 text-center">
          <p className="text-destructive">{error || 'Manutenção não encontrada.'}</p>
          <Button variant="outline" asChild><Link href={listPath}>Voltar para manutenções</Link></Button>
        </CardContent>
      </Card>
    )
  }

  const editable = maintenance.status === 'aberta' || maintenance.status === 'em_andamento'

  return (
    <>
      <PageHeader
        title={`Manutenção · ${maintenance.vehiclePlate}`}
        description={`${maintenance.vehicleLabel} · ${maintenance.maintenanceType === 'preventiva' ? 'Preventiva' : 'Corretiva'}`}
      >
        {editable ? (
          <>
            <Button variant="outline" className="gap-2" onClick={() => setEditOpen(true)}>
              <Edit3 className="size-4" />
              Editar
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => setAction('cancel')}>
              <Ban className="size-4" />
              Cancelar
            </Button>
            <Button className="gap-2" onClick={() => setAction('conclude')}>
              <CircleCheckBig className="size-4" />
              Concluir manutenção
            </Button>
          </>
        ) : null}
      </PageHeader>

      <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Status"
          value={maintenance.status === 'em_andamento'
            ? 'Em andamento'
            : maintenance.status === 'concluida'
              ? 'Concluída'
              : maintenance.status === 'cancelada'
                ? 'Cancelada'
                : 'Aberta'}
          icon={Wrench}
        />
        <MetricCard title="KM registrado" value={maintenance.vehicleKm == null ? '—' : number(maintenance.vehicleKm)} icon={Gauge} />
        <MetricCard title="Serviços" value={maintenance.services.length} />
        <MetricCard title="Valor total" value={brl(maintenance.totalValue)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Registro operacional</CardTitle></CardHeader>
          <CardContent className="divide-y text-sm">
            <Detail label="Veículo">
              <Link className="font-medium text-primary" href={`${vehiclePath}/${maintenance.vehicleId}`}>
                {maintenance.vehicleLabel}
              </Link>
            </Detail>
            <Detail label="Responsável">{maintenance.responsibleMechanicName}</Detail>
            <Detail label="Abertura">{dateTime(maintenance.openedAt)}</Detail>
            <Detail label="Início">{dateTime(maintenance.startedAt ?? undefined)}</Detail>
            <Detail label="Conclusão">{dateTime(maintenance.completedAt ?? undefined)}</Detail>
            <Detail label="Status"><StatusBadge type="maintenance" value={maintenance.status} /></Detail>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Diagnóstico</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="text-muted-foreground">Causa ou descrição</p>
              <p className="mt-1 font-medium">{maintenance.cause}</p>
            </div>
            <div className="border-t pt-4">
              <p className="text-muted-foreground">Observações</p>
              <p className="mt-1">{maintenance.notes || 'Nenhuma observação registrada.'}</p>
            </div>
            {maintenance.cancellationReason ? (
              <div className="border-t pt-4">
                <p className="text-muted-foreground">Motivo do cancelamento</p>
                <p className="mt-1 text-destructive">{maintenance.cancellationReason}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader><CardTitle>Serviços registrados</CardTitle></CardHeader>
          <CardContent className="divide-y">
            {maintenance.services.length ? maintenance.services.map((service) => (
              <div key={service.id} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">{service.name}</p>
                  <p className="text-sm text-muted-foreground">{service.category}</p>
                </div>
                <span className="text-sm font-medium">
                  {service.value == null ? 'Incluso no valor total' : brl(service.value)}
                </span>
              </div>
            )) : (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhum serviço registrado.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {editable ? (
        <MaintenanceDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          mode={mode}
          options={options}
          maintenance={maintenance}
          onSaved={loadMaintenance}
        />
      ) : null}

      <Dialog open={Boolean(action)} onOpenChange={(open) => {
        if (!open) {
          setAction(null)
          setReason('')
          setActionError('')
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{action === 'cancel' ? 'Cancelar manutenção' : 'Concluir manutenção'}</DialogTitle>
            <DialogDescription>
              {action === 'cancel'
                ? 'O registro será preservado no histórico e o veículo poderá ser liberado.'
                : 'Os serviços recorrentes terão seus próximos vencimentos calculados pelo banco.'}
            </DialogDescription>
          </DialogHeader>
          {actionError ? <p className="text-sm text-destructive">{actionError}</p> : null}
          {action === 'cancel' ? (
            <div className="space-y-2">
              <Label htmlFor="maintenance-cancel-reason">Motivo</Label>
              <Textarea
                id="maintenance-cancel-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                required
              />
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)} disabled={acting}>Voltar</Button>
            <Button
              variant={action === 'cancel' ? 'destructive' : 'default'}
              onClick={() => void executeAction()}
              disabled={acting || (action === 'cancel' && !reason.trim())}
            >
              {acting ? 'Processando...' : action === 'cancel' ? 'Confirmar cancelamento' : 'Concluir manutenção'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  )
}
