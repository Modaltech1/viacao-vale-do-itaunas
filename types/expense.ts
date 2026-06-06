import type { TravelOperationLookups } from '@/types/travel-operation'

export const expenseCategories = [
  'Pedágio',
  'Alimentação',
  'Hospedagem',
  'Descarga',
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
}

export type ExpenseLookups = TravelOperationLookups

export type ExpenseFormValues = {
  tripId: string
  vehicleId: string
  driverId: string
  category: ExpenseCategory
  value: string
  registeredAt: string
  notes: string
  receiptPath: string
}
