'use client'

import { Input, Label } from '@prodexy/ui'
import { ClipboardPlus } from 'lucide-react'
import { PricedItemsEditor } from '@/components/shared/priced-items-editor'
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
  return (
    <PricedItemsEditor
      title="Serviços"
      description="O valor padrão vem do catálogo e pode ser ajustado nesta manutenção. A conclusão atualiza a programação dos serviços recorrentes."
      options={options.filter((service) => service.suggestedMaintenanceType === maintenanceType)}
      value={value}
      onChange={onChange}
      addIcon={ClipboardPlus}
      selectPlaceholder="Selecione um serviço"
      emptyMessage="Nenhum serviço adicionado a esta manutenção."
      totalLabel="Total em serviços"
      removeLabel="Remover serviço"
      unavailableLabel="Serviço indisponível"
      getOptionId={(service) => service.id}
      getValueId={(item) => item.serviceId}
      createValue={(service) => ({
        serviceId: service.id,
        appliedValue: service.defaultValue.toString(),
      })}
      getOptionLabel={(service) => (
        <>{service.name} · {service.category} · {brl(service.defaultValue)}</>
      )}
      getItemTitle={(service) => service?.name ?? 'Serviço indisponível'}
      getItemSubtitle={(service) => service?.category}
      getItemTotal={(item) => {
        const appliedValue = Number(item.appliedValue.replace(',', '.'))
        return Number.isFinite(appliedValue) ? appliedValue : 0
      }}
      itemClassName="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px] sm:items-end"
      renderFields={({ item, update }) => (
        <div className="space-y-2">
          <Label htmlFor={`service-value-${item.serviceId}`}>Valor aplicado</Label>
          <Input
            id={`service-value-${item.serviceId}`}
            type="number"
            min="0"
            step="0.01"
            value={item.appliedValue}
            onChange={(event) => update({ appliedValue: event.target.value })}
            required
          />
        </div>
      )}
    />
  )
}
