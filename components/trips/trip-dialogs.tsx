'use client'

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'
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
  ConcludeTripFormValues,
  TripDetails,
  TripFormOptions,
  TripFormValues,
  TripListItem,
} from '@/types/trip'
import { tripFinalKmMinimum, tripFinalKmSuggestion } from '@/lib/trip-km'

function localDateTime(value = new Date().toISOString()) {
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

const emptyTripForm: TripFormValues = {
  driverId: '',
  vehicleId: '',
  origin: '',
  destination: '',
  startedAt: '',
  initialKm: '',
  finishedAt: '',
  finalKm: '',
  notes: '',
}

type TripDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  options: TripFormOptions
  trip?: TripListItem | TripDetails | null
  onSaved: (tripId?: string) => void | Promise<void>
}

export function TripDialog({
  open,
  onOpenChange,
  options,
  trip,
  onSaved,
}: TripDialogProps) {
  const [form, setForm] = useState<TripFormValues>(emptyTripForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setForm(trip
      ? {
          driverId: trip.driverId,
          vehicleId: trip.vehicleId,
          origin: trip.origin,
          destination: trip.destination,
          startedAt: localDateTime(trip.startedAt),
          initialKm: trip.initialKm.toString(),
          finishedAt: trip.finishedAt ? localDateTime(trip.finishedAt) : '',
          finalKm: trip.finalKm?.toString() ?? '',
          notes: trip.notes,
        }
      : { ...emptyTripForm, startedAt: localDateTime() })
    setError('')
  }, [open, trip])

  const selectedVehicle = useMemo(
    () => options.vehicles.find((vehicle) => vehicle.id === form.vehicleId) ?? null,
    [form.vehicleId, options.vehicles],
  )
  const temporaryVehicle = Boolean(
    selectedVehicle
    && form.driverId
    && !selectedVehicle.linkedDriverIds.includes(form.driverId),
  )
  const minimumFinalKm = trip
    ? tripFinalKmMinimum(
        trip.initialKm,
        'latestRecordedKm' in trip ? trip.latestRecordedKm : trip.initialKm,
      )
    : 0

  function updateField(
    field: 'origin' | 'destination' | 'startedAt' | 'initialKm' | 'finishedAt' | 'finalKm' | 'notes',
  ) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((current) => ({ ...current, [field]: event.target.value }))
    }
  }

  function selectVehicle(vehicleId: string) {
    const vehicle = options.vehicles.find((item) => item.id === vehicleId)
    setForm((current) => ({
      ...current,
      vehicleId,
      origin: vehicle?.routeOrigin ?? '',
      destination: vehicle?.routeDestination ?? '',
      initialKm: vehicle?.currentKm.toString() ?? '',
    }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      const response = await fetch(
        trip ? `/api/admin/viagens/${trip.id}` : '/api/admin/viagens',
        {
          method: trip ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...form,
            startedAt: form.startedAt
              ? new Date(form.startedAt).toISOString()
              : undefined,
            finishedAt: form.finishedAt
              ? new Date(form.finishedAt).toISOString()
              : undefined,
          }),
        },
      )
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Não foi possível salvar a viagem.')

      await onSaved(result.id)
      onOpenChange(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar a viagem.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>{trip ? 'Editar viagem' : 'Nova viagem'}</DialogTitle>
          <DialogDescription>
            {trip
              ? 'Atualize a rota, observações e, quando permitido, corrija o encerramento operacional.'
              : 'Inicie uma viagem administrativa com motorista, veículo e snapshot da rota.'}
          </DialogDescription>
        </DialogHeader>

        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

        <form className="space-y-6" onSubmit={handleSubmit}>
          {!trip ? (
            <section className="space-y-4">
              <div>
                <h3 className="font-semibold">Operação</h3>
                <p className="text-sm text-muted-foreground">
                  A viagem será criada em andamento e bloqueará novas viagens simultâneas.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Motorista</Label>
                  <Select
                    value={form.driverId}
                    onValueChange={(driverId) => {
                      setForm((current) => ({ ...current, driverId }))
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione o motorista" />
                    </SelectTrigger>
                    <SelectContent>
                      {options.drivers.map((driver) => (
                        <SelectItem key={driver.id} value={driver.id}>{driver.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Veículo</Label>
                  <Select value={form.vehicleId} onValueChange={selectVehicle}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione o veículo" />
                    </SelectTrigger>
                    <SelectContent>
                      {options.vehicles.map((vehicle) => (
                        <SelectItem
                          key={vehicle.id}
                          value={vehicle.id}
                          disabled={['em_manutencao', 'inativo', 'indisponivel'].includes(vehicle.status)}
                        >
                          {vehicle.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {temporaryVehicle ? (
                <p className="border-l-2 border-amber-500 pl-3 text-sm text-amber-700">
                  Este motorista não possui vínculo ativo com o veículo. A viagem será registrada como uso temporário.
                </p>
              ) : null}
            </section>
          ) : (
            <section className="border-y py-4 text-sm">
              <p className="font-medium">{trip.driverName}</p>
              <p className="text-muted-foreground">{trip.vehicleLabel}</p>
            </section>
          )}

          <section className="space-y-4 border-t pt-5">
            <div>
              <h3 className="font-semibold">Rota da viagem</h3>
              <p className="text-sm text-muted-foreground">
                Origem e destino ficam gravados como snapshot e não mudam com a rota fixa.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="trip-admin-origin">Origem</Label>
                <Input
                  id="trip-admin-origin"
                  value={form.origin}
                  onChange={updateField('origin')}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trip-admin-destination">Destino</Label>
                <Input
                  id="trip-admin-destination"
                  value={form.destination}
                  onChange={updateField('destination')}
                  required
                />
              </div>
            </div>

            {!trip ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="trip-admin-started-at">Saída</Label>
                  <Input
                    id="trip-admin-started-at"
                    type="datetime-local"
                    value={form.startedAt}
                    onChange={updateField('startedAt')}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="trip-admin-initial-km">KM inicial</Label>
                  <Input
                    id="trip-admin-initial-km"
                    type="number"
                    min={selectedVehicle?.currentKm ?? 0}
                    step="0.01"
                    value={form.initialKm}
                    onChange={updateField('initialKm')}
                    required
                  />
                </div>
              </div>
            ) : null}

            {trip?.status === 'concluida' ? (
              <section className="space-y-4 border-t pt-5">
                <div>
                  <h3 className="font-semibold">Correção de encerramento</h3>
                  <p className="text-sm text-muted-foreground">
                    Disponível apenas para correções que preservem a sequência operacional do veículo.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="trip-admin-finished-at">Chegada</Label>
                    <Input
                      id="trip-admin-finished-at"
                      type="datetime-local"
                      value={form.finishedAt}
                      onChange={updateField('finishedAt')}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="trip-admin-final-km">KM final</Label>
                    <Input
                      id="trip-admin-final-km"
                      type="number"
                      min={minimumFinalKm}
                      step="0.01"
                      value={form.finalKm}
                      onChange={updateField('finalKm')}
                      required
                    />
                  </div>
                </div>
              </section>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="trip-admin-notes">Observações</Label>
              <Textarea
                id="trip-admin-notes"
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
              {saving ? 'Salvando...' : trip ? 'Salvar alterações' : 'Iniciar viagem'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ConcludeTripDialog({
  open,
  onOpenChange,
  trip,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  trip: TripDetails
  onSaved: () => void | Promise<void>
}) {
  const [form, setForm] = useState<ConcludeTripFormValues>({
    finishedAt: '',
    finalKm: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const minimumFinalKm = tripFinalKmMinimum(trip.initialKm, trip.latestRecordedKm)

  useEffect(() => {
    if (!open) return
    setForm({
      finishedAt: localDateTime(),
      finalKm: tripFinalKmSuggestion(trip.initialKm, trip.latestRecordedKm),
      notes: trip.notes,
    })
    setError('')
  }, [open, trip])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      const response = await fetch(`/api/admin/viagens/${trip.id}/concluir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          finishedAt: new Date(form.finishedAt).toISOString(),
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Não foi possível concluir a viagem.')

      await onSaved()
      onOpenChange(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível concluir a viagem.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Concluir viagem</DialogTitle>
          <DialogDescription>
            O KM final deve ser maior que o inicial e atualizará o veículo de forma transacional.
          </DialogDescription>
        </DialogHeader>

        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="trip-finished-at">Chegada</Label>
              <Input
                id="trip-finished-at"
                type="datetime-local"
                value={form.finishedAt}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  finishedAt: event.target.value,
                }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trip-final-km">KM final</Label>
              <Input
                id="trip-final-km"
                type="number"
                min={minimumFinalKm}
                step="0.01"
                value={form.finalKm}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  finalKm: event.target.value,
                }))}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="trip-conclusion-notes">Observações finais</Label>
            <Textarea
              id="trip-conclusion-notes"
              rows={3}
              value={form.notes}
              onChange={(event) => setForm((current) => ({
                ...current,
                notes: event.target.value,
              }))}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Concluindo...' : 'Concluir viagem'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function RemoveTripDialog({
  open,
  onOpenChange,
  trip,
  onRemoved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  trip: TripDetails
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
      const response = await fetch(`/api/admin/viagens/${trip.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Não foi possível remover a viagem.')

      await onRemoved()
      onOpenChange(false)
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Não foi possível remover a viagem.')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Remover viagem</DialogTitle>
          <DialogDescription>
            Esta ação é definitiva. Abastecimentos e despesas da viagem também serão removidos,
            e as peças consumidas nessas despesas retornarão ao estoque.
          </DialogDescription>
        </DialogHeader>

        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="trip-removal-reason">Motivo da remoção</Label>
            <Textarea
              id="trip-removal-reason"
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Descreva por que esta viagem deve ser removida"
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
              {removing ? 'Removendo...' : 'Remover viagem'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
