export const userRoles = ['admin', 'motorista', 'mecanico'] as const

export type UserRole = (typeof userRoles)[number]

export type AuthProfile = {
  papel: UserRole
  ativo: boolean
  nivel_admin?: 'global' | 'restrito' | null
}

const roleHome: Record<UserRole, string> = {
  admin: '/admin/dashboard',
  motorista: '/driver',
  mecanico: '/mechanic',
}

export function isUserRole(value: string): value is UserRole {
  return userRoles.includes(value as UserRole)
}

export function getRoleHome(role: UserRole) {
  return roleHome[role]
}

export function canAccessPath(role: UserRole, pathname: string) {
  if (pathname.startsWith('/admin')) return role === 'admin'
  if (pathname.startsWith('/driver')) return role === 'motorista'
  if (pathname.startsWith('/mechanic')) return role === 'mecanico'

  return true
}
