import type { TripStatus, VehicleStatus } from '@/types/fleet'

export type TripListItem = {
  id: string
  driverId: string
  driverName: string
  vehicleId: string
  vehicleLabel: string
  routeId: string | null
  routeName: string
  origin: string
  destination: string
  estimatedKm: number | null
  startedAt: string
  finishedAt: string | null
  status: TripStatus
  initialKm: number
  finalKm: number | null
  totalKm: number | null
  temporaryVehicle: boolean
  notes: string
  fuelLiters: number
  refuelingValue: number
  expenseValue: number
}

export type TripRefueling = {
  id: string
  registeredAt: string
  registeredKm: number
  fuelType: string
  liters: number
  unitValue: number | null
  totalValue: number | null
}

export type TripExpense = {
  id: string
  registeredAt: string
  category: string
  value: number
  notes: string
}

export type TripDetails = TripListItem & {
  latestRecordedKm: number
  refuelings: TripRefueling[]
  expenses: TripExpense[]
}

export type TripDriverOption = {
  id: string
  name: string
}

export type TripVehicleOption = {
  id: string
  label: string
  currentKm: number
  status: VehicleStatus
  routeId: string | null
  routeName: string
  routeOrigin: string
  routeDestination: string
  linkedDriverIds: string[]
}

export type TripFormOptions = {
  drivers: TripDriverOption[]
  vehicles: TripVehicleOption[]
}

export type TripFormValues = {
  driverId: string
  vehicleId: string
  origin: string
  destination: string
  startedAt: string
  initialKm: string
  notes: string
}

export type ConcludeTripFormValues = {
  finishedAt: string
  finalKm: string
  notes: string
}
