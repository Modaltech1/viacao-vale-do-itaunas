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
  Switch,
  Textarea,
} from '@prodexy/ui'
import {
  partCategories,
  partUnits,
  type PartFormValues,
  type PartListItem,
} from '@/types/part'

type PartDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  part?: PartListItem | null
  onSaved: () => void | Promise<void>
}

const emptyForm: PartFormValues = {
  code: '',
  name: '',
  category: 'Outros',
  unit: 'unidade',
  stockQuantity: '0',
  minimumStock: '0',
  unitValue: '0',
  description: '',
  active: true,
}

function formFromPart(part?: PartListItem | null): PartFormValues {
  if (!part) return emptyForm
  return {
    code: part.code,
    name: part.name,
    category: part.category,
    unit: part.unit,
    stockQuantity: part.stockQuantity.toString(),
    minimumStock: part.minimumStock.toString(),
    unitValue: part.unitValue.toString(),
    description: part.description,
    active: part.active,
  }
}

export function PartDialog({ open, onOpenChange, part, onSaved }: PartDialogProps) {
  const [form, setForm] = useState<PartFormValues>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const acceptsFraction = form.unit === 'litro' || form.unit === 'metro'

  useEffect(() => {
    if (!open) return
    setForm(formFromPart(part))
    setError('')
  }, [open, part])

  function updateField(
    field: 'code' | 'name' | 'stockQuantity' | 'minimumStock' | 'unitValue' | 'description',
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
        part ? `/api/admin/pecas/${part.id}` : '/api/admin/pecas',
        {
          method: part ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        },
      )
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Não foi possível salvar a peça.')

      await onSaved()
      onOpenChange(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar a peça.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>{part ? 'Editar peça' : 'Nova peça'}</DialogTitle>
          <DialogDescription>
            Cadastre o item de estoque, seu custo padrão e o limite mínimo operacional.
          </DialogDescription>
        </DialogHeader>

        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

        <form className="space-y-6" onSubmit={handleSubmit}>
          <section className="space-y-4">
            <div>
              <h3 className="font-semibold">Identificação</h3>
              <p className="text-sm text-muted-foreground">
                Código e nome identificam a peça nas manutenções e movimentações.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
              <div className="space-y-2">
                <Label htmlFor="part-code">Código</Label>
                <Input
                  id="part-code"
                  value={form.code}
                  onChange={updateField('code')}
                  placeholder="Ex.: FLT-001"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="part-name">Nome da peça</Label>
                <Input
                  id="part-name"
                  value={form.name}
                  onChange={updateField('name')}
                  placeholder="Ex.: Filtro de óleo"
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select
                  value={form.category}
                  onValueChange={(category: PartFormValues['category']) => {
                    setForm((current) => ({ ...current, category }))
                  }}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {partCategories.map((category) => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Unidade de medida</Label>
                <Select
                  value={form.unit}
                  onValueChange={(unit: PartFormValues['unit']) => {
                    setForm((current) => ({ ...current, unit }))
                  }}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {partUnits.map((unit) => (
                      <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <section className="space-y-4 border-t pt-5">
            <div>
              <h3 className="font-semibold">Estoque e custo</h3>
              <p className="text-sm text-muted-foreground">
                Alterar o saldo gera uma movimentação de ajuste para manter rastreabilidade.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="part-stock">Quantidade atual</Label>
                <Input
                  id="part-stock"
                  type="number"
                  min="0"
                  step={acceptsFraction ? '0.001' : '1'}
                  value={form.stockQuantity}
                  onChange={updateField('stockQuantity')}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="part-minimum">Estoque mínimo</Label>
                <Input
                  id="part-minimum"
                  type="number"
                  min="0"
                  step={acceptsFraction ? '0.001' : '1'}
                  value={form.minimumStock}
                  onChange={updateField('minimumStock')}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="part-value">Valor unitário</Label>
                <Input
                  id="part-value"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.unitValue}
                  onChange={updateField('unitValue')}
                  required
                />
              </div>
            </div>
          </section>

          <section className="space-y-4 border-t pt-5">
            <div className="space-y-2">
              <Label htmlFor="part-description">Descrição</Label>
              <Textarea
                id="part-description"
                rows={3}
                value={form.description}
                onChange={updateField('description')}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="part-active">Peça ativa</Label>
                <p className="text-sm text-muted-foreground">
                  Itens inativos permanecem no histórico, mas não entram em novas manutenções.
                </p>
              </div>
              <Switch
                id="part-active"
                checked={form.active}
                onCheckedChange={(active: boolean) => {
                  setForm((current) => ({ ...current, active }))
                }}
              />
            </div>
          </section>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar peça'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
