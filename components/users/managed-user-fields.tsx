'use client'

import { ChangeEvent } from 'react'
import { Checkbox, Input, Label } from '@prodexy/ui'
import type { ManagedUserFormValues } from '@/types/managed-user'

type Props<T extends ManagedUserFormValues> = {
  form: T
  editing: boolean
  idPrefix: string
  accessDisabled?: boolean
  onChange: (values: T) => void
}

export function ManagedUserFields<T extends ManagedUserFormValues>({
  form,
  editing,
  idPrefix,
  accessDisabled = false,
  onChange,
}: Props<T>) {
  function updateText(field: keyof Pick<ManagedUserFormValues, 'name' | 'email' | 'password' | 'phone'>) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      onChange({ ...form, [field]: event.target.value })
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h3 className="font-semibold">Acesso ao sistema</h3>
        <p className="text-sm text-muted-foreground">Dados necessários do usuário.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-name`}>Nome completo</Label>
          <Input id={`${idPrefix}-name`} value={form.name} onChange={updateText('name')} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-phone`}>Telefone</Label>
          <Input
            id={`${idPrefix}-phone`}
            placeholder="(27) 99999-9999"
            value={form.phone}
            onChange={updateText('phone')}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-email`}>Email</Label>
          <Input
            id={`${idPrefix}-email`}
            type="email"
            autoComplete="off"
            value={form.email}
            onChange={updateText('email')}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-password`}>
            {editing ? 'Nova senha (opcional)' : 'Senha'}
          </Label>
          <Input
            id={`${idPrefix}-password`}
            type="password"
            autoComplete="new-password"
            minLength={6}
            value={form.password}
            onChange={updateText('password')}
            required={!editing}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Checkbox
          id={`${idPrefix}-access`}
          checked={form.accessActive}
          disabled={accessDisabled}
          onCheckedChange={(checked: boolean | 'indeterminate') => {
            onChange({ ...form, accessActive: checked === true })
          }}
        />
        <Label htmlFor={`${idPrefix}-access`} className="font-normal">
          Permitir acesso ao sistema
        </Label>
      </div>
    </section>
  )
}
