import type { DocumentStatus, MaintenanceStatus, Severity, TripStatus, VehicleStatus } from '@/types/fleet'

export const vehicleStatusLabel: Record<VehicleStatus, string> = {
  ativo: 'Ativo',
  em_manutencao: 'Em manutenção',
  inativo: 'Inativo',
  reservado: 'Reservado',
  indisponivel: 'Indisponível',
}

export const documentStatusLabel: Record<DocumentStatus, string> = {
  em_dia: 'Em dia',
  proximo: 'Próximo',
  vencido: 'Vencido',
}

export const tripStatusLabel: Record<TripStatus, string> = {
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}

export const maintenanceStatusLabel: Record<MaintenanceStatus, string> = {
  aberta: 'Aberta',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}

export const severityLabel: Record<Severity, string> = {
  baixa: 'Baixa',
  atencao: 'Atenção',
  critica: 'Crítica',
}

export const badgeClassByStatus = (status: string) => {
  if (['ativo', 'em_dia', 'concluida', 'baixa'].includes(status)) return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (['proximo', 'em_manutencao', 'em_andamento', 'atencao', 'reservado', 'aberta'].includes(status)) return 'border-yellow-300 bg-yellow-50 text-yellow-800'
  if (['critica'].includes(status)) return 'border-red-300 bg-red-50 text-red-700'
  if (['vencido', 'inativo', 'indisponivel', 'cancelada'].includes(status)) return 'border-orange-300 bg-orange-50 text-orange-800'
  return 'border-border bg-muted text-muted-foreground'
}
