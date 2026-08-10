import type { VehicleStatus } from '@/types/fleet'
import type { ManagedUserFormValues } from '@/types/managed-user'

export type DriverProfessionalStatus = 'ativo' | 'inativo' | 'afastado' | 'inapto'
export type DriverLicenseStatus = 'em_dia' | 'proximo' | 'vencido'
export type DriverTripStatus = 'em_andamento' | 'concluida' | 'cancelada'

export type DriverVehicle = {
  id: string
  fleetCode: string
  plate: string
  brand: string
  model: string
  currentKm: number
  status: VehicleStatus
  principal: boolean
}

export type DriverVehicleOption = {
  id: string
  label: string
  currentDriverName: string | null
}

export type DriverListItem = {
  id: string
  profileId: string
  name: string
  email: string
  phone: string
  cpf: string
  address: string
  licenseNumber: string
  licenseCategory: string
  licenseDueDate: string
  licenseStatus: DriverLicenseStatus
  professionalStatus: DriverProfessionalStatus
  accessActive: boolean
  notes: string
  vehicle: DriverVehicle | null
  tripsCount: number
  totalKm: number
  totalLiters: number
  totalExpenses: number
}

export type DriverTrip = {
  id: string
  vehicle: string
  origin: string
  destination: string
  startedAt: string
  finishedAt: string | null
  initialKm: number
  finalKm: number | null
  status: DriverTripStatus
}

export type DriverRefueling = {
  id: string
  vehicle: string
  registeredAt: string
  fuelType: string
  liters: number
  registeredKm: number
  totalValue: number | null
}

export type DriverExpense = {
  id: string
  vehicle: string
  registeredAt: string
  category: string
  value: number
  notes: string
}

export type DriverDetails = DriverListItem & {
  vehicles: DriverVehicle[]
  trips: DriverTrip[]
  refuelings: DriverRefueling[]
  expenses: DriverExpense[]
}

export type DriverFormValues = ManagedUserFormValues & {
  cpf: string
  address: string
  licenseNumber: string
  licenseCategory: string
  licenseDueDate: string
  professionalStatus: DriverProfessionalStatus
  accessActive: boolean
  notes: string
  vehicleId: string
}
