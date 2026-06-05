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
  MechanicDetails,
  MechanicFormValues,
  MechanicListItem,
  MechanicProfessionalStatus,
} from '@/types/mechanic'

type EditableMechanic = MechanicListItem | MechanicDetails

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mechanic?: EditableMechanic | null
  onSaved: (mechanicId?: string) => void | Promise<void>
}

const emptyForm: MechanicFormValues = {
  name: '',
  email: '',
  password: '',
  phone: '',
  accessActive: true,
  specialty: '',
  professionalStatus: 'ativo',
  notes: '',
}

function formFromMechanic(mechanic?: EditableMechanic | null): MechanicFormValues {
  if (!mechanic) return emptyForm

  return {
    name: mechanic.name,
    email: mechanic.email,
    password: '',
    phone: mechanic.phone,
    accessActive: mechanic.accessActive,
    specialty: mechanic.specialty,
    professionalStatus: mechanic.professionalStatus,
    notes: mechanic.notes,
  }
}

export function MechanicDialog({
  open,
  onOpenChange,
  mechanic,
  onSaved,
}: Props) {
  const [form, setForm] = useState<MechanicFormValues>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setForm(formFromMechanic(mechanic))
    setError('')
  }, [mechanic, open])

  function updateField(field: keyof Pick<MechanicFormValues, 'specialty' | 'notes'>) {
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
        mechanic ? `/api/admin/mecanicos/${mechanic.id}` : '/api/admin/mecanicos',
        {
          method: mechanic ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        },
      )
      const result = await response.json()

      if (!response.ok) throw new Error(result.error || 'Não foi possível salvar o mecânico.')

      await onSaved(result.id)
      onOpenChange(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar o mecânico.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle>{mechanic ? 'Editar mecânico' : 'Novo mecânico'}</DialogTitle>
          <DialogDescription>
            {mechanic
              ? 'Atualize o acesso e os dados profissionais do mecânico.'
              : 'Crie o acesso do mecânico e complete o cadastro profissional no mesmo fluxo.'}
          </DialogDescription>
        </DialogHeader>

        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

        <form className="space-y-6" onSubmit={handleSubmit}>
          <ManagedUserFields
            form={form}
            editing={Boolean(mechanic)}
            idPrefix="mechanic"
            onChange={setForm}
          />

          <section className="space-y-4 border-t pt-5">
            <div>
              <h3 className="font-semibold">Dados profissionais</h3>
              <p className="text-sm text-muted-foreground">
                Especialidade, situação profissional e observações operacionais.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="mechanic-specialty">Especialidade</Label>
                <Input
                  id="mechanic-specialty"
                  placeholder="Ex.: Freios e suspensão"
                  value={form.specialty}
                  onChange={updateField('specialty')}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Status profissional</Label>
                <Select
                  value={form.professionalStatus}
                  onValueChange={(value: MechanicProfessionalStatus) => {
                    setForm((current) => ({ ...current, professionalStatus: value }))
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mechanic-notes">Observações</Label>
              <Textarea
                id="mechanic-notes"
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
              {saving ? 'Salvando...' : 'Salvar mecânico'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
