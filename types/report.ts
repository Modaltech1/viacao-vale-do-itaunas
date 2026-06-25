export type ReportDelta = {
  value: number | null
  direction: 'up' | 'down' | 'flat' | 'new'
}

export type ReportMetrics = {
  totalCost: number
  totalKm: number
  costPerKm: number | null
  fuelEfficiency: number | null
  averageFuelPrice: number | null
  fleetAvailability: number
  fleetUtilization: number
  tripCompletionRate: number
  preventiveMaintenanceRate: number
  averageTripKm: number | null
  activeVehicles: number
  totalVehicles: number
  criticalPendings: number
  openMaintenances: number
  deltas: {
    totalCost: ReportDelta
    totalKm: ReportDelta
    costPerKm: ReportDelta
    fuelEfficiency: ReportDelta
  }
}

export type ReportTrendPoint = {
  key: string
  label: string
  fuel: number
  maintenance: number
  expenses: number
  sinisters: number
  total: number
  km: number
}

export type ReportVehicleRow = {
  id: string
  label: string
  status: string
  trips: number
  km: number
  liters: number
  fuelCost: number
  maintenanceCost: number
  expenseCost: number
  sinisterCost: number
  totalCost: number
  costPerKm: number | null
  consumption: number | null
}

export type ReportDriverRow = {
  id: string
  name: string
  trips: number
  completedTrips: number
  km: number
  averageTripKm: number | null
  fuelCost: number
  expenseCost: number
  completionRate: number
}

export type ReportCategoryValue = {
  name: string
  value: number
  count?: number
}

export type ReportRouteRow = {
  name: string
  trips: number
  km: number
  totalCost: number
  costPerKm: number | null
}

export type ReportMaintenanceSummary = {
  preventiveCount: number
  correctiveCount: number
  preventiveCost: number
  correctiveCost: number
  servicesCost: number
  partsCost: number
  completedCount: number
  openCount: number
  averageResolutionHours: number | null
  categories: ReportCategoryValue[]
}

export type ReportRiskSummary = {
  bySeverity: ReportCategoryValue[]
  byType: ReportCategoryValue[]
}

export type ReportInventorySummary = {
  stockValue: number
  lowStockCount: number
  outOfStockCount: number
  consumedCost: number
  consumedQuantity: number
  topParts: ReportCategoryValue[]
}

export type ReportInsight = {
  title: string
  description: string
  tone: 'success' | 'warning' | 'danger' | 'info'
}

export type ReportOption = {
  id: string
  label: string
}

export type ReportData = {
  period: {
    startDate: string
    endDate: string
    previousStartDate: string
    previousEndDate: string
  }
  metrics: ReportMetrics
  costBreakdown: ReportCategoryValue[]
  trend: ReportTrendPoint[]
  vehicles: ReportVehicleRow[]
  drivers: ReportDriverRow[]
  expenseCategories: ReportCategoryValue[]
  routes: ReportRouteRow[]
  maintenance: ReportMaintenanceSummary
  risks: ReportRiskSummary
  inventory: ReportInventorySummary
  insights: ReportInsight[]
  options: {
    vehicles: ReportOption[]
    drivers: ReportOption[]
    services: ReportOption[]
  }
}

export type ReportFilters = {
  startDate: string
  endDate: string
  vehicleId: string | null
  driverId: string | null
  serviceId: string | null
  maintenanceType: 'preventiva' | 'corretiva' | null
}
