import type { Driver, Maintenance, Mechanic, PendingItem, Refueling, Route, Service, TravelExpense, Trip, Vehicle, VehicleServiceSchedule } from '@/types/fleet'

export const routes: Route[] = [
  { id: 'route-1', name: 'São Paulo/SP → Curitiba/PR', origin: 'São Paulo/SP', destination: 'Curitiba/PR', estimatedKm: 408, notes: 'Rota fixa do veículo RIO-2A45.' },
  { id: 'route-2', name: 'Vitória/ES → Rio de Janeiro/RJ', origin: 'Vitória/ES', destination: 'Rio de Janeiro/RJ', estimatedKm: 525 },
  { id: 'route-3', name: 'Belo Horizonte/MG → Goiânia/GO', origin: 'Belo Horizonte/MG', destination: 'Goiânia/GO', estimatedKm: 675 },
  { id: 'route-4', name: 'São Mateus/ES → Salvador/BA', origin: 'São Mateus/ES', destination: 'Salvador/BA', estimatedKm: 735 },
  { id: 'route-5', name: 'Campos/RJ → Macaé/RJ', origin: 'Campos/RJ', destination: 'Macaé/RJ', estimatedKm: 102 },
]

export const drivers: Driver[] = [
  { id: 'driver-1', name: 'Carlos Almeida', address: 'Rua das Palmeiras, 120', phone: '(11) 98745-2210', cpf: '421.987.222-22', licenseNumber: '04125698710', licenseDueDate: '2026-10-03', licenseStatus: 'em_dia', mainVehicleId: 'vehicle-1', status: 'ativo' },
  { id: 'driver-2', name: 'Rafael Souza', address: 'Av. Norte, 455', phone: '(27) 99814-7788', cpf: '311.845.900-44', licenseNumber: '05776112003', licenseDueDate: '2026-07-12', licenseStatus: 'em_dia', mainVehicleId: 'vehicle-2', status: 'ativo' },
  { id: 'driver-3', name: 'João Pereira', address: 'Rua Minas, 66', phone: '(31) 98882-1001', cpf: '221.654.900-33', licenseNumber: '09099871044', licenseDueDate: '2026-02-20', licenseStatus: 'proximo', mainVehicleId: 'vehicle-3', status: 'ativo' },
  { id: 'driver-4', name: 'Marcos Vinícius', address: 'Rua da Oficina, 100', phone: '(73) 98122-4567', cpf: '129.555.400-18', licenseNumber: '04315612000', licenseDueDate: '2025-12-10', licenseStatus: 'vencido', mainVehicleId: 'vehicle-6', status: 'ativo' },
  { id: 'driver-5', name: 'Breno Machado', address: 'Travessa Central, 30', phone: '(22) 99214-6400', cpf: '410.333.980-55', licenseNumber: '05578920110', licenseDueDate: '2027-01-22', licenseStatus: 'em_dia', mainVehicleId: 'vehicle-8', status: 'ativo' },
]

export const mechanics: Mechanic[] = [
  { id: 'mechanic-1', name: 'Edson Martins', phone: '(11) 94414-7788', specialty: 'Motor e câmbio', status: 'ativo' },
  { id: 'mechanic-2', name: 'José Carlos Oliveira', phone: '(27) 99211-3310', specialty: 'Freios e suspensão', status: 'ativo' },
  { id: 'mechanic-3', name: 'Francisco Alves', phone: '(31) 98817-2010', specialty: 'Elétrica e pneus', status: 'ativo' },
]

export const vehicles: Vehicle[] = [
  { id: 'vehicle-1', type: 'Caminhão', brand: 'Scania', model: 'R 450', plate: 'RIO-2A45', year: 2021, status: 'ativo', currentKm: 412300, capacity: '45 t', mainDriverId: 'driver-1', routeId: 'route-1', documentationDueDate: '2026-09-15', tachographDueDate: '2026-04-20', ceturbDueDate: '2026-07-10', documentationStatus: 'em_dia', tachographStatus: 'em_dia', ceturbStatus: 'em_dia', averageConsumption: 3.39, totalMaintenanceCost: 7835.60, notes: 'Veículo principal da rota SP x PR.' },
  { id: 'vehicle-2', type: 'Caminhão', brand: 'Volvo', model: 'FH 540', plate: 'SPA-7B12', year: 2020, status: 'em_manutencao', currentKm: 528900, capacity: '48 t', mainDriverId: 'driver-2', routeId: 'route-2', documentationDueDate: '2026-01-19', tachographDueDate: '2026-03-01', ceturbDueDate: '2026-05-02', documentationStatus: 'proximo', tachographStatus: 'proximo', ceturbStatus: 'em_dia', averageConsumption: 4.48, totalMaintenanceCost: 10612.20, notes: 'Em manutenção por falha de sensor.' },
  { id: 'vehicle-3', type: 'Cavalinho', brand: 'Mercedes-Benz', model: 'Actros 2651', plate: 'MGE-9C77', year: 2022, status: 'ativo', currentKm: 198400, capacity: '50 t', mainDriverId: 'driver-3', routeId: 'route-3', documentationDueDate: '2026-11-20', tachographDueDate: '2026-06-18', ceturbDueDate: '2026-04-05', documentationStatus: 'em_dia', tachographStatus: 'em_dia', ceturbStatus: 'proximo', averageConsumption: 3.83, totalMaintenanceCost: 3102.40 },
  { id: 'vehicle-4', type: 'Reboque', brand: 'Randon', model: 'SR Bitrem', plate: 'PRC-4D33', year: 2019, status: 'ativo', currentKm: 312100, capacity: '38 t', routeId: 'route-4', documentationDueDate: '2025-12-20', tachographDueDate: '2026-08-10', ceturbDueDate: '2025-11-20', documentationStatus: 'vencido', tachographStatus: 'em_dia', ceturbStatus: 'vencido', averageConsumption: 0, totalMaintenanceCost: 4650.00 },
  { id: 'vehicle-5', type: 'Ônibus', brand: 'Marcopolo', model: 'Paradiso G7', plate: 'BAH-1E58', year: 2018, status: 'inativo', currentKm: 689200, capacity: '46 passageiros', routeId: 'route-4', documentationDueDate: '2025-10-05', tachographDueDate: '2025-12-15', ceturbDueDate: '2026-02-10', documentationStatus: 'vencido', tachographStatus: 'vencido', ceturbStatus: 'proximo', averageConsumption: 2.88, totalMaintenanceCost: 12400.00 },
  { id: 'vehicle-6', type: 'Caminhão', brand: 'Iveco', model: 'Tector 240E28', plate: 'GOA-6F02', year: 2023, status: 'ativo', currentKm: 87600, capacity: '23 t', mainDriverId: 'driver-4', routeId: 'route-3', documentationDueDate: '2027-01-18', tachographDueDate: '2026-10-30', ceturbDueDate: '2026-12-01', documentationStatus: 'em_dia', tachographStatus: 'em_dia', ceturbStatus: 'em_dia', averageConsumption: 6.32, totalMaintenanceCost: 980.00 },
  { id: 'vehicle-7', type: 'Ônibus', brand: 'Mercedes-Benz', model: 'OF 1721', plate: 'SAL-0K21', year: 2017, status: 'reservado', currentKm: 402000, capacity: '42 passageiros', routeId: 'route-5', documentationDueDate: '2026-02-15', tachographDueDate: '2026-04-01', ceturbDueDate: '2025-12-28', documentationStatus: 'proximo', tachographStatus: 'em_dia', ceturbStatus: 'vencido', averageConsumption: 3.1, totalMaintenanceCost: 9020.20 },
  { id: 'vehicle-8', type: 'Utilitário', brand: 'Fiat', model: 'Fiorino', plate: 'CWB-8H64', year: 2022, status: 'ativo', currentKm: 67500, capacity: '650 kg', mainDriverId: 'driver-5', routeId: 'route-5', documentationDueDate: '2026-08-18', tachographDueDate: '2026-08-18', ceturbDueDate: '2026-08-18', documentationStatus: 'em_dia', tachographStatus: 'em_dia', ceturbStatus: 'em_dia', averageConsumption: 9.8, totalMaintenanceCost: 400.00 },
]

export const services: Service[] = [
  { id: 'service-1', name: 'Troca de óleo do motor', category: 'Óleo', suggestedMaintenanceType: 'preventiva', periodicityType: 'km', periodicityKm: 10000, description: 'Controle de óleo do motor por quilometragem.', status: 'ativo' },
  { id: 'service-2', name: 'Troca de filtro de óleo', category: 'Óleo', suggestedMaintenanceType: 'preventiva', periodicityType: 'km', periodicityKm: 10000, description: 'Normalmente executado junto da troca de óleo.', status: 'ativo' },
  { id: 'service-3', name: 'Troca de filtro de ar', category: 'Motor', suggestedMaintenanceType: 'preventiva', periodicityType: 'km', periodicityKm: 15000, description: 'Evita perda de desempenho e consumo elevado.', status: 'ativo' },
  { id: 'service-4', name: 'Revisão de freios', category: 'Freios', suggestedMaintenanceType: 'preventiva', periodicityType: 'km', periodicityKm: 15000, description: 'Verificação periódica de lonas, pastilhas e sistema pneumático.', status: 'ativo' },
  { id: 'service-5', name: 'Alinhamento', category: 'Pneus', suggestedMaintenanceType: 'preventiva', periodicityType: 'km', periodicityKm: 20000, description: 'Controle de pneus por serviço periódico.', status: 'ativo' },
  { id: 'service-6', name: 'Balanceamento', category: 'Pneus', suggestedMaintenanceType: 'preventiva', periodicityType: 'km', periodicityKm: 20000, description: 'Reduz desgaste irregular e vibração.', status: 'ativo' },
  { id: 'service-7', name: 'Rodízio de pneus', category: 'Pneus', suggestedMaintenanceType: 'preventiva', periodicityType: 'km', periodicityKm: 25000, description: 'Exemplo de controle de pneus dentro do módulo de serviços.', status: 'ativo' },
  { id: 'service-8', name: 'Troca de pneus', category: 'Pneus', suggestedMaintenanceType: 'preventiva', periodicityType: 'km', periodicityKm: 80000, description: 'Troca prevista por vida útil em KM.', status: 'ativo' },
  { id: 'service-9', name: 'Revisão geral', category: 'Revisão geral', suggestedMaintenanceType: 'preventiva', periodicityType: 'km', periodicityKm: 30000, description: 'Revisão geral do ativo.', status: 'ativo' },
  { id: 'service-10', name: 'Inspeção CETURB', category: 'Documentação', suggestedMaintenanceType: 'preventiva', periodicityType: 'time', periodicityDays: 365, description: 'Acompanhamento de vencimento CETURB.', status: 'ativo' },
  { id: 'service-11', name: 'Inspeção de tacógrafo', category: 'Documentação', suggestedMaintenanceType: 'preventiva', periodicityType: 'time', periodicityDays: 365, description: 'Controle periódico do tacógrafo.', status: 'ativo' },
  { id: 'service-12', name: 'Reparo elétrico', category: 'Elétrica', suggestedMaintenanceType: 'corretiva', periodicityType: 'none', description: 'Serviço corretivo sem recorrência fixa.', status: 'ativo' },
  { id: 'service-13', name: 'Substituição de bomba d’água', category: 'Motor', suggestedMaintenanceType: 'corretiva', periodicityType: 'none', description: 'Reparo corretivo por falha do componente.', status: 'ativo' },
  { id: 'service-14', name: 'Troca de óleo do câmbio', category: 'Câmbio', suggestedMaintenanceType: 'preventiva', periodicityType: 'km', periodicityKm: 60000, description: 'Manutenção preventiva do câmbio.', status: 'ativo' },
  { id: 'service-15', name: 'Inspeção da suspensão', category: 'Suspensão', suggestedMaintenanceType: 'preventiva', periodicityType: 'km', periodicityKm: 20000, description: 'Checagem de molas, buchas e amortecedores.', status: 'ativo' },
]

export const vehicleServiceSchedules: VehicleServiceSchedule[] = [
  { id: 'vss-1', vehicleId: 'vehicle-1', serviceId: 'service-1', lastDoneAt: '2026-04-22', lastDoneKm: 402300, nextDueKm: 412300, status: 'vencido' },
  { id: 'vss-2', vehicleId: 'vehicle-1', serviceId: 'service-7', lastDoneAt: '2026-03-10', lastDoneKm: 390000, nextDueKm: 415000, status: 'proximo' },
  { id: 'vss-3', vehicleId: 'vehicle-1', serviceId: 'service-8', lastDoneAt: '2025-08-10', lastDoneKm: 340000, nextDueKm: 420000, status: 'proximo' },
  { id: 'vss-4', vehicleId: 'vehicle-2', serviceId: 'service-4', lastDoneAt: '2026-03-15', lastDoneKm: 512500, nextDueKm: 527500, status: 'vencido' },
  { id: 'vss-5', vehicleId: 'vehicle-2', serviceId: 'service-8', lastDoneAt: '2025-09-01', lastDoneKm: 455000, nextDueKm: 535000, status: 'proximo' },
  { id: 'vss-6', vehicleId: 'vehicle-3', serviceId: 'service-10', lastDoneAt: '2025-04-05', nextDueAt: '2026-04-05', status: 'proximo' },
  { id: 'vss-7', vehicleId: 'vehicle-4', serviceId: 'service-10', lastDoneAt: '2024-11-20', nextDueAt: '2025-11-20', status: 'vencido' },
  { id: 'vss-8', vehicleId: 'vehicle-5', serviceId: 'service-9', lastDoneAt: '2025-01-10', lastDoneKm: 650000, nextDueKm: 680000, status: 'vencido' },
  { id: 'vss-9', vehicleId: 'vehicle-6', serviceId: 'service-1', lastDoneAt: '2026-02-02', lastDoneKm: 78000, nextDueKm: 88000, status: 'proximo' },
  { id: 'vss-10', vehicleId: 'vehicle-8', serviceId: 'service-7', lastDoneAt: '2026-01-12', lastDoneKm: 45000, nextDueKm: 70000, status: 'proximo' },
]

export const trips: Trip[] = [
  { id: 'trip-1', driverId: 'driver-1', vehicleId: 'vehicle-1', routeId: 'route-1', origin: 'São Paulo/SP', destination: 'Curitiba/PR', startedAt: '2026-05-28T07:10:00', status: 'em_andamento', initialKm: 411800, notes: 'Carga industrial. Rota fixa do veículo.', temporaryVehicleAssignment: false },
  { id: 'trip-2', driverId: 'driver-2', vehicleId: 'vehicle-7', routeId: 'route-5', origin: 'Campos/RJ', destination: 'Macaé/RJ', startedAt: '2026-05-24T06:40:00', finishedAt: '2026-05-24T10:30:00', status: 'concluida', initialKm: 401820, finalKm: 401930, notes: 'Uso de veículo temporário por manutenção do veículo principal.', temporaryVehicleAssignment: true },
  { id: 'trip-3', driverId: 'driver-3', vehicleId: 'vehicle-3', routeId: 'route-3', origin: 'Belo Horizonte/MG', destination: 'Goiânia/GO', startedAt: '2026-05-20T05:30:00', finishedAt: '2026-05-20T18:40:00', status: 'concluida', initialKm: 197710, finalKm: 198390 },
  { id: 'trip-4', driverId: 'driver-4', vehicleId: 'vehicle-6', routeId: 'route-3', origin: 'Belo Horizonte/MG', destination: 'Goiânia/GO', startedAt: '2026-05-18T08:00:00', finishedAt: '2026-05-18T20:15:00', status: 'concluida', initialKm: 86900, finalKm: 87600 },
  { id: 'trip-5', driverId: 'driver-5', vehicleId: 'vehicle-8', routeId: 'route-5', origin: 'Campos/RJ', destination: 'Macaé/RJ', startedAt: '2026-05-22T08:30:00', finishedAt: '2026-05-22T11:10:00', status: 'concluida', initialKm: 67398, finalKm: 67500 },
  { id: 'trip-6', driverId: 'driver-1', vehicleId: 'vehicle-1', routeId: 'route-1', origin: 'Curitiba/PR', destination: 'São Paulo/SP', startedAt: '2026-05-17T09:20:00', finishedAt: '2026-05-17T17:40:00', status: 'concluida', initialKm: 411350, finalKm: 411790 },
]

export const refuelings: Refueling[] = [
  { id: 'ref-1', tripId: 'trip-1', driverId: 'driver-1', vehicleId: 'vehicle-1', date: '2026-05-28T09:40:00', currentKm: 412050, fuelType: 'Diesel S10', liters: 180, unitPrice: 6.12, totalValue: 1101.60, notes: 'Abastecimento na fábrica, pagamento mensal pelo gestor.' },
  { id: 'ref-2', tripId: 'trip-1', driverId: 'driver-1', vehicleId: 'vehicle-1', date: '2026-05-28T13:15:00', currentKm: 412300, fuelType: 'Diesel S10', liters: 82, unitPrice: 6.12, totalValue: 501.84 },
  { id: 'ref-3', tripId: 'trip-2', driverId: 'driver-2', vehicleId: 'vehicle-7', date: '2026-05-24T08:10:00', currentKm: 401880, fuelType: 'Diesel S10', liters: 42, unitPrice: 6.09, totalValue: 255.78 },
  { id: 'ref-4', tripId: 'trip-3', driverId: 'driver-3', vehicleId: 'vehicle-3', date: '2026-05-20T11:00:00', currentKm: 198030, fuelType: 'Diesel S10', liters: 170, unitPrice: 6.18, totalValue: 1050.60 },
  { id: 'ref-5', tripId: 'trip-4', driverId: 'driver-4', vehicleId: 'vehicle-6', date: '2026-05-18T15:20:00', currentKm: 87440, fuelType: 'Diesel S10', liters: 96, unitPrice: 6.05, totalValue: 580.80 },
  { id: 'ref-6', tripId: 'trip-5', driverId: 'driver-5', vehicleId: 'vehicle-8', date: '2026-05-22T10:00:00', currentKm: 67455, fuelType: 'Gasolina', liters: 25, unitPrice: 5.89, totalValue: 147.25 },
]

export const travelExpenses: TravelExpense[] = [
  { id: 'exp-1', tripId: 'trip-1', driverId: 'driver-1', vehicleId: 'vehicle-1', type: 'Pedágio', value: 318, date: '2026-05-28T10:20:00', notes: 'Praça principal.' },
  { id: 'exp-2', tripId: 'trip-1', driverId: 'driver-1', vehicleId: 'vehicle-1', type: 'Alimentação', value: 65, date: '2026-05-28T13:00:00' },
  { id: 'exp-3', tripId: 'trip-2', driverId: 'driver-2', vehicleId: 'vehicle-7', type: 'Pedágio', value: 40, date: '2026-05-24T07:30:00' },
  { id: 'exp-4', tripId: 'trip-3', driverId: 'driver-3', vehicleId: 'vehicle-3', type: 'Hospedagem', value: 220, date: '2026-05-20T20:00:00' },
  { id: 'exp-5', tripId: 'trip-3', driverId: 'driver-3', vehicleId: 'vehicle-3', type: 'Descarga', value: 400, date: '2026-05-20T17:30:00' },
  { id: 'exp-6', tripId: 'trip-4', driverId: 'driver-4', vehicleId: 'vehicle-6', type: 'Pedágio', value: 225, date: '2026-05-18T12:00:00' },
]

export const maintenances: Maintenance[] = [
  { id: 'mnt-1', vehicleId: 'vehicle-2', maintenanceType: 'corretiva', serviceIds: ['service-12'], cause: 'Pedal de freio com folga e luz de injeção', date: '2026-05-25', currentKm: 528900, value: 3850, mechanicId: 'mechanic-2', status: 'em_andamento', notes: 'Aguardando peça do sensor de injeção.' },
  { id: 'mnt-2', vehicleId: 'vehicle-5', maintenanceType: 'corretiva', serviceIds: ['service-13', 'service-12'], cause: 'Motor superaquecendo', date: '2026-04-09', currentKm: 689000, value: 12400, mechanicId: 'mechanic-1', status: 'aberta', notes: 'Retífica parcial em avaliação.' },
  { id: 'mnt-3', vehicleId: 'vehicle-1', maintenanceType: 'preventiva', serviceIds: ['service-1', 'service-2'], cause: 'Troca periódica de óleo e filtro', date: '2026-04-22', currentKm: 402300, value: 1850, mechanicId: 'mechanic-2', status: 'concluida' },
  { id: 'mnt-4', vehicleId: 'vehicle-1', maintenanceType: 'preventiva', serviceIds: ['service-7'], cause: 'Rodízio preventivo de pneus', date: '2026-03-10', currentKm: 390000, value: 620, mechanicId: 'mechanic-3', status: 'concluida' },
  { id: 'mnt-5', vehicleId: 'vehicle-3', maintenanceType: 'preventiva', serviceIds: ['service-9', 'service-4'], cause: 'Revisão geral', date: '2026-02-18', currentKm: 180000, value: 3102.4, mechanicId: 'mechanic-1', status: 'concluida' },
  { id: 'mnt-6', vehicleId: 'vehicle-8', maintenanceType: 'corretiva', serviceIds: ['service-12'], cause: 'Veículo não dá partida', date: '2026-05-19', currentKm: 67500, value: 400, mechanicId: 'mechanic-3', status: 'aberta' },
]

export const pendingItems: PendingItem[] = [
  { id: 'pend-1', type: 'manutencao_aberta', severity: 'critica', vehicleId: 'vehicle-2', title: 'Manutenção em andamento no SPA-7B12', description: 'Veículo Volvo FH 540 está indisponível para viagem.', status: 'aberta', actionLabel: 'Abrir manutenção' },
  { id: 'pend-2', type: 'manutencao_aberta', severity: 'critica', vehicleId: 'vehicle-5', title: 'Manutenção aberta no BAH-1E58', description: 'Motor superaquecendo, necessidade de avaliação.', status: 'aberta', actionLabel: 'Abrir manutenção' },
  { id: 'pend-3', type: 'documentacao', severity: 'critica', vehicleId: 'vehicle-4', title: 'Documentação vencida', description: 'CRLV do PRC-4D33 está vencido.', dueDate: '2025-12-20', status: 'aberta', actionLabel: 'Abrir veículo' },
  { id: 'pend-4', type: 'ceturb', severity: 'critica', vehicleId: 'vehicle-4', title: 'CETURB vencida', description: 'Vencimento CETURB do PRC-4D33 em 20/11/2025.', dueDate: '2025-11-20', status: 'aberta', actionLabel: 'Abrir veículo' },
  { id: 'pend-5', type: 'ceturb', severity: 'critica', vehicleId: 'vehicle-7', title: 'CETURB vencida', description: 'Vencimento CETURB do SAL-0K21 em 28/12/2025.', dueDate: '2025-12-28', status: 'aberta', actionLabel: 'Abrir veículo' },
  { id: 'pend-6', type: 'cnh', severity: 'critica', driverId: 'driver-4', title: 'CNH vencida', description: 'Motorista Marcos Vinícius está com habilitação vencida.', dueDate: '2025-12-10', status: 'aberta', actionLabel: 'Abrir motorista' },
  { id: 'pend-7', type: 'servico_km', severity: 'critica', vehicleId: 'vehicle-1', serviceId: 'service-1', title: 'Troca de óleo vencida', description: 'RIO-2A45 atingiu o KM previsto para troca de óleo.', dueKm: 412300, currentKm: 412300, status: 'aberta', actionLabel: 'Registrar manutenção' },
  { id: 'pend-8', type: 'servico_km', severity: 'atencao', vehicleId: 'vehicle-1', serviceId: 'service-8', title: 'Troca de pneus próxima', description: 'Faltam aproximadamente 7.700 km para troca de pneus.', dueKm: 420000, currentKm: 412300, status: 'aberta', actionLabel: 'Abrir veículo' },
  { id: 'pend-9', type: 'servico_km', severity: 'atencao', vehicleId: 'vehicle-2', serviceId: 'service-8', title: 'Controle de pneus próximo', description: 'SPA-7B12 está próximo da próxima troca de pneus.', dueKm: 535000, currentKm: 528900, status: 'aberta', actionLabel: 'Abrir veículo' },
  { id: 'pend-10', type: 'servico_tempo', severity: 'atencao', vehicleId: 'vehicle-3', serviceId: 'service-10', title: 'CETURB próxima do vencimento', description: 'MGE-9C77 tem inspeção CETURB próxima.', dueDate: '2026-04-05', status: 'aberta', actionLabel: 'Abrir veículo' },
]
