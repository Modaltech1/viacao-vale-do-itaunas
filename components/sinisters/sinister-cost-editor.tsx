'use client'

import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@prodexy/ui'
import { Plus, Trash2 } from 'lucide-react'
import { brl } from '@/lib/format'
import {
  sinisterCostCategories,
  sinisterCostCategoryLabel,
  type SinisterCostFormValue,
} from '@/types/sinister'

type SinisterCostEditorProps = {
  value: SinisterCostFormValue[]
  onChange: (value: SinisterCostFormValue[]) => void
}

function localId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function newCost(): SinisterCostFormValue {
  return {
    localId: localId(),
    category: 'outros',
    description: '',
    quantity: '1',
    unitValue: '',
    receiptPath: '',
  }
}

function costTotal(cost: SinisterCostFormValue) {
  const quantity = Number(cost.quantity.replace(',', '.'))
  const unitValue = Number(cost.unitValue.replace(',', '.'))
  return Number.isFinite(quantity) && Number.isFinite(unitValue) ? quantity * unitValue : 0
}

export function SinisterCostEditor({ value, onChange }: SinisterCostEditorProps) {
  const total = value.reduce((sum, cost) => sum + costTotal(cost), 0)

  function update(index: number, patch: Partial<SinisterCostFormValue>) {
    onChange(value.map((cost, costIndex) => (
      costIndex === index ? { ...cost, ...patch } : cost
    )))
  }

  return (
    <section className="space-y-4 border-t pt-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold">Custos do sinistro</h3>
          <p className="text-sm text-muted-foreground">
            Informe os itens do dossiê, com quantidade, valor unitário, total e comprovante quando existir.
          </p>
        </div>
        <Button type="button" variant="outline" className="gap-2" onClick={() => onChange([...value, newCost()])}>
          <Plus className="size-4" />
          Adicionar custo
        </Button>
      </div>

      {value.length ? (
        <div className="divide-y border-y">
          {value.map((cost, index) => (
            <div key={cost.localId} className="space-y-3 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">Item {index + 1}</p>
                  <p className="text-xs text-muted-foreground">
                    {sinisterCostCategoryLabel[cost.category]}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  title="Remover custo"
                  onClick={() => onChange(value.filter((_, costIndex) => costIndex !== index))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>

              <div className="grid gap-3 lg:grid-cols-[180px_minmax(0,1fr)]">
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select
                    value={cost.category}
                    onValueChange={(category: SinisterCostFormValue['category']) => update(index, { category })}
                  >
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {sinisterCostCategories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {sinisterCostCategoryLabel[category]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`sinister-cost-description-${cost.localId}`}>Descrição</Label>
                  <Input
                    id={`sinister-cost-description-${cost.localId}`}
                    value={cost.description}
                    onChange={(event) => update(index, { description: event.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_160px]">
                <div className="space-y-2">
                  <Label htmlFor={`sinister-cost-quantity-${cost.localId}`}>Quantidade</Label>
                  <Input
                    id={`sinister-cost-quantity-${cost.localId}`}
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={cost.quantity}
                    onChange={(event) => update(index, { quantity: event.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`sinister-cost-unit-${cost.localId}`}>Valor unitário</Label>
                  <Input
                    id={`sinister-cost-unit-${cost.localId}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={cost.unitValue}
                    onChange={(event) => update(index, { unitValue: event.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Total</Label>
                  <div className="flex h-10 items-center font-semibold">{brl(costTotal(cost))}</div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`sinister-cost-receipt-${cost.localId}`}>Comprovante</Label>
                <Input
                  id={`sinister-cost-receipt-${cost.localId}`}
                  placeholder="URL ou caminho do comprovante"
                  value={cost.receiptPath}
                  onChange={(event) => update(index, { receiptPath: event.target.value })}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="border-y py-6 text-center text-sm text-muted-foreground">
          Nenhum custo adicionado a este sinistro.
        </p>
      )}

      <div className="flex items-center justify-between border-b pb-5">
        <span className="text-sm text-muted-foreground">Total geral</span>
        <span className="text-lg font-semibold">{brl(total)}</span>
      </div>
    </section>
  )
}
