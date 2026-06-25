'use client'

import { ChangeEvent, FormEvent, useEffect, useState } from 'react'
import {
  Button,
  Checkbox,
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
import { SinisterCostEditor } from '@/components/sinisters/sinister-cost-editor'
import {
  sinisterStatusLabel,
  sinisterStatuses,
  sinisterTypeLabel,
  sinisterTypes,
  type SinisterFormValues,
  type SinisterListItem,
  type SinisterLookups,
} from '@/types/sinister'
import type { Severity } from '@/types/fleet'

type SinisterDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  sinister?: SinisterListItem | null
  lookups: SinisterLookups
  initialVehicleId?: string
  onSaved: (sinisterId?: string) => void | Promise<void>
}

const severityLabel: Record<Severity, string> = {
  baixa: 'Baixa',
  atencao: 'Atenção',
  critica: 'Crítica',
}

function localDateTime(value = new Date().toISOString()) {
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function emptyForm(initialVehicleId?: string): SinisterFormValues {
  return {
    vehicleId: initialVehicleId ?? '',
    driverId: '',
    occurredAt: localDateTime(),
    type: 'avaria',
    severity: 'atencao',
    status: 'aberto',
    location: '',
    description: '',
    notes: '',
    policeReport: '',
    hasThirdParties: false,
    costs: [],
  }
}

function formFromSinister(
  sinister: SinisterListItem | null | undefined,
  initialVehicleId?: string,
): SinisterFormValues {
  if (!sinister) return emptyForm(initialVehicleId)

  return {
    vehicleId: sinister.vehicleId,
    driverId: sinister.driverId ?? '',
    occurredAt: localDateTime(sinister.occurredAt),
    type: sinister.type,
    severity: sinister.severity,
    status: sinister.status,
    location: sinister.location,
    description: sinister.description,
    notes: sinister.notes,
    policeReport: sinister.policeReport,
    hasThirdParties: sinister.hasThirdParties,
    costs: sinister.costs.map((cost) => ({
      localId: cost.id,
      category: cost.category,
      description: cost.description,
      quantity: cost.quantity.toString(),
      unitValue: cost.unitValue.toString(),
      receiptPath: cost.receiptPath,
    })),
  }
}

export function SinisterDialog({
  open,
  onOpenChange,
  sinister,
  lookups,
  initialVehicleId,
  onSaved,
}: SinisterDialogProps) {
  const [form, setForm] = useState<SinisterFormValues>(() => emptyForm(initialVehicleId))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setForm(formFromSinister(sinister, initialVehicleId))
    setError('')
  }, [initialVehicleId, open, sinister])

  function updateField(
    field: 'occurredAt' | 'location' | 'description' | 'notes' | 'policeReport',
  ) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((current) => ({ ...current, [field]: event.target.value }))
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      const response = await fetch(
        sinister ? `/api/admin/sinistros/${sinister.id}` : '/api/admin/sinistros',
        {
          method: sinister ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...form,
            occurredAt: new Date(form.occurredAt).toISOString(),
          }),
        },
      )
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Não foi possível salvar o sinistro.')

      await onSaved(result.id)
      onOpenChange(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar o sinistro.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle>{sinister ? 'Editar sinistro' : 'Novo sinistro'}</DialogTitle>
          <DialogDescription>
            Registre o dossiê operacional do evento, seus envolvidos e custos associados.
          </DialogDescription>
        </DialogHeader>

        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

        <form className="space-y-6" onSubmit={handleSubmit}>
          <section className="space-y-4">
            <div>
              <h3 className="font-semibold">Vínculo operacional</h3>
              <p className="text-sm text-muted-foreground">
                O sinistro é sempre vinculado a um veículo. O motorista pode ficar em branco.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Veículo</Label>
                <Select
                  value={form.vehicleId}
                  onValueChange={(vehicleId) => setForm((current) => ({ ...current, vehicleId }))}
                >
                  <SelectTrigger className="w-full"><SelectValue placeholder="Selecione o veículo" /></SelectTrigger>
                  <SelectContent>
                    {lookups.vehicles.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>{vehicle.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Motorista</Label>
                <Select
                  value={form.driverId || 'sem_motorista'}
                  onValueChange={(driverId) => {
                    setForm((current) => ({
                      ...current,
                      driverId: driverId === 'sem_motorista' ? '' : driverId,
                    }))
                  }}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sem_motorista">Sem motorista</SelectItem>
                    {lookups.drivers.map((driver) => (
                      <SelectItem key={driver.id} value={driver.id}>{driver.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <section className="space-y-4 border-t pt-5">
            <div>
              <h3 className="font-semibold">Dossiê do sinistro</h3>
              <p className="text-sm text-muted-foreground">
                Classificação, data, local, descrição do evento e observações de apoio.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                <Label htmlFor="sinister-date">Data e hora</Label>
                <Input
                  id="sinister-date"
                  type="datetime-local"
                  value={form.occurredAt}
                  onChange={updateField('occurredAt')}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={form.type}
                  onValueChange={(type: SinisterFormValues['type']) => {
                    setForm((current) => ({ ...current, type }))
                  }}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {sinisterTypes.map((type) => (
                      <SelectItem key={type} value={type}>{sinisterTypeLabel[type]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Severidade</Label>
                <Select
                  value={form.severity}
                  onValueChange={(severity: Severity) => {
                    setForm((current) => ({ ...current, severity }))
                  }}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(severityLabel).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(status: SinisterFormValues['status']) => {
                    setForm((current) => ({ ...current, status }))
                  }}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {sinisterStatuses.map((status) => (
                      <SelectItem key={status} value={status}>{sinisterStatusLabel[status]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sinister-location">Local</Label>
                <Input id="sinister-location" value={form.location} onChange={updateField('location')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sinister-police-report">Boletim ou referência</Label>
                <Input id="sinister-police-report" value={form.policeReport} onChange={updateField('policeReport')} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sinister-description">Descrição do sinistro</Label>
              <Textarea
                id="sinister-description"
                rows={4}
                value={form.description}
                onChange={updateField('description')}
                required
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.hasThirdParties}
                onCheckedChange={(checked: boolean | 'indeterminate') => {
                  setForm((current) => ({ ...current, hasThirdParties: checked === true }))
                }}
              />
              Envolve terceiros
            </label>

            <div className="space-y-2">
              <Label htmlFor="sinister-notes">Observações</Label>
              <Textarea id="sinister-notes" rows={3} value={form.notes} onChange={updateField('notes')} />
            </div>
          </section>

          <SinisterCostEditor
            value={form.costs}
            onChange={(costs) => setForm((current) => ({ ...current, costs }))}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar sinistro'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
