export const fuelTypes = [
  'Diesel S10',
  'Diesel S500',
  'ARLA',
  'Gasolina',
  'Etanol',
] as const

export type FuelType = (typeof fuelTypes)[number]

export type RefuelingListItem = {
  id: string
  tripId: string | null
  vehicleId: string
  vehicleFleetCode: string
  vehicleLabel: string
  driverId: string | null
  driverName: string
  registeredAt: string
  registeredKm: number
  fuelType: FuelType
  liters: number
  unitValue: number | null
  totalValue: number | null
  notes: string
}

export type RefuelingVehicleOption = {
  id: string
  fleetCode: string
  label: string
  currentKm: number
  status: string
}

export type RefuelingDriverOption = {
  id: string
  name: string
}

export type RefuelingTripOption = {
  id: string
  vehicleId: string
  driverId: string
  label: string
  initialKm: number
  latestRecordedKm: number
  status: string
}

export type RefuelingLookups = {
  vehicles: RefuelingVehicleOption[]
  drivers: RefuelingDriverOption[]
  trips: RefuelingTripOption[]
}

export type RefuelingFormValues = {
  tripId: string
  vehicleId: string
  driverId: string
  registeredAt: string
  registeredKm: string
  fuelType: FuelType
  liters: string
  unitValue: string
  totalValue: string
  notes: string
}
