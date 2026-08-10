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
  driverProfessionalStatusLabel,
  getDriverLicenseStatus,
  isDriverProfessionalStatus,
  normalizeOptionalText,
  toNumber,
} from '@/lib/driver-utils'
import { parseExpensePayload } from '@/lib/expenses-service'
import {
  compactDateTime,
  formatTripDuration,
  tripDurationMinutes,
} from '@/lib/format'
import { resolveUserFacingError } from '@/lib/error-messages'
import {
  formatKm,
  hasOneDecimalKmPrecision,
  kmInputValue,
  normalizeKmInput,
  parseKmValue,
} from '@/lib/km'
import { tripFinalKmMinimum, tripFinalKmSuggestion } from '@/lib/trip-km'
import {
  parseMaintenancePayload,
  isMaintenanceEditable,
  parseRemoveMaintenancePayload,
} from '@/lib/maintenances-service'
import { parsePartPayload } from '@/lib/parts-service'
import { parsePendingPayload } from '@/lib/pendings-service'
import {
  parseRefuelingPayload,
  refuelingPayloadToDatabase,
} from '@/lib/refuelings-service'
import { parseServicePayload, servicePayloadToDatabase } from '@/lib/services-service'
import { parseSinisterPayload } from '@/lib/sinisters-service'
import {
  parseConcludeTripPayload,
  parseCreateTripPayload,
  parseRemoveTripPayload,
  parseUpdateTripPayload,
} from '@/lib/trips-service'
import { parseVehiclePayload } from '@/lib/vehicles-service'
import { vehicleFleetCode, vehicleLabel } from '@/lib/vehicle-label'
import { compareByTextPtBr, compareTextPtBr } from '@/lib/sorting'
import {
  parseEndTripPayload,
  parseExpensePayload as parseDriverExpense,
  parseRefuelingPayload as parseDriverRefueling,
  parseStartTripPayload,
} from '@/lib/driver-portal-service'

function throwsMessage(callback, message) {
  assert.throws(callback, (error) => error instanceof Error && error.message.includes(message))
}

test('ordenacao textual compartilhada usa pt-BR e numeros naturais', () => {
  assert.deepEqual(['Frota 10', 'Frota 2', 'Frota 1'].sort(compareTextPtBr), [
    'Frota 1',
    'Frota 2',
    'Frota 10',
  ])
  assert.equal(compareTextPtBr('Alvaro', 'Bruno') < 0, true)

  const items = [
    { name: 'Carlos', email: 'c@teste.com' },
    { name: 'Ana', email: 'a@teste.com' },
    { name: 'Ana', email: 'b@teste.com' },
  ].sort((a, b) => compareByTextPtBr(a, b, (item) => item.name, (item) => item.email))

  assert.deepEqual(items.map((item) => item.email), ['a@teste.com', 'b@teste.com', 'c@teste.com'])
})

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

test('mensagens de erro operacionais nao vazam detalhes tecnicos', () => {
  const cases = [
    resolveUserFacingError(
      new Error('Invalid API key'),
      'Nao foi possivel salvar.',
    ),
    resolveUserFacingError(
      new Error('new row violates check constraint "viagens_km_final_check"'),
      'Nao foi possivel salvar.',
    ),
    resolveUserFacingError(
      new Error('KM atual nao pode ser menor que o ultimo evento operacional do veiculo (1325880)'),
      'Nao foi possivel salvar.',
    ),
    resolveUserFacingError(
      new Error('duplicate key value violates unique constraint "veiculos_placa_normalizada_uniq"'),
      'Nao foi possivel salvar.',
      400,
      [{
        includes: ['veiculos_placa_normalizada_uniq'],
        message: 'Ja existe um veiculo cadastrado com essa placa.',
        status: 409,
      }],
    ),
    resolveUserFacingError(
      new Error('Operacao fora da responsabilidade do administrador'),
      'Nao foi possivel salvar.',
    ),
  ]

  assert.equal(cases[0].message, 'O sistema não conseguiu acessar o banco de dados. Avise o suporte.')
  assert.equal(cases[0].status, 500)
  assert.equal(cases[1].message, 'O KM final deve ser maior que o KM inicial.')
  assert.equal(cases[2].message, 'O KM atual não pode ser menor que o último registro operacional do veículo. Revise viagens, abastecimentos ou manutenções.')
  assert.equal(cases[2].status, 409)
  assert.equal(cases[3].message, 'Ja existe um veiculo cadastrado com essa placa.')
  assert.equal(cases[3].status, 409)
  assert.equal(cases[4].message, 'Você não tem permissão para fazer esta ação.')
  assert.equal(cases[4].status, 403)

  for (const item of cases) {
    assert.doesNotMatch(item.message, /constraint|duplicate key|invalid api key|supabase|service_role/i)
  }
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

test('identidade principal do veículo nunca usa placa como fallback de frota', () => {
  assert.equal(vehicleFleetCode({ codigo_frota: 'FROTA-42', placa: 'ABC-1D23' }), 'FROTA-42')
  assert.equal(vehicleFleetCode({ placa: 'ABC-1D23' }), 'Sem frota')
  assert.equal(vehicleLabel({ placa: 'ABC-1D23', marca: 'Scania', modelo: 'R 450' }), 'Sem frota · Scania R 450')
})

test('duração de viagem preserva minutos para análise e formata horas para exibição', () => {
  const startedAt = '2026-06-15T05:10:00.000Z'
  const finishedAt = '2026-06-15T10:32:00.000Z'

  assert.equal(tripDurationMinutes(startedAt, finishedAt), 322)
  assert.equal(formatTripDuration(startedAt, finishedAt), '5h 22min')
  assert.equal(
    formatTripDuration(startedAt, null, new Date('2026-06-15T06:10:00.000Z')),
    '1h',
  )
  assert.equal(tripDurationMinutes(finishedAt, startedAt), null)
  assert.match(compactDateTime(startedAt), /15\/06/)
})

test('situação da CNH diferencia vencida, próxima e em dia', () => {
  assert.equal(getDriverLicenseStatus('2000-01-01'), 'vencido')
  assert.equal(getDriverLicenseStatus('2100-01-01'), 'em_dia')
  assert.equal(getDriverLicenseStatus(null), 'vencido')
})

test('quilometragem usa ponto decimal sem separador de milhar', () => {
  assert.equal(formatKm(34567), '34567.0')
  assert.equal(formatKm(1231231234.2), '1231231234.2')
  assert.equal(formatKm(10.26), '10.3')
  assert.equal(kmInputValue(1000), '1000.0')
  assert.equal(normalizeKmInput('1.000,29'), '1.0')
  assert.equal(normalizeKmInput('abc1000,29'), '1000.2')
  assert.equal(parseKmValue('1000.2', 'KM'), 1000.2)
  assert.equal(hasOneDecimalKmPrecision(1000.2), true)
  assert.equal(hasOneDecimalKmPrecision(1000.25), false)
  throwsMessage(() => parseKmValue('1000', 'KM'), 'uma casa decimal')
  throwsMessage(() => parseKmValue('1.000,2', 'KM'), 'uma casa decimal')
  throwsMessage(() => parseKmValue('1000.25', 'KM'), 'uma casa decimal')
})

test('veículo aceita múltiplos motoristas e documentos opcionais', () => {
  const baseVehicleBody = {
    type: 'Caminhão',
    brand: 'Scania',
    model: 'R 450',
    fleetCode: 'frota-07',
    plate: 'abc-1d23',
    year: '2024',
    status: 'ativo',
    currentKm: '12500.0',
    documents: [
      { code: 'documentacao', dueDate: '2027-01-01' },
      { code: 'tacografo', dueDate: '2027-02-01' },
    ],
    driverIds: ['driver-a', 'driver-b', 'driver-a'],
    principalDriverId: 'driver-b',
  }

  const payload = parseVehiclePayload(baseVehicleBody)

  assert.equal(payload.fleetCode, 'FROTA-07')
  assert.equal(payload.plate, 'ABC-1D23')
  assert.deepEqual(payload.driverIds, ['driver-a', 'driver-b'])
  assert.equal(payload.principalDriverId, 'driver-b')
  assert.equal(payload.documentDates.documentacao, '2027-01-01')
  assert.equal(payload.documentDates.tacografo, '2027-02-01')
  assert.equal(payload.documentDates.ceturb, undefined)

  throwsMessage(() => parseVehiclePayload({
    ...baseVehicleBody,
    driverIds: ['driver-a'],
    principalDriverId: 'driver-b',
  }), 'motorista principal')

  throwsMessage(() => parseVehiclePayload({
    ...baseVehicleBody,
    documents: [
      { code: 'documentacao', dueDate: '2027-01-01' },
      { code: 'documentacao', dueDate: '2027-02-01' },
    ],
  }), 'mesmo documento')

  throwsMessage(() => parseVehiclePayload({
    ...baseVehicleBody,
    documents: [{ code: 'documentacao', dueDate: '' }],
  }), 'vencimento')

  const legacyPayload = parseVehiclePayload({
    ...baseVehicleBody,
    documents: undefined,
    documentationDueDate: '2027-01-01',
    aetDueDate: '2027-03-01',
  })

  assert.equal(legacyPayload.documentDates.documentacao, '2027-01-01')
  assert.equal(legacyPayload.documentDates.aet, '2027-03-01')
})
test('serviço converte periodicidade para o formato persistido', () => {
  const payload = parseServicePayload({
    name: 'Troca de óleo',
    category: 'Óleo',
    suggestedMaintenanceType: 'preventiva',
    periodicityType: 'km',
    periodicityValue: '10000.0',
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
    vehicleKm: '25000.0',
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
    vehicleKm: kmInputValue(payload.vehicleKm),
    services: [],
  }), 'pelo menos um serviço')
  throwsMessage(() => parseMaintenancePayload({
    ...payload,
    vehicleKm: kmInputValue(payload.vehicleKm),
    services: [
      { serviceId: 'service-1', appliedValue: 10 },
      { serviceId: 'service-1', appliedValue: 20 },
    ],
  }), 'mesmo serviço')
  throwsMessage(() => parseMaintenancePayload({
    ...payload,
    vehicleKm: kmInputValue(payload.vehicleKm),
    parts: [
      { partId: 'part-1', quantity: 1, unitValue: 10 },
      { partId: 'part-1', quantity: 1, unitValue: 10 },
    ],
  }), 'mesma peça')
  throwsMessage(() => parseMaintenancePayload({
    ...payload,
    vehicleKm: kmInputValue(payload.vehicleKm),
    status: 'concluida',
  }), 'data de conclusão')
  throwsMessage(() => parseMaintenancePayload({
    ...payload,
    vehicleKm: kmInputValue(payload.vehicleKm),
    status: 'concluida',
    completedAt: '2026-06-06T09:00',
  }), 'anterior à abertura')
  throwsMessage(() => parseMaintenancePayload({
    ...payload,
    vehicleKm: kmInputValue(payload.vehicleKm),
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
    initialKm: '23000.0',
  })
  assert.equal(created.initialKm, 23000)
  const updated = parseUpdateTripPayload({
    origin: 'A',
    destination: 'B',
    finishedAt: '2026-06-06T12:00',
    finalKm: '23200.0',
  })
  assert.equal(updated.destination, 'B')
  assert.equal(updated.finalKm, 23200)
  assert.equal(parseUpdateTripPayload({ origin: 'A', destination: 'B', finalKm: '' }).finalKm, null)
  assert.equal(parseConcludeTripPayload({
    finishedAt: '2026-06-06T12:00',
    finalKm: '23200.0',
  }).finalKm, 23200)
  assert.equal(parseRemoveTripPayload({ reason: 'Lançamento duplicado' }).reason, 'Lançamento duplicado')
  throwsMessage(() => parseRemoveTripPayload({ reason: 'x' }), 'pelo menos 5 caracteres')
  assert.equal(parseRemoveMaintenancePayload({ reason: 'Registro duplicado' }).reason, 'Registro duplicado')
  throwsMessage(() => parseRemoveMaintenancePayload({ reason: 'x' }), 'pelo menos 5 caracteres')
  throwsMessage(() => parseCreateTripPayload({
    startedAt: '2026-06-06T08:00',
    initialKm: '0.0',
  }), 'obrigatórios')
})

test('encerramento de viagem exige avanço real do odômetro', () => {
  assert.equal(tripFinalKmMinimum(23000, 23000), 23000.1)
  assert.equal(tripFinalKmSuggestion(23000, 23000), '')
  assert.equal(tripFinalKmMinimum(23000, 23200), 23200)
  assert.equal(tripFinalKmSuggestion(23000, 23200), '23200.0')
})

test('abastecimento calcula total e respeita a relação da viagem', () => {
  const payload = parseRefuelingPayload({
    tripId: 'trip-1',
    vehicleId: 'vehicle-form',
    driverId: 'driver-form',
    registeredAt: '2026-06-06T10:00',
    registeredKm: '23200.0',
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
    registeredKm: kmInputValue(payload.registeredKm),
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

test('sinistro operacional exige veiculo, descricao e custos validos', () => {
  const payload = parseSinisterPayload({
    vehicleId: 'vehicle-1',
    driverId: 'driver-1',
    occurredAt: '2026-06-06T10:00',
    type: 'colisao',
    severity: 'critica',
    status: 'aberto',
    description: 'Colisao lateral durante manobra.',
    costs: [{
      category: 'funilaria',
      description: 'Reparo lateral',
      quantity: '1',
      unitValue: '1500,50',
    }],
  })

  assert.equal(payload.vehicleId, 'vehicle-1')
  assert.equal(payload.driverId, 'driver-1')
  assert.equal(payload.costs[0].unitValue, 1500.5)
  throwsMessage(() => parseSinisterPayload({
    ...payload,
    vehicleId: '',
  }), 'veículo')
  throwsMessage(() => parseSinisterPayload({
    ...payload,
    description: ' ',
  }), 'Descreva')
  throwsMessage(() => parseSinisterPayload({
    ...payload,
    costs: [{ category: 'funilaria', description: '', quantity: '1', unitValue: '10' }],
  }), 'Descreva todos os custos')
})

test('portal do motorista valida os quatro fluxos operacionais', () => {
  assert.equal(parseStartTripPayload({
    vehicleId: 'vehicle-1',
    origin: 'A',
    destination: 'B',
    initialKm: '10.0',
  }).initialKm, 10)
  assert.equal(parseDriverRefueling({
    registeredKm: '20.0',
    fuelType: 'Diesel S10',
    liters: '5',
  }).liters, 5)
  assert.equal(parseDriverExpense({
    category: 'Alimentação',
    value: '25',
  }).value, 25)
  assert.equal(parseEndTripPayload({ finalKm: '30.0' }).finalKm, 30)
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
test('status inapto faz parte do domínio profissional do motorista', () => {
  assert.equal(isDriverProfessionalStatus('inapto'), true)
  assert.equal(driverProfessionalStatusLabel.inapto, 'Inapto')
  assert.equal(isDriverProfessionalStatus('bloqueado'), false)
})
