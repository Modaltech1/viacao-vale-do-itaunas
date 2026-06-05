import type { DriverLicenseStatus, DriverProfessionalStatus } from '@/types/driver'
import type { VehicleStatus } from '@/types/fleet'

export type DriverPortalProfile = {
  id: string
  name: string
  email: string
  phone: string
  cpf: string
  licenseNumber: string
  licenseCategory: string
  licenseDueDate: string
  licenseStatus: DriverLicenseStatus
  professionalStatus: DriverProfessionalStatus
}

export type DriverPortalRoute = {
  id: string
  name: string
  origin: string
  destination: string
  estimatedKm: number | null
}

export type DriverPortalVehicle = {
  id: string
  type: string
  brand: string
  model: string
  plate: string
  currentKm: number
  status: VehicleStatus
  principal: boolean
  linkType: 'regular' | 'reserva' | 'temporario'
  route: DriverPortalRoute | null
}

export type DriverPortalTrip = {
  id: string
  vehicleId: string
  vehicle: DriverPortalVehicle
  origin: string
  destination: string
  startedAt: string
  initialKm: number
  latestRecordedKm: number
  notes: string
}

export type DriverPortalRefueling = {
  id: string
  registeredAt: string
  registeredKm: number
  fuelType: string
  liters: number
}

export type DriverPortalExpense = {
  id: string
  registeredAt: string
  category: string
  value: number
}

export type DriverPortalData = {
  profile: DriverPortalProfile
  vehicles: DriverPortalVehicle[]
  currentTrip: DriverPortalTrip | null
  recentRefuelings: DriverPortalRefueling[]
  recentExpenses: DriverPortalExpense[]
}

export type StartTripFormValues = {
  vehicleId: string
  origin: string
  destination: string
  initialKm: string
  notes: string
}

export type RefuelingFormValues = {
  registeredKm: string
  fuelType: 'Diesel S10' | 'Diesel S500' | 'ARLA' | 'Gasolina' | 'Etanol'
  liters: string
  notes: string
}

export type ExpenseFormValues = {
  category: 'Pedágio' | 'Alimentação' | 'Hospedagem' | 'Descarga' | 'Outros'
  value: string
  notes: string
}

export type EndTripFormValues = {
  finalKm: string
  notes: string
}
