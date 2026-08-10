import assert from 'node:assert/strict'
import test from 'node:test'

import {
  maskVideotelemetryTerminal,
  parseVideotelemetryChannelNumber,
  parseVideotelemetryChannels,
  toVideotelemetryDeviceView,
} from '@/lib/videotelemetry-domain'

test('canais de videotelemetria sao validados em runtime', () => {
  assert.deepEqual(parseVideotelemetryChannels([
    { numero: 1, nome: 'C\u00e2mera frontal', tipo: 'frontal' },
    { numero: 2, nome: 'C\u00e2mera da cabine' },
  ]), [
    { number: 1, name: 'C\u00e2mera frontal', type: 'frontal' },
    { number: 2, name: 'C\u00e2mera da cabine', type: null },
  ])

  assert.throws(() => parseVideotelemetryChannels(null), /configura\u00e7\u00e3o dos canais/)
  assert.throws(
    () => parseVideotelemetryChannels([{ numero: 1, nome: 'A' }, { numero: 1, nome: 'B' }]),
    /duplicados/,
  )
  assert.throws(() => parseVideotelemetryChannelNumber(0), /canal de c\u00e2mera v\u00e1lido/)
  assert.equal(parseVideotelemetryChannelNumber('2'), 2)
})

test('resposta do dispositivo mascara identificadores sensiveis', () => {
  assert.equal(maskVideotelemetryTerminal('628072026338'), '\u2022\u2022\u2022\u2022 6338')
  assert.deepEqual(toVideotelemetryDeviceView({
    id: 'device-1',
    vehicleId: 'vehicle-1',
    terminalId: '628072026338',
    model: 'MC202P',
    channels: [{ number: 1, name: 'Frontal', type: 'frontal' }],
    active: true,
    deletedAt: null,
  }), {
    id: 'device-1',
    model: 'MC202P',
    terminalLabel: '\u2022\u2022\u2022\u2022 6338',
    channels: [{ number: 1, name: 'Frontal', type: 'frontal' }],
    active: true,
  })
})
