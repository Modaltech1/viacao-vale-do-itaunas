export const KM_DECIMAL_STEP = 0.1

const KM_INPUT_PATTERN = /^\d+\.\d$/

export function formatKm(value: number, fractionDigits = 1) {
  if (!Number.isFinite(value)) return '—'
  return value.toFixed(fractionDigits)
}

export function normalizeKmInput(value: string) {
  const sanitized = value.replace(',', '.').replace(/[^\d.]/g, '')
  const separatorIndex = sanitized.indexOf('.')

  if (separatorIndex < 0) return sanitized

  const integerPart = sanitized.slice(0, separatorIndex) || '0'
  const decimalPart = sanitized.slice(separatorIndex + 1).replace(/\./g, '').slice(0, 1)
  return `${integerPart}.${decimalPart}`
}

export function kmInputValue(value: number | string | null | undefined) {
  if (value == null || value === '') return ''
  const parsed = Number(String(value).replace(',', '.'))
  return Number.isFinite(parsed) ? parsed.toFixed(1) : ''
}

export function parseKmValue(value: unknown, label: string) {
  const rawValue = String(value ?? '').trim()
  if (!KM_INPUT_PATTERN.test(rawValue)) {
    throw new Error(`${label} deve usar apenas números, um ponto e uma casa decimal, por exemplo 1000.0.`)
  }

  const parsed = Number(rawValue)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} deve ser maior ou igual a zero.`)
  }
  return parsed
}

export function parseOptionalKmValue(value: unknown, label: string) {
  return String(value ?? '').trim() === '' ? null : parseKmValue(value, label)
}

export function hasOneDecimalKmPrecision(value: number) {
  return Number.isFinite(value) && Math.abs(value * 10 - Math.round(value * 10)) < 1e-9
}
