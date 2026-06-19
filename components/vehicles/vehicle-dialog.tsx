'use client'

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'
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
import type {
  VehicleDetails,
  VehicleFormOptions,
  VehicleFormValues,
  VehicleListItem,
} from '@/types/vehicle'
import type { VehicleStatus } from '@/types/fleet'
import { vehicleDocumentDefinitions } from '@/lib/vehicle-documents'

type EditableVehicle = VehicleListItem | VehicleDetails

type VehicleDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  vehicle?: EditableVehicle | null
  options: VehicleFormOptions
  onSaved: (vehicleId?: string) => void | Promise<void>
}

const emptyForm: VehicleFormValues = {
  type: '',
  brand: '',
  model: '',
  fleetCode: '',
  plate: '',
  year: '',
  status: 'ativo',
  currentKm: '0',
  capacity: '',
  notes: '',
  routeId: '',
  newRouteName: '',
  newRouteOrigin: '',
  newRouteDestination: '',
  newRouteEstimatedKm: '',
  newRouteNotes: '',
  documentationDueDate: '',
  tachographDueDate: '',
  ceturbDueDate: '',
  aetDueDate: '',
  driverIds: [],
  principalDriverId: '',
}

function documentDate(vehicle: EditableVehicle, code: string) {
  return vehicle.documents.find((document) => document.code === code)?.dueDate ?? ''
}

function formFromVehicle(vehicle?: EditableVehicle | null): VehicleFormValues {
  if (!vehicle) return emptyForm

  return {
    type: vehicle.type,
    brand: vehicle.brand,
    model: vehicle.model,
    fleetCode: vehicle.fleetCode,
    plate: vehicle.plate,
    year: vehicle.year?.toString() ?? '',
    status: vehicle.status,
    currentKm: vehicle.currentKm.toString(),
    capacity: vehicle.capacity,
    notes: vehicle.notes,
    routeId: vehicle.route?.id ?? '',
    newRouteName: '',
    newRouteOrigin: '',
    newRouteDestination: '',
    newRouteEstimatedKm: '',
    newRouteNotes: '',
    documentationDueDate: documentDate(vehicle, 'documentacao'),
    tachographDueDate: documentDate(vehicle, 'tacografo'),
    ceturbDueDate: documentDate(vehicle, 'ceturb'),
    aetDueDate: documentDate(vehicle, 'aet'),
    driverIds: vehicle.drivers.map((driver) => driver.id),
    principalDriverId: vehicle.drivers.find((driver) => driver.principal)?.id ?? '',
  }
}

export function VehicleDialog({
  open,
  onOpenChange,
  vehicle,
  options,
  onSaved,
}: VehicleDialogProps) {
  const [form, setForm] = useState<VehicleFormValues>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setForm(formFromVehicle(vehicle))
    setError('')
  }, [open, vehicle])

  const selectedDrivers = useMemo(
    () => options.drivers.filter((driver) => form.driverIds.includes(driver.id)),
    [form.driverIds, options.drivers],
  )

  function updateField(field: keyof VehicleFormValues) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((current) => ({ ...current, [field]: event.target.value }))
    }
  }

  function toggleDriver(driverId: string, checked: boolean) {
    setForm((current) => {
      const driverIds = checked
        ? [...new Set([...current.driverIds, driverId])]
        : current.driverIds.filter((id) => id !== driverId)

      return {
        ...current,
        driverIds,
        principalDriverId:
          current.principalDriverId === driverId && !checked ? '' : current.principalDriverId,
      }
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      const response = await fetch(vehicle ? `/api/admin/veiculos/${vehicle.id}` : '/api/admin/veiculos', {
        method: vehicle ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const result = await response.json()

      if (!response.ok) throw new Error(result.error || 'Não foi possível salvar o veículo.')

      await onSaved(result.id)
      onOpenChange(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar o veículo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[860px]">
        <DialogHeader>
          <DialogTitle>{vehicle ? 'Editar veículo' : 'Novo veículo'}</DialogTitle>
          <DialogDescription>
            {vehicle
              ? 'Atualize os dados operacionais, a rota fixa e os vencimentos do veículo.'
              : 'Cadastre o veículo, seus vencimentos, a rota fixa e os motoristas vinculados.'}
          </DialogDescription>
        </DialogHeader>

        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

        <form className="space-y-6" onSubmit={handleSubmit}>
          <section className="space-y-4">
            <div>
              <h3 className="font-semibold">Dados do veículo</h3>
              <p className="text-sm text-muted-foreground">
                Identificação e situação operacional atual do ativo.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-2">
                <Label htmlFor="vehicle-type">Tipo</Label>
                <Input
                  id="vehicle-type"
                  placeholder="Ex.: Caminhão"
                  value={form.type}
                  onChange={updateField('type')}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vehicle-brand">Marca</Label>
                <Input
                  id="vehicle-brand"
                  placeholder="Ex.: Scania"
                  value={form.brand}
                  onChange={updateField('brand')}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vehicle-model">Modelo</Label>
                <Input
                  id="vehicle-model"
                  placeholder="Ex.: R 450"
                  value={form.model}
                  onChange={updateField('model')}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vehicle-fleet-code">Frota</Label>
                <Input
                  id="vehicle-fleet-code"
                  placeholder="Ex.: 1027"
                  value={form.fleetCode}
                  onChange={updateField('fleetCode')}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vehicle-plate">Placa</Label>
                <Input
                  id="vehicle-plate"
                  placeholder="ABC-1D23"
                  value={form.plate}
                  onChange={updateField('plate')}
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="vehicle-year">Ano</Label>
                <Input
                  id="vehicle-year"
                  type="number"
                  min="1950"
                  max="2100"
                  value={form.year}
                  onChange={updateField('year')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vehicle-km">KM atual</Label>
                <Input
                  id="vehicle-km"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.currentKm}
                  onChange={updateField('currentKm')}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vehicle-capacity">Capacidade</Label>
                <Input
                  id="vehicle-capacity"
                  placeholder="Ex.: 45 t"
                  value={form.capacity}
                  onChange={updateField('capacity')}
                />
              </div>
              <div className="space-y-2">
                <Label>Status operacional</Label>
                <Select
                  value={form.status}
                  onValueChange={(value: VehicleStatus) => {
                    setForm((current) => ({ ...current, status: value }))
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="em_manutencao">Em manutenção</SelectItem>
                    <SelectItem value="reservado">Reservado</SelectItem>
                    <SelectItem value="indisponivel">Indisponível</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <section className="space-y-4 border-t pt-5">
            <div>
              <h3 className="font-semibold">Rota fixa</h3>
              <p className="text-sm text-muted-foreground">
                Selecione uma rota recorrente ou cadastre uma nova referência operacional.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Rota do veículo</Label>
              <Select
                value={form.routeId || 'none'}
                onValueChange={(value: string) => {
                  setForm((current) => ({ ...current, routeId: value === 'none' ? '' : value }))
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem rota fixa</SelectItem>
                  {options.routes.map((route) => (
                    <SelectItem key={route.id} value={route.id}>
                      {route.name} · {route.origin} → {route.destination}
                    </SelectItem>
                  ))}
                  <SelectItem value="new">Cadastrar nova rota</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.routeId === 'new' ? (
              <div className="space-y-4 border-l-2 border-primary/30 pl-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="route-name">Nome da rota</Label>
                    <Input
                      id="route-name"
                      value={form.newRouteName}
                      onChange={updateField('newRouteName')}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="route-origin">Origem</Label>
                    <Input
                      id="route-origin"
                      value={form.newRouteOrigin}
                      onChange={updateField('newRouteOrigin')}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="route-destination">Destino</Label>
                    <Input
                      id="route-destination"
                      value={form.newRouteDestination}
                      onChange={updateField('newRouteDestination')}
                      required
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
                  <div className="space-y-2">
                    <Label htmlFor="route-km">KM estimado</Label>
                    <Input
                      id="route-km"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.newRouteEstimatedKm}
                      onChange={updateField('newRouteEstimatedKm')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="route-notes">Observações da rota</Label>
                    <Input
                      id="route-notes"
                      value={form.newRouteNotes}
                      onChange={updateField('newRouteNotes')}
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          <section className="space-y-4 border-t pt-5">
            <div>
              <h3 className="font-semibold">Vencimentos</h3>
              <p className="text-sm text-muted-foreground">
                Datas ativas usadas no cálculo automático de pendências.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {vehicleDocumentDefinitions.map(({ code, label, formField }) => (
                <div key={code} className="space-y-2">
                  <Label htmlFor={`vehicle-${code}`}>{label}</Label>
                  <Input
                    id={`vehicle-${code}`}
                    type="date"
                    value={form[formField]}
                    onChange={updateField(formField)}
                    required
                  />
                </div>
              ))}
            </div>
          </section>

          {!vehicle ? (
            <section className="space-y-4 border-t pt-5">
              <div>
                <h3 className="font-semibold">Motoristas vinculados</h3>
                <p className="text-sm text-muted-foreground">
                  Um veículo pode ter vários motoristas, com apenas um vínculo principal.
                </p>
              </div>

              <div className="max-h-52 space-y-1 overflow-y-auto border-y py-1">
                {options.drivers.length ? options.drivers.map((driver) => (
                  <label
                    key={driver.id}
                    className="flex cursor-pointer items-start gap-3 border-b px-2 py-3 last:border-b-0"
                  >
                    <Checkbox
                      checked={form.driverIds.includes(driver.id)}
                      onCheckedChange={(checked: boolean | 'indeterminate') => {
                        toggleDriver(driver.id, checked === true)
                      }}
                    />
                    <span className="min-w-0">
                      <span className="block font-medium">{driver.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {driver.email}
                        {driver.principalVehicleLabel
                          ? ` · Principal em ${driver.principalVehicleLabel}`
                          : ''}
                      </span>
                    </span>
                  </label>
                )) : (
                  <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                    Nenhum motorista disponível.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Motorista principal</Label>
                <Select
                  value={form.principalDriverId || 'none'}
                  onValueChange={(value: string) => {
                    setForm((current) => ({
                      ...current,
                      principalDriverId: value === 'none' ? '' : value,
                    }))
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem motorista principal</SelectItem>
                    {selectedDrivers.map((driver) => (
                      <SelectItem key={driver.id} value={driver.id}>
                        {driver.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </section>
          ) : null}

          <section className="space-y-2 border-t pt-5">
            <Label htmlFor="vehicle-notes">Observações</Label>
            <Textarea
              id="vehicle-notes"
              rows={3}
              value={form.notes}
              onChange={updateField('notes')}
            />
          </section>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar veículo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

type VehicleDriversDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  vehicle: VehicleDetails
  drivers: VehicleFormOptions['drivers']
  onSaved: () => void | Promise<void>
}

export function VehicleDriversDialog({
  open,
  onOpenChange,
  vehicle,
  drivers,
  onSaved,
}: VehicleDriversDialogProps) {
  const [driverIds, setDriverIds] = useState<string[]>([])
  const [principalDriverId, setPrincipalDriverId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setDriverIds(vehicle.drivers.map((driver) => driver.id))
    setPrincipalDriverId(vehicle.drivers.find((driver) => driver.principal)?.id ?? '')
    setError('')
  }, [open, vehicle])

  const selectedDrivers = drivers.filter((driver) => driverIds.includes(driver.id))

  function toggleDriver(driverId: string, checked: boolean) {
    setDriverIds((current) => (
      checked ? [...new Set([...current, driverId])] : current.filter((id) => id !== driverId)
    ))
    if (!checked && principalDriverId === driverId) setPrincipalDriverId('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      const response = await fetch(`/api/admin/veiculos/${vehicle.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: 'drivers',
          driverIds,
          principalDriverId,
        }),
      })
      const result = await response.json()

      if (!response.ok) throw new Error(result.error || 'Não foi possível atualizar os motoristas.')

      await onSaved()
      onOpenChange(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível atualizar os motoristas.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle>Gerenciar motoristas</DialogTitle>
          <DialogDescription>
            Defina os motoristas vinculados à frota {vehicle.fleetCode} e escolha o vínculo principal.
          </DialogDescription>
        </DialogHeader>

        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="max-h-64 space-y-1 overflow-y-auto border-y py-1">
            {drivers.length ? drivers.map((driver) => (
              <label
                key={driver.id}
                className="flex cursor-pointer items-start gap-3 border-b px-2 py-3 last:border-b-0"
              >
                <Checkbox
                  checked={driverIds.includes(driver.id)}
                  onCheckedChange={(checked: boolean | 'indeterminate') => {
                    toggleDriver(driver.id, checked === true)
                  }}
                />
                <span className="min-w-0">
                  <span className="block font-medium">{driver.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {driver.email}
                    {driver.principalVehicleLabel && driver.principalVehicleId !== vehicle.id
                      ? ` · Principal em ${driver.principalVehicleLabel}`
                      : ''}
                  </span>
                </span>
              </label>
            )) : (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                Nenhum motorista cadastrado.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Motorista principal</Label>
            <Select
              value={principalDriverId || 'none'}
              onValueChange={(value: string) => setPrincipalDriverId(value === 'none' ? '' : value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem motorista principal</SelectItem>
                {selectedDrivers.map((driver) => (
                  <SelectItem key={driver.id} value={driver.id}>
                    {driver.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Ao tornar um motorista principal aqui, o vínculo principal anterior dele é rebaixado,
              sem apagar o histórico ou outros vínculos ativos.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar vínculos'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
