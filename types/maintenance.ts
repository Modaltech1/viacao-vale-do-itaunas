import type { MaintenanceStatus, MaintenanceType } from '@/types/fleet'
import type { ServiceCategory } from '@/types/service'
import type { VehicleStatus } from '@/types/fleet'
import type {
  PartUsageFormValue,
  PartUsageItem,
  PartUsageOption,
} from '@/types/part'

export type MaintenanceServiceItem = {
  id: string
  serviceId: string
  name: string
  category: ServiceCategory
  value: number | null
  notes: string
}

export type MaintenancePartItem = PartUsageItem

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
  parts: MaintenancePartItem[]
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

export type MaintenancePartOption = PartUsageOption

export type MaintenanceFormOptions = {
  vehicles: MaintenanceVehicleOption[]
  mechanics: MaintenanceMechanicOption[]
  services: MaintenanceServiceOption[]
  parts: MaintenancePartOption[]
  currentMechanicId: string | null
}

export type MaintenancePartFormValue = PartUsageFormValue

export type MaintenanceFormValues = {
  vehicleId: string
  maintenanceType: MaintenanceType
  cause: string
  openedAt: string
  vehicleKm: string
  responsibleMechanicId: string
  status: 'aberta' | 'em_andamento'
  notes: string
  serviceIds: string[]
  parts: MaintenancePartFormValue[]
}
