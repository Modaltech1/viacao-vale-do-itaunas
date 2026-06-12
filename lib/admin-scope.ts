export const adminLevels = ['global', 'restrito'] as const

export type AdminLevel = (typeof adminLevels)[number]

export type AdminAccess = {
  userId: string
  level: AdminLevel
  isGlobal: boolean
}

export function isAdminLevel(value: string | null | undefined): value is AdminLevel {
  return adminLevels.includes(value as AdminLevel)
}

export function createAdminAccess(userId: string, level: string | null | undefined): AdminAccess {
  const normalizedLevel: AdminLevel = level === 'restrito' ? 'restrito' : 'global'

  return {
    userId,
    level: normalizedLevel,
    isGlobal: normalizedLevel === 'global',
  }
}

export function canAccessAdminOwnedRecord(
  access: AdminAccess,
  ownerId: string | null | undefined,
) {
  return access.isGlobal || ownerId === access.userId
}

export function resolveAdminOwnerId(
  access: AdminAccess,
  requestedOwnerId?: string | null,
) {
  if (!access.isGlobal) return access.userId
  return requestedOwnerId || access.userId
}
