'use client'

import { useState, type ReactNode } from 'react'
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@prodexy/ui'
import { Trash2, type LucideIcon } from 'lucide-react'
import { brl } from '@/lib/format'

export type PricedItemFieldContext<TValue, TOption> = {
  item: TValue
  option?: TOption
  index: number
  update: (patch: Partial<TValue>) => void
}

type PricedItemsEditorProps<TValue, TOption> = {
  title: string
  description: string
  options: TOption[]
  value: TValue[]
  onChange: (value: TValue[]) => void
  addIcon: LucideIcon
  selectPlaceholder: string
  emptyMessage: string
  totalLabel: string
  removeLabel: string
  unavailableLabel: string
  getOptionId: (option: TOption) => string
  getValueId: (item: TValue) => string
  createValue: (option: TOption) => TValue
  getOptionLabel: (option: TOption) => ReactNode
  getItemTitle: (option?: TOption) => ReactNode
  getItemSubtitle?: (option?: TOption) => ReactNode
  getItemTotal: (item: TValue) => number
  renderFields: (context: PricedItemFieldContext<TValue, TOption>) => ReactNode
  itemClassName?: string
}

export function PricedItemsEditor<TValue, TOption>({
  title,
  description,
  options,
  value,
  onChange,
  addIcon: AddIcon,
  selectPlaceholder,
  emptyMessage,
  totalLabel,
  removeLabel,
  unavailableLabel,
  getOptionId,
  getValueId,
  createValue,
  getOptionLabel,
  getItemTitle,
  getItemSubtitle,
  getItemTotal,
  renderFields,
  itemClassName = 'space-y-3',
}: PricedItemsEditorProps<TValue, TOption>) {
  const [itemToAdd, setItemToAdd] = useState('')
  const optionById = new Map(options.map((option) => [getOptionId(option), option]))
  const selectedIds = new Set(value.map(getValueId))
  const availableOptions = options.filter((option) => !selectedIds.has(getOptionId(option)))
  const total = value.reduce((sum, item) => sum + getItemTotal(item), 0)

  function addItem() {
    const option = optionById.get(itemToAdd)
    if (!option) return
    onChange([...value, createValue(option)])
    setItemToAdd('')
  }

  function updateItem(index: number, patch: Partial<TValue>) {
    onChange(value.map((item, itemIndex) => (
      itemIndex === index ? { ...item, ...patch } : item
    )))
  }

  return (
    <section className="space-y-4 border-t pt-5">
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <Select value={itemToAdd} onValueChange={setItemToAdd}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={selectPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {availableOptions.map((option) => (
              <SelectItem key={getOptionId(option)} value={getOptionId(option)}>
                {getOptionLabel(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          disabled={!itemToAdd}
          onClick={addItem}
        >
          <AddIcon className="size-4" />
          Adicionar
        </Button>
      </div>

      {value.length ? (
        <div className="divide-y border-y">
          {value.map((item, index) => {
            const itemId = getValueId(item)
            const option = optionById.get(itemId)
            return (
              <div key={itemId} className={`${itemClassName} py-4`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{option ? getItemTitle(option) : unavailableLabel}</p>
                    {getItemSubtitle ? (
                      <p className="text-xs text-muted-foreground">{getItemSubtitle(option)}</p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    title={removeLabel}
                    onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                {renderFields({
                  item,
                  option,
                  index,
                  update: (patch) => updateItem(index, patch),
                })}
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
