import type { MaintenanceStatus, MaintenanceType } from '@/types/fleet'
import type { ManagedUserFormValues } from '@/types/managed-user'

export type MechanicProfessionalStatus = 'ativo' | 'inativo'

export type MechanicMaintenance = {
  id: string
  vehicleId: string
  vehicle: string
  maintenanceType: MaintenanceType
  cause: string
  openedAt: string
  startedAt: string | null
  completedAt: string | null
  status: MaintenanceStatus
  value: number
  role: 'responsavel' | 'apoio'
}

export type MechanicListItem = {
  id: string
  profileId: string
  name: string
  email: string
  phone: string
  specialty: string
  professionalStatus: MechanicProfessionalStatus
  accessActive: boolean
  notes: string
  maintenancesCount: number
  openMaintenancesCount: number
  completedMaintenancesCount: number
  totalValue: number
}

export type MechanicDetails = MechanicListItem & {
  maintenances: MechanicMaintenance[]
}

export type MechanicFormValues = ManagedUserFormValues & {
  specialty: string
  professionalStatus: MechanicProfessionalStatus
  notes: string
}
