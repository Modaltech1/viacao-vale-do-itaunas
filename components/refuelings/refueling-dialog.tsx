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
import { brl } from '@/lib/format'
import {
  fuelTypes,
  type RefuelingFormValues,
  type RefuelingListItem,
  type RefuelingLookups,
} from '@/types/refueling'

type RefuelingDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  refueling?: RefuelingListItem | null
  lookups: RefuelingLookups
  onSaved: () => void | Promise<void>
}

function localDateTime(value = new Date().toISOString()) {
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function emptyForm(): RefuelingFormValues {
  return {
    tripId: '',
    vehicleId: '',
    driverId: '',
    registeredAt: localDateTime(),
    registeredKm: '',
    fuelType: 'Diesel S10',
    liters: '',
    unitValue: '',
    totalValue: '',
    notes: '',
  }
}

function formFromRefueling(refueling?: RefuelingListItem | null): RefuelingFormValues {
  if (!refueling) return emptyForm()

  return {
    tripId: refueling.tripId ?? '',
    vehicleId: refueling.vehicleId,
    driverId: refueling.driverId ?? '',
    registeredAt: localDateTime(refueling.registeredAt),
    registeredKm: refueling.registeredKm.toString(),
    fuelType: refueling.fuelType,
    liters: refueling.liters.toString(),
    unitValue: refueling.unitValue?.toString() ?? '',
    totalValue: refueling.totalValue?.toString() ?? '',
    notes: refueling.notes,
  }
}

export function RefuelingDialog({
  open,
  onOpenChange,
  refueling,
  lookups,
  onSaved,
}: RefuelingDialogProps) {
  const [form, setForm] = useState<RefuelingFormValues>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setForm(formFromRefueling(refueling))
    setError('')
  }, [open, refueling])

  const selectedTrip = useMemo(
    () => lookups.trips.find((trip) => trip.id === form.tripId) ?? null,
    [form.tripId, lookups.trips],
  )

  const calculatedTotal = useMemo(() => {
    const liters = Number(form.liters.replace(',', '.'))
    const unitValue = Number(form.unitValue.replace(',', '.'))
    if (!Number.isFinite(liters) || !Number.isFinite(unitValue) || liters <= 0 || unitValue < 0) {
      return null
    }
    return liters * unitValue
  }, [form.liters, form.unitValue])

  function updateField(
    field: 'registeredAt' | 'registeredKm' | 'liters' | 'unitValue' | 'totalValue' | 'notes',
  ) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((current) => ({ ...current, [field]: event.target.value }))
    }
  }

  function selectTrip(tripId: string) {
    if (tripId === 'sem_viagem') {
      setForm((current) => ({
        ...current,
        tripId: '',
        vehicleId: '',
        driverId: '',
        registeredKm: '',
      }))
      return
    }

    const trip = lookups.trips.find((item) => item.id === tripId)
    if (!trip) return

    setForm((current) => ({
      ...current,
      tripId,
      vehicleId: trip.vehicleId,
      driverId: trip.driverId,
      registeredKm: trip.latestRecordedKm.toString(),
    }))
  }

  function selectVehicle(vehicleId: string) {
    const vehicle = lookups.vehicles.find((item) => item.id === vehicleId)
    setForm((current) => ({
      ...current,
      vehicleId,
      registeredKm: vehicle?.currentKm.toString() ?? current.registeredKm,
    }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      const response = await fetch(
        refueling
          ? `/api/admin/abastecimentos/${refueling.id}`
          : '/api/admin/abastecimentos',
        {
          method: refueling ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...form,
            registeredAt: new Date(form.registeredAt).toISOString(),
          }),
        },
      )
      const result = await response.json()

      if (!response.ok) throw new Error(result.error || 'Não foi possível salvar o abastecimento.')

      await onSaved()
      onOpenChange(false)
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Não foi possível salvar o abastecimento.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>{refueling ? 'Editar abastecimento' : 'Novo abastecimento'}</DialogTitle>
          <DialogDescription>
            {refueling
              ? 'Complete ou corrija os dados financeiros sem perder o vínculo operacional registrado.'
              : 'Registre um abastecimento administrativo ou associe-o a uma viagem existente.'}
          </DialogDescription>
        </DialogHeader>

        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

        <form className="space-y-6" onSubmit={handleSubmit}>
          <section className="space-y-4">
            <div>
              <h3 className="font-semibold">Vínculo operacional</h3>
              <p className="text-sm text-muted-foreground">
                Ao selecionar uma viagem, motorista, veículo e KM de referência são preenchidos automaticamente.
              </p>
            </div>

            {refueling ? (
              <div className="border-y py-3 text-sm">
                <p className="font-medium">{refueling.vehicleLabel}</p>
                <p className="text-muted-foreground">
                  {refueling.driverName}
                  {refueling.tripId ? ' · Vinculado a uma viagem' : ' · Registro avulso'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Viagem</Label>
                <Select value={form.tripId || 'sem_viagem'} onValueChange={selectTrip}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sem_viagem">Sem viagem vinculada</SelectItem>
                    {lookups.trips.map((trip) => (
                      <SelectItem key={trip.id} value={trip.id}>
                        {trip.label}{trip.status === 'em_andamento' ? ' · Em andamento' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {!refueling ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Veículo</Label>
                  <Select
                    value={form.vehicleId}
                    onValueChange={selectVehicle}
                    disabled={Boolean(selectedTrip)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione o veículo" />
                    </SelectTrigger>
                    <SelectContent>
                      {lookups.vehicles.map((vehicle) => (
                        <SelectItem key={vehicle.id} value={vehicle.id}>
                          {vehicle.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Motorista</Label>
                  <Select
                    value={form.driverId || 'sem_motorista'}
                    onValueChange={(value) => {
                      setForm((current) => ({
                        ...current,
                        driverId: value === 'sem_motorista' ? '' : value,
                      }))
                    }}
                    disabled={Boolean(selectedTrip)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sem_motorista">Sem motorista</SelectItem>
                      {lookups.drivers.map((driver) => (
                        <SelectItem key={driver.id} value={driver.id}>
                          {driver.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : null}
          </section>

          <section className="space-y-4 border-t pt-5">
            <div>
              <h3 className="font-semibold">Dados do abastecimento</h3>
              <p className="text-sm text-muted-foreground">
                Informações de quilometragem, combustível e volume abastecido.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="refueling-date">Data e hora</Label>
                <Input
                  id="refueling-date"
                  type="datetime-local"
                  value={form.registeredAt}
                  onChange={updateField('registeredAt')}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="refueling-km-admin">KM registrado</Label>
                <Input
                  id="refueling-km-admin"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.registeredKm}
                  onChange={updateField('registeredKm')}
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
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
                    {fuelTypes.map((fuelType) => (
                      <SelectItem key={fuelType} value={fuelType}>{fuelType}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="refueling-liters-admin">Litros</Label>
                <Input
                  id="refueling-liters-admin"
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={form.liters}
                  onChange={updateField('liters')}
                  required
                />
              </div>
            </div>
          </section>

          <section className="space-y-4 border-t pt-5">
            <div>
              <h3 className="font-semibold">Dados financeiros</h3>
              <p className="text-sm text-muted-foreground">
                O valor total é calculado pelo unitário quando não for informado diretamente.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="refueling-unit-value">Valor por litro</Label>
                <Input
                  id="refueling-unit-value"
                  type="number"
                  min="0"
                  step="0.0001"
                  value={form.unitValue}
                  onChange={updateField('unitValue')}
                  placeholder="Opcional"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="refueling-total-value">Valor total</Label>
                <Input
                  id="refueling-total-value"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.totalValue}
                  onChange={updateField('totalValue')}
                  placeholder={calculatedTotal == null ? 'Opcional' : brl(calculatedTotal)}
                />
              </div>
            </div>

            {calculatedTotal != null && !form.totalValue ? (
              <p className="text-sm text-muted-foreground">
                Total calculado: <span className="font-medium text-foreground">{brl(calculatedTotal)}</span>
              </p>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="refueling-notes-admin">Observações</Label>
              <Textarea
                id="refueling-notes-admin"
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
              {saving ? 'Salvando...' : 'Salvar abastecimento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
