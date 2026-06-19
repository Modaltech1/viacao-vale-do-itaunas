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
  DriverPortalTrip,
  EndTripFormValues,
  ExpenseFormValues,
  RefuelingFormValues,
} from '@/types/driver-portal'
import { tripFinalKmMinimum, tripFinalKmSuggestion } from '@/lib/trip-km'

type OperationDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  trip: DriverPortalTrip
  onSaved: () => void | Promise<void>
}

async function readResponse(response: Response) {
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(result.error || 'Não foi possível concluir a operação.')
  }
}

const emptyRefueling: RefuelingFormValues = {
  registeredKm: '',
  fuelType: 'Diesel S10',
  liters: '',
  notes: '',
}

export function RefuelingDialog({
  open,
  onOpenChange,
  trip,
  onSaved,
}: OperationDialogProps) {
  const [form, setForm] = useState<RefuelingFormValues>(emptyRefueling)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setForm({
      ...emptyRefueling,
      registeredKm: trip.latestRecordedKm.toString(),
    })
    setError('')
  }, [open, trip])

  function updateField(field: 'registeredKm' | 'liters' | 'notes') {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((current) => ({ ...current, [field]: event.target.value }))
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      const response = await fetch(`/api/driver/viagens/${trip.id}/abastecimentos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      await readResponse(response)

      await onSaved()
      onOpenChange(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível registrar o abastecimento.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Registrar abastecimento</DialogTitle>
          <DialogDescription>
            Registre os dados operacionais da viagem. O valor financeiro será complementado pelo administrador.
          </DialogDescription>
        </DialogHeader>

        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="refueling-km">KM atual</Label>
              <Input
                id="refueling-km"
                type="number"
                min={trip.initialKm}
                step="0.01"
                value={form.registeredKm}
                onChange={updateField('registeredKm')}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="refueling-liters">Litros abastecidos</Label>
              <Input
                id="refueling-liters"
                type="number"
                min="0.001"
                step="0.001"
                value={form.liters}
                onChange={updateField('liters')}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Combustível</Label>
            <Select
              value={form.fuelType}
              onValueChange={(value: RefuelingFormValues['fuelType']) => {
                setForm((current) => ({ ...current, fuelType: value }))
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Diesel S10">Diesel S10</SelectItem>
                <SelectItem value="Diesel S500">Diesel S500</SelectItem>
                <SelectItem value="ARLA">ARLA</SelectItem>
                <SelectItem value="Gasolina">Gasolina</SelectItem>
                <SelectItem value="Etanol">Etanol</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="refueling-notes">Observação</Label>
            <Textarea
              id="refueling-notes"
              rows={3}
              value={form.notes}
              onChange={updateField('notes')}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Registrando...' : 'Registrar abastecimento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const emptyExpense: ExpenseFormValues = {
  category: 'Pedágio',
  value: '',
  notes: '',
}

export function ExpenseDialog({
  open,
  onOpenChange,
  trip,
  onSaved,
}: OperationDialogProps) {
  const [form, setForm] = useState<ExpenseFormValues>(emptyExpense)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setForm(emptyExpense)
    setError('')
  }, [open])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      const response = await fetch(`/api/driver/viagens/${trip.id}/despesas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      await readResponse(response)

      await onSaved()
      onOpenChange(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível registrar a despesa.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Registrar despesa</DialogTitle>
          <DialogDescription>
            Informe a categoria e o valor da despesa realizada durante a viagem.
          </DialogDescription>
        </DialogHeader>

        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select
              value={form.category}
              onValueChange={(value: ExpenseFormValues['category']) => {
                setForm((current) => ({ ...current, category: value }))
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Pedágio">Pedágio</SelectItem>
                <SelectItem value="Alimentação">Alimentação</SelectItem>
                <SelectItem value="Hospedagem">Hospedagem</SelectItem>
                <SelectItem value="Descarga">Descarga</SelectItem>
                <SelectItem value="Outros">Outros</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expense-value">Valor</Label>
            <Input
              id="expense-value"
              type="number"
              min="0.01"
              step="0.01"
              value={form.value}
              onChange={(event) => {
                setForm((current) => ({ ...current, value: event.target.value }))
              }}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expense-notes">Observação</Label>
            <Textarea
              id="expense-notes"
              rows={3}
              value={form.notes}
              onChange={(event) => {
                setForm((current) => ({ ...current, notes: event.target.value }))
              }}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Registrando...' : 'Registrar despesa'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function EndTripDialog({
  open,
  onOpenChange,
  trip,
  onSaved,
}: OperationDialogProps) {
  const [form, setForm] = useState<EndTripFormValues>({ finalKm: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const minimumFinalKm = tripFinalKmMinimum(trip.initialKm, trip.latestRecordedKm)

  useEffect(() => {
    if (!open) return
    setForm({
      finalKm: tripFinalKmSuggestion(trip.initialKm, trip.latestRecordedKm),
      notes: '',
    })
    setError('')
  }, [open, trip])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      const response = await fetch(`/api/driver/viagens/${trip.id}/concluir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      await readResponse(response)

      await onSaved()
      onOpenChange(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível encerrar a viagem.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Encerrar viagem</DialogTitle>
          <DialogDescription>
            O KM final deve ser maior que o inicial e atualizará a quilometragem atual do veículo.
          </DialogDescription>
        </DialogHeader>

        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="end-trip-km">KM final</Label>
            <Input
              id="end-trip-km"
              type="number"
              min={minimumFinalKm}
              step="0.01"
              value={form.finalKm}
              onChange={(event) => {
                setForm((current) => ({ ...current, finalKm: event.target.value }))
              }}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="end-trip-notes">Observação final</Label>
            <Textarea
              id="end-trip-notes"
              rows={3}
              value={form.notes}
              onChange={(event) => {
                setForm((current) => ({ ...current, notes: event.target.value }))
              }}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" variant="destructive" disabled={saving}>
              {saving ? 'Encerrando...' : 'Encerrar viagem'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
