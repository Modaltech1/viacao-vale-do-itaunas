export const brl = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

export const number = (value: number, digits = 0) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)

export const quantity = (value: number, unit?: string) =>
  new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: unit === 'litro' || unit === 'metro' ? 3 : 0,
  }).format(value)

export const date = (value?: string) => {
  if (!value) return '—'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(value))
}

export const dateTime = (value?: string) => {
  if (!value) return '—'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

export const compactDateTime = (value?: string) => {
  if (!value) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export const tripDurationMinutes = (
  startedAt?: string,
  finishedAt?: string | null,
  referenceDate = new Date(),
) => {
  if (!startedAt) return null

  const start = new Date(startedAt).getTime()
  const end = finishedAt ? new Date(finishedAt).getTime() : referenceDate.getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null

  return Math.floor((end - start) / 60_000)
}

export const formatTripDuration = (
  startedAt?: string,
  finishedAt?: string | null,
  referenceDate = new Date(),
) => {
  const totalMinutes = tripDurationMinutes(startedAt, finishedAt, referenceDate)
  if (totalMinutes == null) return '—'

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (!hours) return `${minutes}min`
  if (!minutes) return `${hours}h`
  return `${hours}h ${minutes}min`
}

export const maskCpf = (cpf: string) => cpf.replace(/^(\d{3})\.?(\d{3})\.?(\d{3})-?(\d{2})$/, '$1.***.***-$4')
