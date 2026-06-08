'use client'

import { useMemo, useState } from 'react'
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@prodexy/ui'
import { PackagePlus, Trash2 } from 'lucide-react'
import { brl, quantity as formatQuantity } from '@/lib/format'
import type { PartUsageFormValue, PartUsageOption } from '@/types/part'

type PartUsageEditorProps = {
  options: PartUsageOption[]
  value: PartUsageFormValue[]
  onChange: (value: PartUsageFormValue[]) => void
  description: string
  emptyMessage: string
  totalLabel: string
}

export function PartUsageEditor({
  options,
  value,
  onChange,
  description,
  emptyMessage,
  totalLabel,
}: PartUsageEditorProps) {
  const [partToAdd, setPartToAdd] = useState('')
  const availableParts = useMemo(
    () => options.filter((part) => !value.some((item) => item.partId === part.id)),
    [options, value],
  )
  const total = value.reduce((sum, item) => {
    const quantity = Number(item.quantity.replace(',', '.'))
    const unitValue = Number(item.unitValue.replace(',', '.'))
    return sum + (
      Number.isFinite(quantity) && Number.isFinite(unitValue)
        ? quantity * unitValue
        : 0
    )
  }, 0)

  function addPart() {
    const part = options.find((item) => item.id === partToAdd)
    if (!part) return
    onChange([
      ...value,
      {
        partId: part.id,
        quantity: '1',
        unitValue: part.unitValue.toString(),
      },
    ])
    setPartToAdd('')
  }

  return (
    <section className="space-y-4 border-t pt-5">
      <div>
        <h3 className="font-semibold">Peças utilizadas</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <Select value={partToAdd} onValueChange={setPartToAdd}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecione uma peça" />
          </SelectTrigger>
          <SelectContent>
            {availableParts.map((part) => (
              <SelectItem key={part.id} value={part.id}>
                {part.code} · {part.name} · {formatQuantity(part.stockQuantity, part.unit)} {part.unit}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          disabled={!partToAdd}
          onClick={addPart}
        >
          <PackagePlus className="size-4" />
          Adicionar
        </Button>
      </div>

      {value.length ? (
        <div className="divide-y border-y">
          {value.map((item, index) => {
            const part = options.find((option) => option.id === item.partId)
            const acceptsFraction = part?.unit === 'litro' || part?.unit === 'metro'
            const quantity = Number(item.quantity.replace(',', '.'))
            const unitValue = Number(item.unitValue.replace(',', '.'))
            return (
              <div key={item.partId} className="space-y-3 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{part?.name ?? 'Peça indisponível'}</p>
                    <p className="text-xs text-muted-foreground">
                      {part?.code} · disponível {formatQuantity(part?.stockQuantity ?? 0, part?.unit)} {part?.unit}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    title="Remover peça"
                    onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_160px]">
                  <div className="space-y-2">
                    <Label htmlFor={`part-quantity-${item.partId}`}>Quantidade</Label>
                    <Input
                      id={`part-quantity-${item.partId}`}
                      type="number"
                      min={acceptsFraction ? '0.001' : '1'}
                      step={acceptsFraction ? '0.001' : '1'}
                      value={item.quantity}
                      onChange={(event) => onChange(value.map((currentPart, itemIndex) => (
                        itemIndex === index
                          ? { ...currentPart, quantity: event.target.value }
                          : currentPart
                      )))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`part-value-${item.partId}`}>Valor unitário</Label>
                    <Input
                      id={`part-value-${item.partId}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unitValue}
                      onChange={(event) => onChange(value.map((currentPart, itemIndex) => (
                        itemIndex === index
                          ? { ...currentPart, unitValue: event.target.value }
                          : currentPart
                      )))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Total</Label>
                    <div className="flex h-10 items-center font-semibold">
                      {brl(
                        Number.isFinite(quantity) && Number.isFinite(unitValue)
                          ? quantity * unitValue
                          : 0,
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="border-y py-6 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      )}

      <div className="flex items-center justify-between border-b pb-5">
        <span className="text-sm text-muted-foreground">{totalLabel}</span>
        <span className="text-lg font-semibold">{brl(total)}</span>
      </div>
    </section>
  )
}
