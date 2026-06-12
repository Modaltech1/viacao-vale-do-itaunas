import type { AdminLevel } from '@/lib/admin-scope'

export type AdminListItem = {
  id: string
  name: string
  email: string
  phone: string
  level: AdminLevel
  active: boolean
  vehiclesCount: number
  driversCount: number
  current: boolean
}

export type AdminOwnedResource = {
  id: string
  label: string
  detail: string
  ownerId: string | null
  ownerName: string | null
}

export type AdminManagementData = {
  admins: AdminListItem[]
  vehicles: AdminOwnedResource[]
  drivers: AdminOwnedResource[]
}

export type AdminFormValues = {
  name: string
  email: string
  password: string
  phone: string
  active: boolean
  level: AdminLevel
}

export type AdminResourceType = 'vehicle' | 'driver'
