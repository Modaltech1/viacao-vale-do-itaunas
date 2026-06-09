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
import type { MaintenanceType } from '@/types/fleet'
import {
  serviceCategories,
  type ServiceFormValues,
  type ServiceListItem,
  type ServicePeriodicityType,
} from '@/types/service'

type ServiceDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  service?: ServiceListItem | null
  onSaved: (serviceId?: string) => void | Promise<void>
}

const emptyForm: ServiceFormValues = {
  name: '',
  category: 'Outros',
  suggestedMaintenanceType: 'preventiva',
  periodicityType: 'nenhuma',
  periodicityValue: '',
  defaultValue: '',
  description: '',
  active: true,
}

function formFromService(service?: ServiceListItem | null): ServiceFormValues {
  if (!service) return emptyForm

  return {
    name: service.name,
    category: service.category,
    suggestedMaintenanceType: service.suggestedMaintenanceType,
    periodicityType: service.periodicityType,
    periodicityValue:
      service.periodicityType === 'km'
        ? service.periodicityKm?.toString() ?? ''
        : service.periodicityType === 'tempo'
          ? service.periodicityDays?.toString() ?? ''
          : '',
    defaultValue: service.defaultValue.toString(),
    description: service.description,
    active: service.active,
  }
}

export function ServiceDialog({
  open,
  onOpenChange,
  service,
  onSaved,
}: ServiceDialogProps) {
  const [form, setForm] = useState<ServiceFormValues>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setForm(formFromService(service))
    setError('')
  }, [open, service])

  function updateField(field: 'name' | 'periodicityValue' | 'defaultValue' | 'description') {
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
        service ? `/api/admin/servicos/${service.id}` : '/api/admin/servicos',
        {
          method: service ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        },
      )
      const result = await response.json()

      if (!response.ok) throw new Error(result.error || 'Não foi possível salvar o serviço.')

      await onSaved(result.id)
      onOpenChange(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar o serviço.')
    } finally {
      setSaving(false)
    }
  }

  const periodicityLabel = form.periodicityType === 'km'
    ? 'Periodicidade em KM'
    : 'Periodicidade em dias'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle>{service ? 'Editar serviço' : 'Novo serviço'}</DialogTitle>
          <DialogDescription>
            {service
              ? 'Atualize o catálogo do serviço. Programações já vinculadas mantêm a periodicidade histórica.'
              : 'Cadastre um serviço executável e defina sua regra padrão de manutenção e periodicidade.'}
          </DialogDescription>
        </DialogHeader>

        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

        <form className="space-y-6" onSubmit={handleSubmit}>
          <section className="space-y-4">
            <div>
              <h3 className="font-semibold">Dados do serviço</h3>
              <p className="text-sm text-muted-foreground">
                Informações usadas no catálogo, nas manutenções e nas programações por veículo.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="service-name">Nome do serviço</Label>
              <Input
                id="service-name"
                placeholder="Ex.: Troca de óleo do motor"
                value={form.name}
                onChange={updateField('name')}
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select
                  value={form.category}
                  onValueChange={(value: ServiceFormValues['category']) => {
                    setForm((current) => ({ ...current, category: value }))
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {serviceCategories.map((category) => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tipo de manutenção sugerido</Label>
                <Select
                  value={form.suggestedMaintenanceType}
                  onValueChange={(value: MaintenanceType) => {
                    setForm((current) => ({ ...current, suggestedMaintenanceType: value }))
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preventiva">Preventiva</SelectItem>
                    <SelectItem value="corretiva">Corretiva</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="service-description">Descrição</Label>
              <Textarea
                id="service-description"
                rows={3}
                placeholder="Descreva o objetivo e o escopo operacional do serviço."
                value={form.description}
                onChange={updateField('description')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="service-default-value">Valor padrão</Label>
              <Input
                id="service-default-value"
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={form.defaultValue}
                onChange={updateField('defaultValue')}
                required
              />
              <p className="text-xs text-muted-foreground">
                Será sugerido na manutenção e poderá ser ajustado no lançamento.
              </p>
            </div>
          </section>

          <section className="space-y-4 border-t pt-5">
            <div>
              <h3 className="font-semibold">Periodicidade padrão</h3>
              <p className="text-sm text-muted-foreground">
                Esta regra será copiada como snapshot quando o serviço for programado em um veículo.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo de periodicidade</Label>
                <Select
                  value={form.periodicityType}
                  onValueChange={(value: ServicePeriodicityType) => {
                    setForm((current) => ({
                      ...current,
                      periodicityType: value,
                      periodicityValue: value === 'nenhuma' ? '' : current.periodicityValue,
                    }))
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="km">Por quilometragem</SelectItem>
                    <SelectItem value="tempo">Por tempo</SelectItem>
                    <SelectItem value="nenhuma">Sem recorrência</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.periodicityType !== 'nenhuma' ? (
                <div className="space-y-2">
                  <Label htmlFor="service-periodicity">{periodicityLabel}</Label>
                  <Input
                    id="service-periodicity"
                    type="number"
                    min="1"
                    step={form.periodicityType === 'tempo' ? '1' : '0.01'}
                    value={form.periodicityValue}
                    onChange={updateField('periodicityValue')}
                    required
                  />
                </div>
              ) : (
                <div className="flex items-end">
                  <p className="pb-2 text-sm text-muted-foreground">
                    Serviço executado sob demanda, sem vencimento recorrente.
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className="flex items-center justify-between gap-4 border-t pt-5">
            <div>
              <Label htmlFor="service-active">Serviço ativo</Label>
              <p className="text-sm text-muted-foreground">
                Serviços inativos permanecem no histórico, mas deixam de estar disponíveis para novos fluxos.
              </p>
            </div>
            <Switch
              id="service-active"
              checked={form.active}
              onCheckedChange={(checked: boolean) => {
                setForm((current) => ({ ...current, active: checked }))
              }}
            />
          </section>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar serviço'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
