import type {
  DocumentStatus,
  MaintenanceStatus,
  MaintenanceType,
  Severity,
  TripStatus,
  VehicleStatus,
} from '@/types/fleet'

export type VehicleRoute = {
  id: string
  name: string
  origin: string
  destination: string
  estimatedKm: number | null
  notes: string
}

export type VehicleDriver = {
  id: string
  name: string
  phone: string
  principal: boolean
  linkType: 'regular' | 'reserva' | 'temporario'
  startedAt: string
}

export type VehicleDriverOption = {
  id: string
  name: string
  email: string
  professionalStatus: 'ativo' | 'inativo' | 'afastado'
  accessActive: boolean
  principalVehicleId: string | null
  principalVehicleLabel: string | null
}

export type VehicleDocument = {
  id: string
  code: 'documentacao' | 'tacografo' | 'ceturb'
  name: string
  number: string
  issuedAt: string | null
  dueDate: string
  status: DocumentStatus
  severity: Severity
}

export type VehicleListItem = {
  id: string
  type: string
  brand: string
  model: string
  plate: string
  year: number | null
  status: VehicleStatus
  currentKm: number
  capacity: string
  notes: string
  route: VehicleRoute | null
  drivers: VehicleDriver[]
  documents: VehicleDocument[]
  averageConsumption: number | null
  totalRefuelingCost: number
  totalMaintenanceCost: number
  totalTravelExpenses: number
  totalOperationalCost: number
  pendingCount: number
  criticalPendingCount: number
}

export type VehicleTrip = {
  id: string
  driverName: string
  origin: string
  destination: string
  startedAt: string
  finishedAt: string | null
  initialKm: number
  finalKm: number | null
  status: TripStatus
}

export type VehicleRefueling = {
  id: string
  registeredAt: string
  registeredKm: number
  fuelType: string
  liters: number
  totalValue: number | null
}

export type VehicleMaintenance = {
  id: string
  maintenanceType: MaintenanceType
  cause: string
  openedAt: string
  status: MaintenanceStatus
  value: number
  mechanicName: string
  services: string[]
}

export type VehicleServiceSchedule = {
  id: string
  serviceName: string
  category: string
  periodicityType: 'km' | 'tempo' | 'nenhuma'
  lastDoneAt: string | null
  lastDoneKm: number | null
  nextDueAt: string | null
  nextDueKm: number | null
  status: DocumentStatus | 'inativo'
}

export type VehiclePending = {
  id: string
  title: string
  description: string
  severity: Severity
  type: string
  dueDate: string | null
  dueKm: number | null
  status: string
  actionLabel: string
}

export type VehicleDetails = VehicleListItem & {
  trips: VehicleTrip[]
  refuelings: VehicleRefueling[]
  maintenances: VehicleMaintenance[]
  serviceSchedules: VehicleServiceSchedule[]
  pendings: VehiclePending[]
}

export type VehicleFormOptions = {
  routes: VehicleRoute[]
  drivers: VehicleDriverOption[]
}

export type VehicleFormValues = {
  type: string
  brand: string
  model: string
  plate: string
  year: string
  status: VehicleStatus
  currentKm: string
  capacity: string
  notes: string
  routeId: string
  newRouteName: string
  newRouteOrigin: string
  newRouteDestination: string
  newRouteEstimatedKm: string
  newRouteNotes: string
  documentationDueDate: string
  tachographDueDate: string
  ceturbDueDate: string
  driverIds: string[]
  principalDriverId: string
}
