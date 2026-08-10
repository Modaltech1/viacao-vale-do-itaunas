import type {
  VideotelemetryChannel,
  VideotelemetryDevice,
  VideotelemetryDeviceView,
} from '@/types/videotelemetry'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseVideotelemetryChannels(value: unknown): VideotelemetryChannel[] {
  if (!Array.isArray(value)) {
    throw new Error('A configuração dos canais de videotelemetria é inválida.')
  }

  const channels = value.map((item) => {
    if (!isRecord(item)) {
      throw new Error('A configuração dos canais de videotelemetria é inválida.')
    }

    const number = Number(item.numero)
    const name = String(item.nome ?? '').trim()
    const type = String(item.tipo ?? '').trim() || null

    if (!Number.isInteger(number) || number <= 0 || !name) {
      throw new Error('A configuração dos canais de videotelemetria é inválida.')
    }

    return { number, name, type }
  })

  if (new Set(channels.map((channel) => channel.number)).size !== channels.length) {
    throw new Error('Existem canais de videotelemetria duplicados.')
  }

  return channels
}

export function parseVideotelemetryChannelNumber(value: unknown) {
  const channel = Number(value)
  if (!Number.isInteger(channel) || channel <= 0) {
    throw new Error('Selecione um canal de câmera válido.')
  }
  return channel
}

export function maskVideotelemetryTerminal(terminalId: string) {
  const normalized = terminalId.trim()
  if (normalized.length <= 4) return normalized
  return `•••• ${normalized.slice(-4)}`
}

export function toVideotelemetryDeviceView(
  device: VideotelemetryDevice,
): VideotelemetryDeviceView {
  return {
    id: device.id,
    model: device.model,
    terminalLabel: maskVideotelemetryTerminal(device.terminalId),
    channels: device.channels,
    active: device.active,
  }
}
