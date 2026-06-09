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
import { ClipboardPlus, Trash2 } from 'lucide-react'
import { brl } from '@/lib/format'
import type {
  MaintenanceServiceFormValue,
  MaintenanceServiceOption,
} from '@/types/maintenance'

type ServiceUsageEditorProps = {
  options: MaintenanceServiceOption[]
  maintenanceType: 'preventiva' | 'corretiva'
  value: MaintenanceServiceFormValue[]
  onChange: (value: MaintenanceServiceFormValue[]) => void
}

export function ServiceUsageEditor({
  options,
  maintenanceType,
  value,
  onChange,
}: ServiceUsageEditorProps) {
  const [serviceToAdd, setServiceToAdd] = useState('')
  const availableServices = useMemo(
    () => options.filter((service) => (
      service.suggestedMaintenanceType === maintenanceType
      && !value.some((item) => item.serviceId === service.id)
    )),
    [maintenanceType, options, value],
  )
  const total = value.reduce((sum, item) => {
    const appliedValue = Number(item.appliedValue.replace(',', '.'))
    return sum + (Number.isFinite(appliedValue) ? appliedValue : 0)
  }, 0)

  function addService() {
    const service = options.find((item) => item.id === serviceToAdd)
    if (!service) return
    onChange([
      ...value,
      {
        serviceId: service.id,
        appliedValue: service.defaultValue.toString(),
      },
    ])
    setServiceToAdd('')
  }

  return (
    <section className="space-y-4 border-t pt-5">
      <div>
        <h3 className="font-semibold">Serviços</h3>
        <p className="text-sm text-muted-foreground">
          O valor padrão vem do catálogo e pode ser ajustado nesta manutenção. A conclusão atualiza a programação dos serviços recorrentes.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <Select value={serviceToAdd} onValueChange={setServiceToAdd}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecione um serviço" />
          </SelectTrigger>
          <SelectContent>
            {availableServices.map((service) => (
              <SelectItem key={service.id} value={service.id}>
                {service.name} · {service.category} · {brl(service.defaultValue)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          disabled={!serviceToAdd}
          onClick={addService}
        >
          <ClipboardPlus className="size-4" />
          Adicionar
        </Button>
      </div>

      {value.length ? (
        <div className="divide-y border-y">
          {value.map((item, index) => {
            const service = options.find((option) => option.id === item.serviceId)
            return (
              <div
                key={item.serviceId}
                className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-end"
              >
                <div className="self-center">
                  <p className="font-semibold">{service?.name ?? 'Serviço indisponível'}</p>
                  <p className="text-xs text-muted-foreground">{service?.category}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`service-value-${item.serviceId}`}>Valor aplicado</Label>
                  <Input
                    id={`service-value-${item.serviceId}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.appliedValue}
                    onChange={(event) => onChange(value.map((current, itemIndex) => (
                      itemIndex === index
                        ? { ...current, appliedValue: event.target.value }
                        : current
                    )))}
                    required
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  title="Remover serviço"
                  onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="border-y py-6 text-center text-sm text-muted-foreground">
          Nenhum serviço adicionado a esta manutenção.
        </p>
      )}

      <div className="flex items-center justify-between border-b pb-5">
        <span className="text-sm text-muted-foreground">Total em serviços</span>
        <span className="text-lg font-semibold">{brl(total)}</span>
      </div>
    </section>
  )
}
