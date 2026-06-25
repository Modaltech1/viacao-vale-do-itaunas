import type { Severity, VehicleStatus } from '@/types/fleet'

export type DashboardMetrics = {
  totalVehicles: number
  maintenanceVehicles: number
  openTrips: number
  criticalPendings: number
  totalKm: number
  totalLiters: number
  averageConsumption: number | null
  refuelingCost: number
  maintenanceCost: number
  operatingExpenseCost: number
  sinisterCost: number
  totalCost: number
  lowStockParts: number
  partsStockValue: number
}

export type DashboardAlert = {
  id: string
  title: string
  description: string
  severity: Severity
  type: string
  vehicleId: string | null
  driverId: string | null
  maintenanceId: string | null
  href: string
}

export type DashboardVehicle = {
  id: string
  label: string
  currentKm: number
  status: VehicleStatus
}

export type DashboardFilterOption = {
  id: string
  label: string
}

export type DashboardData = {
  metrics: DashboardMetrics
  alerts: DashboardAlert[]
  vehicles: DashboardVehicle[]
  options: {
    vehicles: DashboardFilterOption[]
    drivers: DashboardFilterOption[]
  }
}
