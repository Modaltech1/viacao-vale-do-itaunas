import { maintenances, pendingItems, refuelings, travelExpenses, trips, vehicles } from '@/lib/mock-data'

export const tripKm = (initialKm: number, finalKm?: number) => Math.max((finalKm ?? initialKm) - initialKm, 0)
export const tripTotalKm = (tripId: string) => {
  const trip = trips.find((item) => item.id === tripId)
  if (!trip) return 0
  return tripKm(trip.initialKm, trip.finalKm)
}

export const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)
export const vehicleTotalRefuelingCost = (vehicleId: string) => sum(refuelings.filter((item) => item.vehicleId === vehicleId).map((item) => item.totalValue ?? 0))
export const vehicleTotalExpenses = (vehicleId: string) => sum(travelExpenses.filter((item) => item.vehicleId === vehicleId).map((item) => item.value))
export const vehicleTotalMaintenance = (vehicleId: string) => sum(maintenances.filter((item) => item.vehicleId === vehicleId).map((item) => item.value))
export const vehicleTotalCost = (vehicleId: string) => vehicleTotalRefuelingCost(vehicleId) + vehicleTotalExpenses(vehicleId) + vehicleTotalMaintenance(vehicleId)
export const vehicleTotalLiters = (vehicleId: string) => sum(refuelings.filter((item) => item.vehicleId === vehicleId).map((item) => item.liters))
export const vehicleTotalKm = (vehicleId: string) => sum(trips.filter((item) => item.vehicleId === vehicleId).map((item) => tripKm(item.initialKm, item.finalKm)))
export const vehicleConsumption = (vehicleId: string) => {
  const km = vehicleTotalKm(vehicleId)
  const liters = vehicleTotalLiters(vehicleId)
  if (!km || !liters) return 0
  return km / liters
}

export const driverTotalKm = (driverId: string) => sum(trips.filter((item) => item.driverId === driverId).map((item) => tripKm(item.initialKm, item.finalKm)))
export const driverTotalLiters = (driverId: string) => sum(refuelings.filter((item) => item.driverId === driverId).map((item) => item.liters))
export const driverTotalExpenses = (driverId: string) => sum(travelExpenses.filter((item) => item.driverId === driverId).map((item) => item.value))

export const dashboardTotals = () => {
  const totalKm = sum(trips.map((item) => tripKm(item.initialKm, item.finalKm)))
  const totalLiters = sum(refuelings.map((item) => item.liters))
  return {
    totalVehicles: vehicles.length,
    activeVehicles: vehicles.filter((item) => item.status === 'ativo').length,
    maintenanceVehicles: vehicles.filter((item) => item.status === 'em_manutencao').length,
    openTrips: trips.filter((item) => item.status === 'em_andamento').length,
    totalKm,
    totalLiters,
    averageConsumption: totalLiters ? totalKm / totalLiters : 0,
    refuelingCost: sum(refuelings.map((item) => item.totalValue ?? 0)),
    maintenanceCost: sum(maintenances.map((item) => item.value)),
    travelExpenseCost: sum(travelExpenses.map((item) => item.value)),
    criticalPendings: pendingItems.filter((item) => item.severity === 'critica').length,
  }
}
