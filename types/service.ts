import type { MaintenanceType } from '@/types/fleet'

export const serviceCategories = [
  'Óleo',
  'Pneus',
  'Freios',
  'Motor',
  'Câmbio',
  'Elétrica',
  'Suspensão',
  'Documentação',
  'Revisão geral',
  'Outros',
] as const

export type ServiceCategory = (typeof serviceCategories)[number]
export type ServicePeriodicityType = 'km' | 'tempo' | 'nenhuma'

export type ServiceListItem = {
  id: string
  name: string
  category: ServiceCategory
  suggestedMaintenanceType: MaintenanceType
  periodicityType: ServicePeriodicityType
  periodicityKm: number | null
  periodicityDays: number | null
  description: string
  active: boolean
  linkedVehiclesCount: number
  maintenanceUsesCount: number
}

export type ServiceFormValues = {
  name: string
  category: ServiceCategory
  suggestedMaintenanceType: MaintenanceType
  periodicityType: ServicePeriodicityType
  periodicityValue: string
  description: string
  active: boolean
}
