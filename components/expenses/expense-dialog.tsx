'use client'

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'
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
import { PartUsageEditor } from '@/components/parts/part-usage-editor'
import {
  expenseCategories,
  type ExpenseFormValues,
  type ExpenseListItem,
  type ExpenseLookups,
} from '@/types/expense'

type ExpenseDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  expense?: ExpenseListItem | null
  lookups: ExpenseLookups
  onSaved: () => void | Promise<void>
}

function localDateTime(value = new Date().toISOString()) {
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function emptyForm(): ExpenseFormValues {
  return {
    tripId: '',
    vehicleId: '',
    driverId: '',
    category: 'Pedágio',
    value: '',
    registeredAt: localDateTime(),
    notes: '',
    receiptPath: '',
    parts: [],
  }
}

function formFromExpense(expense?: ExpenseListItem | null): ExpenseFormValues {
  if (!expense) return emptyForm()

  return {
    tripId: expense.tripId ?? '',
    vehicleId: expense.vehicleId,
    driverId: expense.driverId ?? '',
    category: expense.category,
    value: expense.value.toString(),
    registeredAt: localDateTime(expense.registeredAt),
    notes: expense.notes,
    receiptPath: expense.receiptPath,
    parts: expense.parts
      .filter((part) => !part.returnedAt)
      .map((part) => ({
        partId: part.partId,
        quantity: part.quantity.toString(),
        unitValue: part.unitValue.toString(),
      })),
  }
}

export function ExpenseDialog({
  open,
  onOpenChange,
  expense,
  lookups,
  onSaved,
}: ExpenseDialogProps) {
  const [form, setForm] = useState<ExpenseFormValues>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setForm(formFromExpense(expense))
    setError('')
  }, [expense, open])

  const selectedTrip = useMemo(
    () => lookups.trips.find((trip) => trip.id === form.tripId) ?? null,
    [form.tripId, lookups.trips],
  )

  function updateField(
    field: 'value' | 'registeredAt' | 'notes' | 'receiptPath',
  ) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((current) => ({ ...current, [field]: event.target.value }))
    }
  }

  function selectTrip(tripId: string) {
    if (tripId === 'sem_viagem') {
      setForm((current) => ({
        ...current,
        tripId: '',
        vehicleId: '',
        driverId: '',
      }))
      return
    }

    const trip = lookups.trips.find((item) => item.id === tripId)
    if (!trip) return
    setForm((current) => ({
      ...current,
      tripId,
      vehicleId: trip.vehicleId,
      driverId: trip.driverId,
    }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      const response = await fetch(
        expense ? `/api/admin/despesas/${expense.id}` : '/api/admin/despesas',
        {
          method: expense ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...form,
            registeredAt: new Date(form.registeredAt).toISOString(),
          }),
        },
      )
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Não foi possível salvar a despesa.')

      await onSaved()
      onOpenChange(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar a despesa.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle>{expense ? 'Editar despesa' : 'Nova despesa'}</DialogTitle>
          <DialogDescription>
            {expense
              ? 'Atualize os dados financeiros preservando o vínculo operacional do lançamento.'
              : 'Registre um custo de viagem ou um lançamento administrativo avulso.'}
          </DialogDescription>
        </DialogHeader>

        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

        <form className="space-y-6" onSubmit={handleSubmit}>
          <section className="space-y-4">
            <div>
              <h3 className="font-semibold">Vínculo operacional</h3>
              <p className="text-sm text-muted-foreground">
                A viagem selecionada define automaticamente motorista e veículo.
              </p>
            </div>

            {expense ? (
              <div className="border-y py-3 text-sm">
                <p className="font-medium">{expense.vehicleLabel}</p>
                <p className="text-muted-foreground">
                  {expense.driverName}
                  {expense.tripId ? ' · Vinculada a uma viagem' : ' · Registro avulso'}
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Viagem</Label>
                  <Select value={form.tripId || 'sem_viagem'} onValueChange={selectTrip}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sem_viagem">Sem viagem vinculada</SelectItem>
                      {lookups.trips.map((trip) => (
                        <SelectItem key={trip.id} value={trip.id}>
                          {trip.label}{trip.status === 'em_andamento' ? ' · Em andamento' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Veículo</Label>
                    <Select
                      value={form.vehicleId}
                      onValueChange={(vehicleId) => {
                        setForm((current) => ({ ...current, vehicleId }))
                      }}
                      disabled={Boolean(selectedTrip)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione o veículo" />
                      </SelectTrigger>
                      <SelectContent>
                        {lookups.vehicles.map((vehicle) => (
                          <SelectItem key={vehicle.id} value={vehicle.id}>
                            {vehicle.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Motorista</Label>
                    <Select
                      value={form.driverId || 'sem_motorista'}
                      onValueChange={(value) => {
                        setForm((current) => ({
                          ...current,
                          driverId: value === 'sem_motorista' ? '' : value,
                        }))
                      }}
                      disabled={Boolean(selectedTrip)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sem_motorista">Sem motorista</SelectItem>
                        {lookups.drivers.map((driver) => (
                          <SelectItem key={driver.id} value={driver.id}>
                            {driver.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}
          </section>

          <section className="space-y-4 border-t pt-5">
            <div>
              <h3 className="font-semibold">Dados da despesa</h3>
              <p className="text-sm text-muted-foreground">
                Categoria, valor, momento do lançamento e informações de apoio.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select
                  value={form.category}
                  onValueChange={(category: ExpenseFormValues['category']) => {
                    setForm((current) => ({
                      ...current,
                      category,
                      value: category === 'Peças' ? '' : current.value,
                      parts: category === 'Peças' ? current.parts : [],
                    }))
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map((category) => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {form.category === 'Peças' ? (
                <div className="space-y-2">
                  <Label>Valor</Label>
                  <div className="flex h-10 items-center text-sm text-muted-foreground">
                    Calculado pelas peças utilizadas
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="expense-admin-value">Valor</Label>
                  <Input
                    id="expense-admin-value"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.value}
                    onChange={updateField('value')}
                    required
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="expense-admin-date">Data e hora</Label>
              <Input
                id="expense-admin-date"
                type="datetime-local"
                value={form.registeredAt}
                onChange={updateField('registeredAt')}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expense-admin-receipt">Comprovante</Label>
              <Input
                id="expense-admin-receipt"
                placeholder="URL ou caminho do comprovante"
                value={form.receiptPath}
                onChange={updateField('receiptPath')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expense-admin-notes">Observações</Label>
              <Textarea
                id="expense-admin-notes"
                rows={3}
                value={form.notes}
                onChange={updateField('notes')}
              />
            </div>
          </section>

          {form.category === 'Peças' ? (
            <PartUsageEditor
              options={lookups.parts}
              value={form.parts}
              onChange={(parts) => setForm((current) => ({ ...current, parts }))}
              description="Selecione itens do estoque usados diretamente no veículo. O preço pode ser ajustado neste lançamento e o saldo será debitado ao salvar."
              emptyMessage="Nenhuma peça adicionada a esta despesa."
              totalLabel="Valor total da despesa"
            />
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar despesa'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
