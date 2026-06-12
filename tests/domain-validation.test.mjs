import assert from 'node:assert/strict'
import test from 'node:test'

import { canAccessPath, getRoleHome, isUserRole } from '@/lib/auth'
import {
  canAccessAdminOwnedRecord,
  createAdminAccess,
  resolveAdminOwnerId,
} from '@/lib/admin-scope'
import { parseAdminPayload } from '@/lib/admin-management-service'
import {
  getDriverLicenseStatus,
  normalizeOptionalText,
  toNumber,
} from '@/lib/driver-utils'
import { parseExpensePayload } from '@/lib/expenses-service'
import {
  parseMaintenancePayload,
  isMaintenanceEditable,
} from '@/lib/maintenances-service'
import { parsePartPayload } from '@/lib/parts-service'
import { parsePendingPayload } from '@/lib/pendings-service'
import {
  parseRefuelingPayload,
  refuelingPayloadToDatabase,
} from '@/lib/refuelings-service'
import { parseServicePayload, servicePayloadToDatabase } from '@/lib/services-service'
import {
  parseConcludeTripPayload,
  parseCreateTripPayload,
  parseUpdateTripPayload,
} from '@/lib/trips-service'
import { parseVehiclePayload } from '@/lib/vehicles-service'
import {
  parseEndTripPayload,
  parseExpensePayload as parseDriverExpense,
  parseRefuelingPayload as parseDriverRefueling,
  parseStartTripPayload,
} from '@/lib/driver-portal-service'

function throwsMessage(callback, message) {
  assert.throws(callback, (error) => error instanceof Error && error.message.includes(message))
}

test('autorização direciona e restringe cada papel', () => {
  assert.equal(isUserRole('admin'), true)
  assert.equal(isUserRole('motorista'), true)
  assert.equal(isUserRole('mecanico'), true)
  assert.equal(isUserRole('driver'), false)
  assert.equal(getRoleHome('admin'), '/admin/dashboard')
  assert.equal(getRoleHome('motorista'), '/driver')
  assert.equal(getRoleHome('mecanico'), '/mechanic')
  assert.equal(canAccessPath('admin', '/admin/veiculos'), true)
  assert.equal(canAccessPath('motorista', '/admin/veiculos'), false)
  assert.equal(canAccessPath('mecanico', '/mechanic/manutencoes/1'), true)
  assert.equal(canAccessPath('motorista', '/driver'), true)
})

test('escopo administrativo diferencia acesso global e responsabilidade direta', () => {
  const global = createAdminAccess('admin-global', 'global')
  const restricted = createAdminAccess('admin-a', 'restrito')

  assert.equal(global.isGlobal, true)
  assert.equal(restricted.isGlobal, false)
  assert.equal(canAccessAdminOwnedRecord(global, 'admin-b'), true)
  assert.equal(canAccessAdminOwnedRecord(restricted, 'admin-a'), true)
  assert.equal(canAccessAdminOwnedRecord(restricted, 'admin-b'), false)
  assert.equal(resolveAdminOwnerId(restricted, 'admin-b'), 'admin-a')
  assert.equal(resolveAdminOwnerId(global, 'admin-b'), 'admin-b')
  assert.equal(resolveAdminOwnerId(global), 'admin-global')
})

test('cadastro administrativo exige nível e credenciais válidas', () => {
  assert.deepEqual(parseAdminPayload({
    name: 'Gestor de caminhões',
    email: 'GESTOR@example.com',
    password: 'secret123',
    phone: '27999999999',
    level: 'restrito',
  }), {
    name: 'Gestor de caminhões',
    email: 'gestor@example.com',
    password: 'secret123',
    phone: '27999999999',
    active: true,
    level: 'restrito',
  })

  throwsMessage(() => parseAdminPayload({
    name: 'Gestor',
    email: 'gestor@example.com',
    password: '123',
    level: 'restrito',
  }), 'pelo menos 6 caracteres')
  throwsMessage(() => parseAdminPayload({
    name: 'Gestor',
    email: 'gestor@example.com',
    password: 'secret123',
    level: 'super',
  }), 'Nível administrativo inválido')
})

test('utilitários normalizam texto e números sem propagar NaN', () => {
  assert.equal(normalizeOptionalText('  observação  '), 'observação')
  assert.equal(normalizeOptionalText('   '), null)
  assert.equal(toNumber('12.5'), 12.5)
  assert.equal(toNumber('inválido'), 0)
})

test('situação da CNH diferencia vencida, próxima e em dia', () => {
  assert.equal(getDriverLicenseStatus('2000-01-01'), 'vencido')
  assert.equal(getDriverLicenseStatus('2100-01-01'), 'em_dia')
  assert.equal(getDriverLicenseStatus(null), 'vencido')
})

test('veículo aceita múltiplos motoristas e valida o principal', () => {
  const payload = parseVehiclePayload({
    type: 'Caminhão',
    brand: 'Scania',
    model: 'R 450',
    plate: 'abc-1d23',
    year: '2024',
    status: 'ativo',
    currentKm: '12.500',
    documentationDueDate: '2027-01-01',
    tachographDueDate: '2027-01-01',
    ceturbDueDate: '2027-01-01',
    driverIds: ['driver-a', 'driver-b', 'driver-a'],
    principalDriverId: 'driver-b',
  })

  assert.equal(payload.plate, 'ABC-1D23')
  assert.deepEqual(payload.driverIds, ['driver-a', 'driver-b'])
  assert.equal(payload.principalDriverId, 'driver-b')
  throwsMessage(() => parseVehiclePayload({
    ...payload,
    documentationDueDate: '2027-01-01',
    tachographDueDate: '2027-01-01',
    ceturbDueDate: '2027-01-01',
    driverIds: ['driver-a'],
    principalDriverId: 'driver-b',
  }), 'motorista principal')
})

test('serviço converte periodicidade para o formato persistido', () => {
  const payload = parseServicePayload({
    name: 'Troca de óleo',
    category: 'Óleo',
    suggestedMaintenanceType: 'preventiva',
    periodicityType: 'km',
    periodicityValue: '10000',
    defaultValue: '180.50',
    active: true,
  })

  assert.equal(payload.periodicityKm, 10000)
  assert.equal(payload.periodicityDays, null)
  assert.equal(payload.defaultValue, 180.5)
  assert.equal(servicePayloadToDatabase(payload).valor_padrao, 180.5)
  assert.equal(servicePayloadToDatabase(payload).tipo_periodicidade, 'km')
  throwsMessage(() => parseServicePayload({
    name: 'Inspeção',
    category: 'Outros',
    suggestedMaintenanceType: 'preventiva',
    periodicityType: 'tempo',
    periodicityValue: '1.5',
    defaultValue: '50',
  }), 'dias inteiros')
})

test('manutenção exige relações e valores operacionais válidos', () => {
  const payload = parseMaintenancePayload({
    vehicleId: 'vehicle-1',
    maintenanceType: 'corretiva',
    cause: 'Falha no sistema de freios',
    openedAt: '2026-06-06T10:00',
    vehicleKm: '25000',
    responsibleMechanicId: 'mechanic-1',
    status: 'aberta',
    services: [
      { serviceId: 'service-1', appliedValue: '150' },
      { serviceId: 'service-2', appliedValue: '75.50' },
    ],
    parts: [{
      partId: 'part-1',
      quantity: '2',
      unitValue: '49.90',
    }],
  })

  assert.deepEqual(payload.services, [
    { serviceId: 'service-1', appliedValue: 150 },
    { serviceId: 'service-2', appliedValue: 75.5 },
  ])
  assert.deepEqual(payload.parts, [{
    partId: 'part-1',
    quantity: 2,
    unitValue: 49.9,
  }])
  assert.equal(payload.completedAt, null)
  assert.equal(isMaintenanceEditable('aberta'), true)
  assert.equal(isMaintenanceEditable('concluida'), false)
  throwsMessage(() => parseMaintenancePayload({
    ...payload,
    services: [],
  }), 'pelo menos um serviço')
  throwsMessage(() => parseMaintenancePayload({
    ...payload,
    services: [
      { serviceId: 'service-1', appliedValue: 10 },
      { serviceId: 'service-1', appliedValue: 20 },
    ],
  }), 'mesmo serviço')
  throwsMessage(() => parseMaintenancePayload({
    ...payload,
    parts: [
      { partId: 'part-1', quantity: 1, unitValue: 10 },
      { partId: 'part-1', quantity: 1, unitValue: 10 },
    ],
  }), 'mesma peça')
  throwsMessage(() => parseMaintenancePayload({
    ...payload,
    status: 'concluida',
  }), 'data de conclusão')
  throwsMessage(() => parseMaintenancePayload({
    ...payload,
    status: 'concluida',
    completedAt: '2026-06-06T09:00',
  }), 'anterior à abertura')
  throwsMessage(() => parseMaintenancePayload({
    ...payload,
    status: 'concluida',
    completedAt: '2999-06-06T11:00',
  }), 'futuro')
})

test('peça valida catálogo, estoque mínimo e valor padrão', () => {
  const part = parsePartPayload({
    code: ' flt-001 ',
    name: 'Filtro de óleo',
    category: 'Filtros',
    unit: 'unidade',
    stockQuantity: '12',
    minimumStock: '3',
    unitValue: '49,90',
    active: true,
  })

  assert.equal(part.code, 'FLT-001')
  assert.equal(part.stockQuantity, 12)
  assert.equal(part.unitValue, 49.9)
  throwsMessage(() => parsePartPayload({
    ...part,
    stockQuantity: '-1',
  }), 'maior ou igual a zero')
  throwsMessage(() => parsePartPayload({
    ...part,
    unit: 'unidade',
    stockQuantity: '2.5',
  }), 'números inteiros')
  assert.equal(parsePartPayload({
    ...part,
    unit: 'litro',
    stockQuantity: '2.5',
  }).stockQuantity, 2.5)
})

test('viagens validam criação, edição e conclusão', () => {
  const created = parseCreateTripPayload({
    driverId: 'driver-1',
    vehicleId: 'vehicle-1',
    origin: 'Vitória/ES',
    destination: 'São Mateus/ES',
    startedAt: '2026-06-06T08:00',
    initialKm: '23000',
  })
  assert.equal(created.initialKm, 23000)
  assert.equal(parseUpdateTripPayload({ origin: 'A', destination: 'B' }).destination, 'B')
  assert.equal(parseConcludeTripPayload({
    finishedAt: '2026-06-06T12:00',
    finalKm: '23200',
  }).finalKm, 23200)
  throwsMessage(() => parseCreateTripPayload({
    startedAt: '2026-06-06T08:00',
    initialKm: '0',
  }), 'obrigatórios')
})

test('abastecimento calcula total e respeita a relação da viagem', () => {
  const payload = parseRefuelingPayload({
    tripId: 'trip-1',
    vehicleId: 'vehicle-form',
    driverId: 'driver-form',
    registeredAt: '2026-06-06T10:00',
    registeredKm: '23200',
    fuelType: 'Diesel S10',
    liters: '100',
    unitValue: '6.199',
  })
  const row = refuelingPayloadToDatabase(payload, {
    vehicleId: 'vehicle-trip',
    driverId: 'driver-trip',
  })
  assert.equal(row.veiculo_id, 'vehicle-trip')
  assert.equal(row.motorista_id, 'driver-trip')
  assert.equal(row.valor_total, 619.9)
  throwsMessage(() => parseRefuelingPayload({
    ...payload,
    fuelType: 'Querosene',
  }), 'combustível inválido')
})

test('despesa usa a relação da viagem e exige valor positivo', () => {
  const payload = parseExpensePayload({
    tripId: 'trip-1',
    vehicleId: 'vehicle-form',
    category: 'Pedágio',
    value: '35,50',
    registeredAt: '2026-06-06T10:00',
  })
  assert.equal(payload.tripId, 'trip-1')
  assert.equal(payload.value, 35.5)
  throwsMessage(() => parseExpensePayload({
    ...payload,
    value: '0',
  }), 'maior que zero')

  const partExpense = parseExpensePayload({
    vehicleId: 'vehicle-1',
    category: 'Peças',
    registeredAt: '2026-06-06T10:00',
    parts: [{ partId: 'part-1', quantity: '2', unitValue: '45,50' }],
  })
  assert.deepEqual(partExpense.parts, [{
    partId: 'part-1',
    quantity: 2,
    unitValue: 45.5,
  }])
  throwsMessage(() => parseExpensePayload({
    vehicleId: 'vehicle-1',
    category: 'Peças',
    registeredAt: '2026-06-06T10:00',
    parts: [],
  }), 'pelo menos uma peça')
})

test('portal do motorista valida os quatro fluxos operacionais', () => {
  assert.equal(parseStartTripPayload({
    vehicleId: 'vehicle-1',
    origin: 'A',
    destination: 'B',
    initialKm: '10',
  }).initialKm, 10)
  assert.equal(parseDriverRefueling({
    registeredKm: '20',
    fuelType: 'Diesel S10',
    liters: '5',
  }).liters, 5)
  assert.equal(parseDriverExpense({
    category: 'Alimentação',
    value: '25',
  }).value, 25)
  assert.equal(parseEndTripPayload({ finalKm: '30' }).finalKm, 30)
})

test('pendência manual exige título, severidade e vínculo operacional', () => {
  const payload = parsePendingPayload({
    title: 'Documento pendente',
    severity: 'critica',
    type: 'documentacao',
    vehicleId: 'vehicle-1',
  })
  assert.equal(payload.vehicleId, 'vehicle-1')
  throwsMessage(() => parsePendingPayload({
    title: 'Sem vínculo',
    severity: 'atencao',
  }), 'pelo menos um registro')
})
