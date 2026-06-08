import type { TravelOperationLookups } from '@/types/travel-operation'
import type {
  PartUsageFormValue,
  PartUsageItem,
  PartUsageOption,
} from '@/types/part'

export const expenseCategories = [
  'Pedágio',
  'Alimentação',
  'Hospedagem',
  'Descarga',
  'Peças',
  'Outros',
] as const

export type ExpenseCategory = (typeof expenseCategories)[number]

export type ExpenseListItem = {
  id: string
  tripId: string | null
  vehicleId: string
  vehicleLabel: string
  driverId: string | null
  driverName: string
  category: ExpenseCategory
  value: number
  registeredAt: string
  notes: string
  receiptPath: string
  parts: PartUsageItem[]
}

export type MaintenanceExpenseItem = {
  id: string
  vehicleId: string
  vehicleLabel: string
  cause: string
  registeredAt: string
  value: number
  partsCount: number
  status: 'aberta' | 'em_andamento' | 'concluida' | 'cancelada'
}

export type ExpenseLookups = TravelOperationLookups & {
  parts: PartUsageOption[]
}

export type ExpenseFormValues = {
  tripId: string
  vehicleId: string
  driverId: string
  category: ExpenseCategory
  value: string
  registeredAt: string
  notes: string
  receiptPath: string
  parts: PartUsageFormValue[]
}
