import type { Severity } from '@/types/fleet'

export type PendingOrigin = 'calculada' | 'manual'
export type PendingInteractionAction =
  | 'visualizada'
  | 'resolvida_manual'
  | 'ignorada'

export type PendingListItem = {
  key: string
  manualId: string | null
  origin: PendingOrigin
  severity: Severity
  type: string
  vehicleId: string | null
  driverId: string | null
  mechanicId: string | null
  serviceId: string | null
  maintenanceId: string | null
  title: string
  description: string
  dueDate: string | null
  dueKm: number | null
  currentKm: number | null
  status: string
  actionLabel: string
  contextLabel: string
  href: string
}

export type PendingOption = {
  id: string
  label: string
}

export type PendingFormOptions = {
  vehicles: PendingOption[]
  drivers: PendingOption[]
  mechanics: PendingOption[]
  services: PendingOption[]
  maintenances: PendingOption[]
  currentMechanicId: string | null
}

export type PendingFormValues = {
  title: string
  description: string
  severity: Severity
  type: string
  vehicleId: string
  driverId: string
  mechanicId: string
  serviceId: string
  maintenanceId: string
  dueDate: string
  dueKm: string
}
