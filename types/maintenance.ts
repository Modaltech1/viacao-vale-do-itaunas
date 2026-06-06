import type { MaintenanceStatus, MaintenanceType } from '@/types/fleet'
import type { ServiceCategory } from '@/types/service'
import type { VehicleStatus } from '@/types/fleet'

export type MaintenanceServiceItem = {
  id: string
  serviceId: string
  name: string
  category: ServiceCategory
  value: number | null
  notes: string
}

export type MaintenanceListItem = {
  id: string
  vehicleId: string
  vehiclePlate: string
  vehicleLabel: string
  maintenanceType: MaintenanceType
  cause: string
  openedAt: string
  startedAt: string | null
  completedAt: string | null
  vehicleKm: number | null
  responsibleMechanicId: string | null
  responsibleMechanicName: string
  status: MaintenanceStatus
  totalValue: number
  notes: string
  cancellationReason: string
  services: MaintenanceServiceItem[]
}

export type MaintenanceDetails = MaintenanceListItem

export type MaintenanceVehicleOption = {
  id: string
  label: string
  currentKm: number
  status: VehicleStatus
}

export type MaintenanceMechanicOption = {
  id: string
  name: string
}

export type MaintenanceServiceOption = {
  id: string
  name: string
  category: ServiceCategory
  suggestedMaintenanceType: MaintenanceType
}

export type MaintenanceFormOptions = {
  vehicles: MaintenanceVehicleOption[]
  mechanics: MaintenanceMechanicOption[]
  services: MaintenanceServiceOption[]
  currentMechanicId: string | null
}

export type MaintenanceFormValues = {
  vehicleId: string
  maintenanceType: MaintenanceType
  cause: string
  openedAt: string
  vehicleKm: string
  responsibleMechanicId: string
  status: 'aberta' | 'em_andamento'
  totalValue: string
  notes: string
  serviceIds: string[]
}
