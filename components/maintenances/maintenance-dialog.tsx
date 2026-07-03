'use client'

import { ChangeEvent, FormEvent, useEffect, useState } from 'react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@prodexy/ui'
import { ServiceUsageEditor } from '@/components/maintenances/service-usage-editor'
import { PartUsageEditor } from '@/components/parts/part-usage-editor'
import { KmInput } from '@/components/shared/km-input'
import { brl } from '@/lib/format'
import { formatKm, kmInputValue } from '@/lib/km'
import type {
  MaintenanceFormOptions,
  MaintenanceFormValues,
  MaintenanceListItem,
} from '@/types/maintenance'

type MaintenanceMode = 'admin' | 'mechanic'

type MaintenanceDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: MaintenanceMode
  options: MaintenanceFormOptions
  maintenance?: MaintenanceListItem | null
  initialVehicleId?: string
  onSaved: (maintenanceId?: string) => void | Promise<void>
}

function localDateTime(value = new Date().toISOString()) {
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function emptyForm(
  options: MaintenanceFormOptions,
  initialVehicleId?: string,
): MaintenanceFormValues {
  const vehicle = options.vehicles.find((item) => item.id === initialVehicleId)

  return {
    vehicleId: initialVehicleId ?? '',
    maintenanceType: 'preventiva',
    cause: '',
    openedAt: localDateTime(),
    completedAt: '',
    vehicleKm: kmInputValue(vehicle?.currentKm),
    responsibleMechanicId: options.currentMechanicId ?? '',
    status: 'aberta',
    notes: '',
    services: [],
    parts: [],
  }
}

function formFromMaintenance(
  maintenance: MaintenanceListItem,
  options: MaintenanceFormOptions,
): MaintenanceFormValues {
  return {
    vehicleId: maintenance.vehicleId,
    maintenanceType: maintenance.maintenanceType,
    cause: maintenance.cause,
    openedAt: localDateTime(maintenance.openedAt),
    completedAt: maintenance.completedAt ? localDateTime(maintenance.completedAt) : '',
    vehicleKm: kmInputValue(maintenance.vehicleKm),
    responsibleMechanicId:
      maintenance.responsibleMechanicId ?? options.currentMechanicId ?? '',
    status: maintenance.status === 'concluida'
      ? 'concluida'
      : maintenance.status === 'em_andamento'
        ? 'em_andamento'
        : 'aberta',
    notes: maintenance.notes,
    services: maintenance.services.map((service) => ({
      serviceId: service.serviceId,
      appliedValue: (service.value ?? 0).toString(),
    })),
    parts: maintenance.parts
      .filter((part) => !part.returnedAt)
      .map((part) => ({
        partId: part.partId,
        quantity: part.quantity.toString(),
        unitValue: part.unitValue.toString(),
      })),
  }
}

export function MaintenanceDialog({
  open,
  onOpenChange,
  mode,
  options,
  maintenance,
  initialVehicleId,
  onSaved,
}: MaintenanceDialogProps) {
  const [form, setForm] = useState<MaintenanceFormValues>(() => emptyForm(options, initialVehicleId))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const isCompleted = maintenance?.status === 'concluida'
  const isHistoricalCreation = mode === 'admin' && !maintenance && Boolean(form.completedAt)

  useEffect(() => {
    if (!open) return
    setForm(
      maintenance
        ? formFromMaintenance(maintenance, options)
        : emptyForm(options, initialVehicleId),
    )
    setError('')
  }, [initialVehicleId, maintenance, open, options])

  const servicesTotal = form.services.reduce((total, service) => {
    const value = Number(service.appliedValue.replace(',', '.'))
    return total + (Number.isFinite(value) ? value : 0)
  }, 0)
  const partsTotal = form.parts.reduce((total, part) => {
    const quantity = Number(part.quantity.replace(',', '.'))
    const unitValue = Number(part.unitValue.replace(',', '.'))
    return total + (
      Number.isFinite(quantity) && Number.isFinite(unitValue)
        ? quantity * unitValue
        : 0
    )
  }, 0)
  const selectedVehicle = options.vehicles.find((vehicle) => vehicle.id === form.vehicleId) ?? null
  const compatibleParts = options.parts.filter((part) => (
    !selectedVehicle
    || part.ownerId === selectedVehicle.ownerId
  ))

  function updateField(field: 'cause' | 'openedAt' | 'completedAt' | 'vehicleKm' | 'notes') {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((current) => ({ ...current, [field]: event.target.value }))
    }
  }

  function updateCompletedAt(event: ChangeEvent<HTMLInputElement>) {
    const completedAt = event.target.value
    setForm((current) => ({
      ...current,
      completedAt,
      status: maintenance
        ? current.status
        : completedAt
          ? 'concluida'
          : current.status === 'concluida'
            ? 'aberta'
            : current.status,
    }))
  }

  function selectVehicle(vehicleId: string) {
    const vehicle = options.vehicles.find((item) => item.id === vehicleId)
    setForm((current) => ({
      ...current,
      vehicleId,
      vehicleKm: vehicle ? kmInputValue(vehicle.currentKm) : current.vehicleKm,
      parts: current.parts.filter((part) => {
        const option = options.parts.find((item) => item.id === part.partId)
        return !vehicle || option?.ownerId === vehicle.ownerId
      }),
    }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      const endpoint = `/api/${mode}/manutencoes${maintenance ? `/${maintenance.id}` : ''}`
      const response = await fetch(endpoint, {
        method: maintenance ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          status: mode === 'admin' && !maintenance && form.completedAt
            ? 'concluida'
            : form.status,
          openedAt: new Date(form.openedAt).toISOString(),
          completedAt: form.completedAt ? new Date(form.completedAt).toISOString() : null,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Não foi possível salvar a manutenção.')

      await onSaved(result.id)
      onOpenChange(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar a manutenção.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle>{maintenance ? 'Editar manutenção' : 'Nova manutenção'}</DialogTitle>
          <DialogDescription>
            Registre o veículo, os serviços executados, o responsável e a situação operacional.
          </DialogDescription>
        </DialogHeader>

        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

        <form className="space-y-6" onSubmit={handleSubmit}>
          <section className="space-y-4">
            <div>
              <h3 className="font-semibold">Identificação</h3>
              <p className="text-sm text-muted-foreground">
                Informe a abertura. No cadastro administrativo, uma conclusão preenchida registra
                uma manutenção histórica já finalizada.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Veículo</Label>
                <Select value={form.vehicleId} onValueChange={selectVehicle} disabled={isCompleted}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Selecione o veículo" /></SelectTrigger>
                  <SelectContent>
                    {options.vehicles.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        {vehicle.label} · KM {formatKm(vehicle.currentKm)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={form.maintenanceType}
                  onValueChange={(maintenanceType: MaintenanceFormValues['maintenanceType']) => {
                    setForm((current) => ({ ...current, maintenanceType, services: [] }))
                  }}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preventiva">Preventiva</SelectItem>
                    <SelectItem value="corretiva">Corretiva</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maintenance-cause">Causa ou descrição</Label>
              <Input id="maintenance-cause" value={form.cause} onChange={updateField('cause')} required />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="maintenance-opened-at">Data e hora de abertura</Label>
                <Input
                  id="maintenance-opened-at"
                  type="datetime-local"
                  value={form.openedAt}
                  onChange={updateField('openedAt')}
                  required
                />
              </div>
              {mode === 'admin' && (!maintenance || isCompleted) ? (
                <div className="space-y-2">
                  <Label htmlFor="maintenance-completed-at">
                    Data e hora de conclusão{maintenance ? '' : ' (opcional)'}
                  </Label>
                  <Input
                    id="maintenance-completed-at"
                    type="datetime-local"
                    min={form.openedAt}
                    max={localDateTime()}
                    value={form.completedAt}
                    onChange={updateCompletedAt}
                    required={isCompleted}
                  />
                  {!maintenance ? (
                    <p className="text-xs text-muted-foreground">
                      Ao informar esta data, a manutenção será cadastrada como concluída.
                    </p>
                  ) : null}
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="maintenance-km">KM do veículo</Label>
                <KmInput
                  id="maintenance-km"
                  minValue={0}
                  value={form.vehicleKm}
                  onValueChange={(vehicleKm) => {
                    setForm((current) => ({ ...current, vehicleKm }))
                  }}
                  required
                />
              </div>
            </div>
          </section>

          <ServiceUsageEditor
            options={options.services}
            maintenanceType={form.maintenanceType}
            value={form.services}
            onChange={(services) => setForm((current) => ({ ...current, services }))}
          />

          <PartUsageEditor
            options={compatibleParts}
            value={form.parts}
            onChange={(parts) => setForm((current) => ({ ...current, parts }))}
            description="O preço padrão vem do estoque e pode ser ajustado nesta manutenção. O saldo é debitado ao salvar."
            emptyMessage="Nenhuma peça adicionada a esta manutenção."
            totalLabel="Total em peças"
          />

          <div className="flex items-center justify-between border-y py-4">
            <div>
              <p className="font-semibold">Valor total da manutenção</p>
              <p className="text-sm text-muted-foreground">Serviços e peças utilizados</p>
            </div>
            <span className="text-xl font-semibold">{brl(servicesTotal + partsTotal)}</span>
          </div>

          <section className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {mode === 'admin' ? (
                <div className="space-y-2">
                  <Label>Responsável</Label>
                  <Select
                    value={form.responsibleMechanicId}
                    onValueChange={(responsibleMechanicId) => {
                      setForm((current) => ({ ...current, responsibleMechanicId }))
                    }}
                  >
                    <SelectTrigger className="w-full"><SelectValue placeholder="Selecione o mecânico" /></SelectTrigger>
                    <SelectContent>
                      {options.mechanics.map((mechanic) => (
                        <SelectItem key={mechanic.id} value={mechanic.id}>{mechanic.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  disabled={isCompleted || isHistoricalCreation}
                  onValueChange={(status: MaintenanceFormValues['status']) => {
                    setForm((current) => ({ ...current, status }))
                  }}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aberta">Aberta</SelectItem>
                    <SelectItem value="em_andamento">Em andamento</SelectItem>
                    {isCompleted || isHistoricalCreation
                      ? <SelectItem value="concluida">Concluída</SelectItem>
                      : null}
                  </SelectContent>
                </Select>
              </div>

            </div>

            <div className="space-y-2">
              <Label htmlFor="maintenance-notes">Observações</Label>
              <Textarea
                id="maintenance-notes"
                rows={3}
                value={form.notes}
                onChange={updateField('notes')}
              />
            </div>
          </section>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar manutenção'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function RemoveMaintenanceDialog({
  open,
  onOpenChange,
  maintenance,
  onRemoved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  maintenance: MaintenanceListItem
  onRemoved: () => void | Promise<void>
}) {
  const [reason, setReason] = useState('')
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setReason('')
    setError('')
  }, [open])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setRemoving(true)
    setError('')

    try {
      const response = await fetch(`/api/admin/manutencoes/${maintenance.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Não foi possível remover a manutenção.')

      await onRemoved()
      onOpenChange(false)
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Não foi possível remover a manutenção.')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Remover manutenção</DialogTitle>
          <DialogDescription>
            Esta ação é definitiva. Serviços e peças da manutenção serão removidos,
            peças consumidas retornarão ao estoque e os vencimentos recorrentes serão recalculados.
          </DialogDescription>
        </DialogHeader>

        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="maintenance-removal-reason">Motivo da remoção</Label>
            <Textarea
              id="maintenance-removal-reason"
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Descreva por que esta manutenção deve ser removida"
              minLength={5}
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={removing}>
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={removing || reason.trim().length < 5}
            >
              {removing ? 'Removendo...' : 'Remover manutenção'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
