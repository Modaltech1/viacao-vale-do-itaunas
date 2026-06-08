export const partCategories = [
  'Motor',
  'Freios',
  'Suspensão',
  'Elétrica',
  'Transmissão',
  'Pneus',
  'Filtros',
  'Lubrificantes',
  'Outros',
] as const

export const partUnits = ['unidade', 'litro', 'kit', 'metro', 'par'] as const

export type PartCategory = (typeof partCategories)[number]
export type PartUnit = (typeof partUnits)[number]

export type PartListItem = {
  id: string
  code: string
  name: string
  category: PartCategory
  unit: PartUnit
  stockQuantity: number
  minimumStock: number
  unitValue: number
  stockValue: number
  description: string
  active: boolean
  maintenanceUsesCount: number
  expenseUsesCount: number
  consumedQuantity: number
}

export type PartFormValues = {
  code: string
  name: string
  category: PartCategory
  unit: PartUnit
  stockQuantity: string
  minimumStock: string
  unitValue: string
  description: string
  active: boolean
}

export type PartUsageOption = {
  id: string
  code: string
  name: string
  unit: string
  stockQuantity: number
  unitValue: number
}

export type PartUsageFormValue = {
  partId: string
  quantity: string
  unitValue: string
}

export type PartUsageItem = {
  id: string
  partId: string
  code: string
  name: string
  unit: string
  quantity: number
  unitValue: number
  totalValue: number
  returnedAt: string | null
}
