export type UserRole = 'admin' | 'driver' | 'mechanic'

export type VehicleStatus = 'ativo' | 'em_manutencao' | 'inativo' | 'reservado' | 'indisponivel'
export type DocumentStatus = 'em_dia' | 'proximo' | 'vencido'
export type TripStatus = 'em_andamento' | 'concluida' | 'cancelada'
export type MaintenanceStatus = 'aberta' | 'em_andamento' | 'concluida' | 'cancelada'
export type MaintenanceType = 'preventiva' | 'corretiva'
export type PeriodicityType = 'km' | 'time' | 'none'
export type Severity = 'baixa' | 'atencao' | 'critica'

export type Route = {
  id: string
  name: string
  origin: string
  destination: string
  estimatedKm: number
  notes?: string
}

export type Vehicle = {
  id: string
  type: string
  brand: string
  model: string
  plate: string
  year: number
  status: VehicleStatus
  currentKm: number
  capacity: string
  mainDriverId?: string
  routeId: string
  documentationDueDate: string
  tachographDueDate: string
  ceturbDueDate: string
  documentationStatus: DocumentStatus
  tachographStatus: DocumentStatus
  ceturbStatus: DocumentStatus
  averageConsumption: number
  totalMaintenanceCost: number
  notes?: string
}

export type Driver = {
  id: string
  name: string
  address: string
  phone: string
  cpf: string
  licenseNumber: string
  licenseDueDate: string
  licenseStatus: DocumentStatus
  mainVehicleId?: string
  status: 'ativo' | 'inativo' | 'afastado'
}

export type Mechanic = {
  id: string
  name: string
  phone: string
  specialty: string
  status: 'ativo' | 'inativo'
}

export type Service = {
  id: string
  name: string
  category: 'Óleo' | 'Pneus' | 'Freios' | 'Motor' | 'Câmbio' | 'Elétrica' | 'Suspensão' | 'Documentação' | 'Revisão geral' | 'Outros'
  suggestedMaintenanceType: MaintenanceType
  periodicityType: PeriodicityType
  periodicityKm?: number
  periodicityDays?: number
  description: string
  status: 'ativo' | 'inativo'
}

export type VehicleServiceSchedule = {
  id: string
  vehicleId: string
  serviceId: string
  lastDoneAt?: string
  lastDoneKm?: number
  nextDueAt?: string
  nextDueKm?: number
  status: 'em_dia' | 'proximo' | 'vencido'
}

export type Trip = {
  id: string
  driverId: string
  vehicleId: string
  routeId: string
  origin: string
  destination: string
  startedAt: string
  finishedAt?: string
  status: TripStatus
  initialKm: number
  finalKm?: number
  notes?: string
  temporaryVehicleAssignment?: boolean
}

export type Refueling = {
  id: string
  tripId: string
  driverId: string
  vehicleId: string
  date: string
  currentKm: number
  fuelType: 'Diesel S10' | 'Diesel S500' | 'Arla' | 'Gasolina' | 'Etanol'
  liters: number
  unitPrice?: number
  totalValue?: number
  notes?: string
}

export type TravelExpense = {
  id: string
  tripId: string
  driverId: string
  vehicleId: string
  type: 'Pedágio' | 'Alimentação' | 'Hospedagem' | 'Descarga' | 'Outros'
  value: number
  date: string
  notes?: string
}

export type Maintenance = {
  id: string
  vehicleId: string
  maintenanceType: MaintenanceType
  serviceIds: string[]
  cause: string
  date: string
  currentKm: number
  value: number
  mechanicId: string
  status: MaintenanceStatus
  notes?: string
}

export type PendingItem = {
  id: string
  type: 'servico_km' | 'servico_tempo' | 'manutencao_aberta' | 'veiculo_status' | 'cnh' | 'documentacao' | 'tacografo' | 'ceturb'
  severity: Severity
  vehicleId?: string
  driverId?: string
  serviceId?: string
  title: string
  description: string
  dueKm?: number
  dueDate?: string
  currentKm?: number
  status: 'aberta' | 'resolvida'
  actionLabel: string
}

export type DashboardFilters = {
  period: string
  vehicleId: string
  driverId: string
}
