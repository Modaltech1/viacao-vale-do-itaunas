'use client'

import { FormEvent, useEffect, useState } from 'react'
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
  Switch,
} from '@prodexy/ui'
import type {
  AdminFormValues,
  AdminListItem,
} from '@/types/admin-management'
import type { AdminLevel } from '@/lib/admin-scope'

type Props = {
  admin?: AdminListItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void | Promise<void>
}

const emptyForm: AdminFormValues = {
  name: '',
  email: '',
  password: '',
  phone: '',
  active: true,
  level: 'restrito',
}

function formFromAdmin(admin?: AdminListItem | null): AdminFormValues {
  if (!admin) return emptyForm
  return {
    name: admin.name,
    email: admin.email,
    password: '',
    phone: admin.phone,
    active: admin.active,
    level: admin.level,
  }
}

export function AdminDialog({
  admin,
  open,
  onOpenChange,
  onSaved,
}: Props) {
  const [form, setForm] = useState<AdminFormValues>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setForm(formFromAdmin(admin))
    setError('')
  }, [admin, open])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      const response = await fetch(
        admin
          ? `/api/admin/administradores/${admin.id}`
          : '/api/admin/administradores',
        {
          method: admin ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        },
      )
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Não foi possível salvar o administrador.')
      }

      await onSaved()
      onOpenChange(false)
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Não foi possível salvar o administrador.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle>
            {admin ? 'Editar administrador' : 'Novo administrador'}
          </DialogTitle>
          <DialogDescription>
            {admin
              ? 'Atualize o acesso e o nível de responsabilidade administrativa.'
              : 'Crie o acesso e defina se o administrador será global ou restrito.'}
          </DialogDescription>
        </DialogHeader>

        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="admin-name">Nome completo</Label>
              <Input
                id="admin-name"
                value={form.name}
                onChange={(event) => {
                  setForm((current) => ({ ...current, name: event.target.value }))
                }}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-email">Email</Label>
              <Input
                id="admin-email"
                type="email"
                value={form.email}
                onChange={(event) => {
                  setForm((current) => ({ ...current, email: event.target.value }))
                }}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-phone">Telefone</Label>
              <Input
                id="admin-phone"
                value={form.phone}
                onChange={(event) => {
                  setForm((current) => ({ ...current, phone: event.target.value }))
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-password">
                {admin ? 'Nova senha' : 'Senha'}
              </Label>
              <Input
                id="admin-password"
                type="password"
                minLength={6}
                placeholder={admin ? 'Mantenha vazio para não alterar' : undefined}
                value={form.password}
                onChange={(event) => {
                  setForm((current) => ({ ...current, password: event.target.value }))
                }}
                required={!admin}
              />
            </div>

            <div className="space-y-2">
              <Label>Nível de acesso</Label>
              <Select
                value={form.level}
                disabled={admin?.current}
                onValueChange={(level: AdminLevel) => {
                  setForm((current) => ({ ...current, level }))
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="restrito">Restrito</SelectItem>
                  <SelectItem value="global">Global</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 border-t pt-4">
            <div>
              <Label htmlFor="admin-active">Acesso ativo</Label>
              <p className="text-sm text-muted-foreground">
                Administradores inativos não conseguem entrar no sistema.
              </p>
            </div>
            <Switch
              id="admin-active"
              checked={form.active}
              disabled={admin?.current}
              onCheckedChange={(active: boolean) => {
                setForm((current) => ({ ...current, active }))
              }}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar administrador'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
