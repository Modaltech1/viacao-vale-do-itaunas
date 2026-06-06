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
import type {
  PendingFormOptions,
  PendingFormValues,
} from '@/types/pending'

type PendingMode = 'admin' | 'mechanic'

const emptyPendingForm: PendingFormValues = {
  title: '',
  description: '',
  severity: 'atencao',
  type: 'manual',
  vehicleId: '',
  driverId: '',
  mechanicId: '',
  serviceId: '',
  maintenanceId: '',
  dueDate: '',
  dueKm: '',
}

export function PendingDialog({
  open,
  onOpenChange,
  mode,
  options,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: PendingMode
  options: PendingFormOptions
  onSaved: () => void | Promise<void>
}) {
  const [form, setForm] = useState<PendingFormValues>(emptyPendingForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setForm({
      ...emptyPendingForm,
      mechanicId: options.currentMechanicId ?? '',
    })
    setError('')
  }, [open, options.currentMechanicId])

  function updateField(field: 'title' | 'description' | 'dueDate' | 'dueKm') {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((current) => ({ ...current, [field]: event.target.value }))
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const response = await fetch(`/api/${mode}/pendencias`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Não foi possível criar a pendência.')
      await onSaved()
      onOpenChange(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível criar a pendência.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>Nova pendência manual</DialogTitle>
          <DialogDescription>
            Registre uma demanda operacional que não seja gerada automaticamente pelo sistema.
          </DialogDescription>
        </DialogHeader>

        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

        <form className="space-y-6" onSubmit={handleSubmit}>
          <section className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Severidade</Label>
                <Select
                  value={form.severity}
                  onValueChange={(severity: PendingFormValues['severity']) => {
                    setForm((current) => ({ ...current, severity }))
                  }}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="atencao">Atenção</SelectItem>
                    <SelectItem value="critica">Crítica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select
                  value={form.type}
                  onValueChange={(type) => setForm((current) => ({ ...current, type }))}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Geral</SelectItem>
                    <SelectItem value="operacional">Operacional</SelectItem>
                    <SelectItem value="seguranca">Segurança</SelectItem>
                    <SelectItem value="documentacao">Documentação</SelectItem>
                    <SelectItem value="outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pending-title">Título</Label>
              <Input id="pending-title" value={form.title} onChange={updateField('title')} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pending-description">Descrição</Label>
              <Textarea
                id="pending-description"
                rows={3}
                value={form.description}
                onChange={updateField('description')}
              />
            </div>
          </section>

          <section className="space-y-4 border-t pt-5">
            <div>
              <h3 className="font-semibold">Vínculo operacional</h3>
              <p className="text-sm text-muted-foreground">
                Selecione pelo menos um registro relacionado à pendência.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <OptionalSelect
                label="Veículo"
                value={form.vehicleId}
                options={options.vehicles}
                onChange={(vehicleId) => setForm((current) => ({ ...current, vehicleId }))}
              />
              <OptionalSelect
                label="Serviço"
                value={form.serviceId}
                options={options.services}
                onChange={(serviceId) => setForm((current) => ({ ...current, serviceId }))}
              />
              <OptionalSelect
                label="Manutenção"
                value={form.maintenanceId}
                options={options.maintenances}
                onChange={(maintenanceId) => setForm((current) => ({ ...current, maintenanceId }))}
              />
              {mode === 'admin' ? (
                <OptionalSelect
                  label="Motorista"
                  value={form.driverId}
                  options={options.drivers}
                  onChange={(driverId) => setForm((current) => ({ ...current, driverId }))}
                />
              ) : null}
              {mode === 'admin' ? (
                <OptionalSelect
                  label="Mecânico"
                  value={form.mechanicId}
                  options={options.mechanics}
                  onChange={(mechanicId) => setForm((current) => ({ ...current, mechanicId }))}
                />
              ) : null}
            </div>
          </section>

          <section className="space-y-4 border-t pt-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pending-due-date">Vencimento por data</Label>
                <Input id="pending-due-date" type="date" value={form.dueDate} onChange={updateField('dueDate')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pending-due-km">Vencimento por KM</Label>
                <Input
                  id="pending-due-km"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.dueKm}
                  onChange={updateField('dueKm')}
                />
              </div>
            </div>
          </section>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Salvando...' : 'Criar pendência'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function OptionalSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: PendingFormOptions['vehicles']
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value || 'none'} onValueChange={(next) => onChange(next === 'none' ? '' : next)}>
        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Não vincular</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
