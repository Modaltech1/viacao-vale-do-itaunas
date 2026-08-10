import type { DriverLicenseStatus, DriverProfessionalStatus } from '@/types/driver'

export const driverProfessionalStatuses = ['ativo', 'inativo', 'afastado', 'inapto'] as const satisfies readonly DriverProfessionalStatus[]

export const driverProfessionalStatusLabel: Record<DriverProfessionalStatus, string> = {
  ativo: 'Ativo',
  inativo: 'Inativo',
  afastado: 'Afastado',
  inapto: 'Inapto',
}

export function isDriverProfessionalStatus(value: string): value is DriverProfessionalStatus {
  return driverProfessionalStatuses.some((status) => status === value)
}

export function getDriverLicenseStatus(dueDate?: string | null): DriverLicenseStatus {
  if (!dueDate) return 'vencido'

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const due = new Date(`${dueDate}T00:00:00`)
  const warningDate = new Date(today)
  warningDate.setDate(warningDate.getDate() + 30)

  if (due < today) return 'vencido'
  if (due <= warningDate) return 'proximo'
  return 'em_dia'
}

export function normalizeOptionalText(value: unknown) {
  const normalized = String(value ?? '').trim()
  return normalized || null
}

export function toNumber(value: unknown) {
  const number = Number(value ?? 0)
  return Number.isFinite(number) ? number : 0
}
