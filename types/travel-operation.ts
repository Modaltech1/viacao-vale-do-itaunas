export type TravelOperationVehicleOption = {
  id: string
  fleetCode: string
  label: string
  currentKm: number
  status: string
}

export type TravelOperationDriverOption = {
  id: string
  name: string
}

export type TravelOperationTripOption = {
  id: string
  vehicleId: string
  driverId: string
  label: string
  initialKm: number
  status: string
}

export type TravelOperationLookups = {
  vehicles: TravelOperationVehicleOption[]
  drivers: TravelOperationDriverOption[]
  trips: TravelOperationTripOption[]
}
