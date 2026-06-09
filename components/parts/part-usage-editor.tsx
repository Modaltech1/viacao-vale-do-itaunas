'use client'

import { Input, Label } from '@prodexy/ui'
import { PackagePlus } from 'lucide-react'
import { PricedItemsEditor } from '@/components/shared/priced-items-editor'
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
  return (
    <PricedItemsEditor
      title="Peças utilizadas"
      description={description}
      options={options}
      value={value}
      onChange={onChange}
      addIcon={PackagePlus}
      selectPlaceholder="Selecione uma peça"
      emptyMessage={emptyMessage}
      totalLabel={totalLabel}
      removeLabel="Remover peça"
      unavailableLabel="Peça indisponível"
      getOptionId={(part) => part.id}
      getValueId={(item) => item.partId}
      createValue={(part) => ({
        partId: part.id,
        quantity: '1',
        unitValue: part.unitValue.toString(),
      })}
      getOptionLabel={(part) => (
        <>{part.code} · {part.name} · {formatQuantity(part.stockQuantity, part.unit)} {part.unit}</>
      )}
      getItemTitle={(part) => part?.name ?? 'Peça indisponível'}
      getItemSubtitle={(part) => part
        ? `${part.code} · disponível ${formatQuantity(part.stockQuantity, part.unit)} ${part.unit}`
        : null}
      getItemTotal={(item) => {
        const quantity = Number(item.quantity.replace(',', '.'))
        const unitValue = Number(item.unitValue.replace(',', '.'))
        return Number.isFinite(quantity) && Number.isFinite(unitValue)
          ? quantity * unitValue
          : 0
      }}
      renderFields={({ item, option: part, update }) => {
        const acceptsFraction = part?.unit === 'litro' || part?.unit === 'metro'
        const quantity = Number(item.quantity.replace(',', '.'))
        const unitValue = Number(item.unitValue.replace(',', '.'))
        return (
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_160px]">
            <div className="space-y-2">
              <Label htmlFor={`part-quantity-${item.partId}`}>Quantidade</Label>
              <Input
                id={`part-quantity-${item.partId}`}
                type="number"
                min={acceptsFraction ? '0.001' : '1'}
                step={acceptsFraction ? '0.001' : '1'}
                value={item.quantity}
                onChange={(event) => update({ quantity: event.target.value })}
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
                onChange={(event) => update({ unitValue: event.target.value })}
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
        )
      }}
    />
  )
}
