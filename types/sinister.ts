import type { Severity } from '@/types/fleet'
import type { TravelOperationLookups } from '@/types/travel-operation'

export const sinisterTypes = ['avaria', 'colisao', 'acidente', 'incidente', 'outros'] as const
export const sinisterStatuses = ['aberto', 'em_analise', 'resolvido', 'cancelado'] as const
export const sinisterCostCategories = [
  'funilaria',
  'pecas',
  'mao_de_obra',
  'guincho',
  'seguro',
  'terceiros',
  'outros',
] as const

export type SinisterType = (typeof sinisterTypes)[number]
export type SinisterStatus = (typeof sinisterStatuses)[number]
export type SinisterCostCategory = (typeof sinisterCostCategories)[number]

export const sinisterTypeLabel: Record<SinisterType, string> = {
  avaria: 'Avaria',
  colisao: 'Colisão',
  acidente: 'Acidente',
  incidente: 'Incidente operacional',
  outros: 'Outros',
}

export const sinisterStatusLabel: Record<SinisterStatus, string> = {
  aberto: 'Aberto',
  em_analise: 'Em análise',
  resolvido: 'Resolvido',
  cancelado: 'Cancelado',
}

export const sinisterCostCategoryLabel: Record<SinisterCostCategory, string> = {
  funilaria: 'Funilaria',
  pecas: 'Peças',
  mao_de_obra: 'Mão de obra',
  guincho: 'Guincho',
  seguro: 'Seguro',
  terceiros: 'Terceiros',
  outros: 'Outros',
}

export type SinisterCostItem = {
  id: string
  category: SinisterCostCategory
  description: string
  quantity: number
  unitValue: number
  totalValue: number
  receiptPath: string
}

export type SinisterCostFormValue = {
  localId: string
  category: SinisterCostCategory
  description: string
  quantity: string
  unitValue: string
  receiptPath: string
}

export type SinisterListItem = {
  id: string
  vehicleId: string
  vehicleFleetCode: string
  vehicleLabel: string
  driverId: string | null
  driverName: string
  occurredAt: string
  type: SinisterType
  severity: Severity
  status: SinisterStatus
  location: string
  description: string
  notes: string
  policeReport: string
  hasThirdParties: boolean
  totalCost: number
  costsCount: number
  costs: SinisterCostItem[]
}

export type SinisterLookups = TravelOperationLookups

export type SinisterFormValues = {
  vehicleId: string
  driverId: string
  occurredAt: string
  type: SinisterType
  severity: Severity
  status: SinisterStatus
  location: string
  description: string
  notes: string
  policeReport: string
  hasThirdParties: boolean
  costs: SinisterCostFormValue[]
}
