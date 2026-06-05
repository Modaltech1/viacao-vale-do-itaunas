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
import { ManagedUserFields } from '@/components/users/managed-user-fields'
import type {
  DriverDetails,
  DriverFormValues,
  DriverListItem,
  DriverProfessionalStatus,
  DriverVehicleOption,
} from '@/types/driver'

type EditableDriver = DriverListItem | DriverDetails

type DriverDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  driver?: EditableDriver | null
  vehicles: DriverVehicleOption[]
  onSaved: (driverId?: string) => void | Promise<void>
}

const emptyForm: DriverFormValues = {
  name: '',
  email: '',
  password: '',
  phone: '',
  cpf: '',
  address: '',
  licenseNumber: '',
  licenseCategory: '',
  licenseDueDate: '',
  professionalStatus: 'ativo',
  accessActive: true,
  notes: '',
  vehicleId: '',
}

function formFromDriver(driver?: EditableDriver | null): DriverFormValues {
  if (!driver) return emptyForm

  return {
    name: driver.name,
    email: driver.email,
    password: '',
    phone: driver.phone,
    cpf: driver.cpf,
    address: driver.address,
    licenseNumber: driver.licenseNumber,
    licenseCategory: driver.licenseCategory,
    licenseDueDate: driver.licenseDueDate,
    professionalStatus: driver.professionalStatus,
    accessActive: driver.accessActive,
    notes: driver.notes,
    vehicleId: driver.vehicle?.id ?? '',
  }
}

export function DriverDialog({
  open,
  onOpenChange,
  driver,
  vehicles,
  onSaved,
}: DriverDialogProps) {
  const [form, setForm] = useState<DriverFormValues>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setForm(formFromDriver(driver))
    setError('')
  }, [driver, open])

  function updateField(field: keyof DriverFormValues) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((current) => ({ ...current, [field]: event.target.value }))
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      const response = await fetch(driver ? `/api/admin/motoristas/${driver.id}` : '/api/admin/motoristas', {
        method: driver ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Não foi possível salvar o motorista.')
      }

      await onSaved(result.id)
      onOpenChange(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar o motorista.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle>{driver ? 'Editar motorista' : 'Novo motorista'}</DialogTitle>
          <DialogDescription>
            {driver
              ? 'Atualize o acesso, os dados profissionais e o vínculo operacional do motorista.'
              : 'Crie o acesso do motorista e complete o cadastro profissional no mesmo fluxo.'}
          </DialogDescription>
        </DialogHeader>

        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

        <form className="space-y-6" onSubmit={handleSubmit}>
          <ManagedUserFields
            form={form}
            editing={Boolean(driver)}
            idPrefix="driver"
            onChange={setForm}
          />

          <section className="space-y-4 border-t pt-5">
            <div>
              <h3 className="font-semibold">Dados profissionais</h3>
              <p className="text-sm text-muted-foreground">Cadastro operacional, habilitação e situação do motorista.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="driver-cpf">CPF</Label>
                <Input
                  id="driver-cpf"
                  placeholder="000.000.000-00"
                  value={form.cpf}
                  onChange={updateField('cpf')}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="driver-address">Endereço</Label>
                <Input id="driver-address" value={form.address} onChange={updateField('address')} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="driver-license">Número da CNH</Label>
                <Input
                  id="driver-license"
                  value={form.licenseNumber}
                  onChange={updateField('licenseNumber')}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="driver-category">Categoria</Label>
                <Input
                  id="driver-category"
                  placeholder="Ex.: D"
                  value={form.licenseCategory}
                  onChange={updateField('licenseCategory')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="driver-license-due">Validade da CNH</Label>
                <Input
                  id="driver-license-due"
                  type="date"
                  value={form.licenseDueDate}
                  onChange={updateField('licenseDueDate')}
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Status profissional</Label>
                <Select
                  value={form.professionalStatus}
                  onValueChange={(value: DriverProfessionalStatus) => {
                    setForm((current) => ({ ...current, professionalStatus: value }))
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="afastado">Afastado</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Veículo vinculado</Label>
                <Select
                  value={form.vehicleId || 'none'}
                  onValueChange={(value: string) => {
                    setForm((current) => ({ ...current, vehicleId: value === 'none' ? '' : value }))
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sem veículo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem veículo vinculado</SelectItem>
                    {vehicles.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        {vehicle.label}
                        {vehicle.currentDriverName ? ` · Principal: ${vehicle.currentDriverName}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Um veículo pode ter mais de um motorista ativo.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="driver-notes">Observações</Label>
              <Textarea
                id="driver-notes"
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
              {saving ? 'Salvando...' : 'Salvar motorista'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

type DriverVehicleDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  driver: DriverDetails
  vehicles: DriverVehicleOption[]
  onSaved: () => void | Promise<void>
}

export function DriverVehicleDialog({
  open,
  onOpenChange,
  driver,
  vehicles,
  onSaved,
}: DriverVehicleDialogProps) {
  const [vehicleId, setVehicleId] = useState(driver.vehicle?.id ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setVehicleId(driver.vehicle?.id ?? '')
    setError('')
  }, [driver, open])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      const response = await fetch(`/api/admin/motoristas/${driver.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formFromDriver(driver),
          vehicleId,
        }),
      })
      const result = await response.json()

      if (!response.ok) throw new Error(result.error || 'Não foi possível alterar o veículo.')

      await onSaved()
      onOpenChange(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível alterar o veículo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Alterar veículo vinculado</DialogTitle>
          <DialogDescription>
            Defina o veículo operacional atual de {driver.name}. O mesmo veículo pode permanecer vinculado a outros motoristas.
          </DialogDescription>
        </DialogHeader>

        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label>Veículo</Label>
            <Select value={vehicleId || 'none'} onValueChange={(value: string) => setVehicleId(value === 'none' ? '' : value)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem veículo vinculado</SelectItem>
                {vehicles.map((vehicle) => (
                  <SelectItem key={vehicle.id} value={vehicle.id}>
                    {vehicle.label}
                    {vehicle.currentDriverName ? ` · Principal: ${vehicle.currentDriverName}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar vínculo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
