import { drivers, maintenances, mechanics, pendingItems, refuelings, routes, services, travelExpenses, trips, vehicleServiceSchedules, vehicles } from '@/lib/mock-data'

export const getVehicle = (id: string) => vehicles.find((item) => item.id === id)
export const getDriver = (id?: string) => drivers.find((item) => item.id === id)
export const getMechanic = (id?: string) => mechanics.find((item) => item.id === id)
export const getRoute = (id?: string) => routes.find((item) => item.id === id)
export const getService = (id?: string) => services.find((item) => item.id === id)
export const getTrip = (id: string) => trips.find((item) => item.id === id)
export const getMaintenance = (id: string) => maintenances.find((item) => item.id === id)

export const vehicleTrips = (vehicleId: string) => trips.filter((item) => item.vehicleId === vehicleId)
export const vehicleRefuelings = (vehicleId: string) => refuelings.filter((item) => item.vehicleId === vehicleId)
export const vehicleExpenses = (vehicleId: string) => travelExpenses.filter((item) => item.vehicleId === vehicleId)
export const vehicleMaintenances = (vehicleId: string) => maintenances.filter((item) => item.vehicleId === vehicleId)
export const vehiclePendings = (vehicleId: string) => pendingItems.filter((item) => item.vehicleId === vehicleId)
export const vehicleSchedules = (vehicleId: string) => vehicleServiceSchedules.filter((item) => item.vehicleId === vehicleId)
export const vehicleDrivers = (vehicleId: string) => drivers.filter((item) => item.mainVehicleId === vehicleId)

export const driverTrips = (driverId: string) => trips.filter((item) => item.driverId === driverId)
export const driverRefuelings = (driverId: string) => refuelings.filter((item) => item.driverId === driverId)
export const driverExpenses = (driverId: string) => travelExpenses.filter((item) => item.driverId === driverId)
export const driverPendings = (driverId: string) => pendingItems.filter((item) => item.driverId === driverId)

export const tripRefuelings = (tripId: string) => refuelings.filter((item) => item.tripId === tripId)
export const tripExpenses = (tripId: string) => travelExpenses.filter((item) => item.tripId === tripId)

export const mechanicMaintenances = (mechanicId: string) => maintenances.filter((item) => item.mechanicId === mechanicId)
