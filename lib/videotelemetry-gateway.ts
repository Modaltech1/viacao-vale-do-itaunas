import 'server-only'

import type {
  VideotelemetryLiveStatus,
  VideotelemetryStartResult,
  VideotelemetryStopResult,
} from '@/types/videotelemetry'

const DEFAULT_TIMEOUT_MS = 15_000

type GatewayClientOptions = {
  baseUrl: string
  apiKey: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

type GatewayRequestOptions = {
  method?: 'GET' | 'POST'
  searchParams?: Record<string, string>
}

function gatewayError(message: string, status: number) {
  const error = new Error(message)
  Object.assign(error, { status })
  return error
}

function validateLiveUrl(value: unknown, baseUrl: URL) {
  if (typeof value !== 'string' || !value.trim()) {
    throw gatewayError('O Gateway retornou uma URL de transmissão inválida.', 502)
  }

  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw gatewayError('O Gateway retornou uma URL de transmissão inválida.', 502)
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.hostname !== baseUrl.hostname) {
    throw gatewayError('O Gateway retornou uma URL de transmissão inválida.', 502)
  }

  return url.toString()
}

function parseStatusPayload(payload: unknown, baseUrl: URL): VideotelemetryLiveStatus {
  if (typeof payload !== 'object' || payload === null || !('running' in payload)) {
    throw gatewayError('O Gateway retornou uma resposta inválida.', 502)
  }

  const source = payload as Record<string, unknown>
  if (typeof source.running !== 'boolean') {
    throw gatewayError('O Gateway retornou uma resposta inválida.', 502)
  }

  if (!source.running) {
    return {
      running: false,
      channel: null,
      startedAt: null,
      url: null,
    }
  }

  const channel = Number(source.channel)
  if (!Number.isInteger(channel) || channel <= 0) {
    throw gatewayError('O Gateway retornou uma resposta inválida.', 502)
  }

  return {
    running: true,
    channel,
    startedAt: typeof source.startedAt === 'string' ? source.startedAt : null,
    url: validateLiveUrl(source.url, baseUrl),
  }
}

export function createVideotelemetryGatewayClient({
  baseUrl,
  apiKey,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl = fetch,
}: GatewayClientOptions) {
  const normalizedBaseUrl = baseUrl.trim()
  const normalizedApiKey = apiKey.trim()

  if (!normalizedBaseUrl || !normalizedApiKey) {
    throw gatewayError('A videotelemetria ainda não foi configurada. Avise o suporte.', 500)
  }

  let parsedBaseUrl: URL
  try {
    parsedBaseUrl = new URL(normalizedBaseUrl)
  } catch {
    throw gatewayError('A videotelemetria ainda não foi configurada. Avise o suporte.', 500)
  }

  async function request(pathname: string, options: GatewayRequestOptions = {}) {
    const url = new URL(pathname, `${parsedBaseUrl.toString().replace(/\/+$/, '')}/`)
    Object.entries(options.searchParams ?? {}).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetchImpl(url, {
        method: options.method ?? 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${normalizedApiKey}`,
        },
        cache: 'no-store',
        signal: controller.signal,
      })

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw gatewayError('Não foi possível autenticar no serviço de câmeras. Avise o suporte.', 502)
        }
        if (response.status >= 500) {
          throw gatewayError('O serviço de câmeras está indisponível. Tente novamente em instantes.', 503)
        }
        throw gatewayError('O serviço de câmeras não aceitou esta operação.', 502)
      }

      try {
        return await response.json() as unknown
      } catch {
        throw gatewayError('O Gateway retornou uma resposta inválida.', 502)
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw gatewayError('A câmera demorou para responder. Tente novamente.', 504)
      }
      if (error instanceof Error && 'status' in error) throw error
      throw gatewayError('Não foi possível conectar ao serviço de câmeras.', 503)
    } finally {
      clearTimeout(timeout)
    }
  }

  return {
    async getStatus() {
      return parseStatusPayload(await request('status'), parsedBaseUrl)
    },

    async startLive(channel: number): Promise<VideotelemetryStartResult> {
      const payload = await request('start', {
        method: 'POST',
        searchParams: { channel: String(channel) },
      })

      if (typeof payload !== 'object' || payload === null) {
        throw gatewayError('O Gateway retornou uma resposta inválida.', 502)
      }

      const source = payload as Record<string, unknown>
      if (source.success !== true) {
        throw gatewayError('Não foi possível iniciar a transmissão.', 502)
      }

      const startedChannel = Number(source.channel)
      if (!Number.isInteger(startedChannel) || startedChannel !== channel) {
        throw gatewayError('O Gateway iniciou um canal diferente do solicitado.', 502)
      }

      return {
        running: true,
        channel: startedChannel,
        startedAt: new Date().toISOString(),
        url: validateLiveUrl(source.url, parsedBaseUrl),
        alreadyRunning: source.alreadyRunning === true,
      }
    },

    async stopLive(): Promise<VideotelemetryStopResult> {
      const payload = await request('stop', { method: 'POST' })
      if (typeof payload !== 'object' || payload === null) {
        throw gatewayError('O Gateway retornou uma resposta inválida.', 502)
      }

      const source = payload as Record<string, unknown>
      if (source.success !== true || typeof source.stopped !== 'boolean') {
        throw gatewayError('Não foi possível encerrar a transmissão.', 502)
      }

      return { stopped: source.stopped }
    },
  }
}

function gatewayClientFromEnvironment() {
  return createVideotelemetryGatewayClient({
    baseUrl: process.env.PRODEXY_GATEWAY_BASE_URL ?? '',
    apiKey: process.env.PRODEXY_GATEWAY_API_KEY ?? '',
  })
}

export function getGatewayStatus() {
  return gatewayClientFromEnvironment().getStatus()
}

export function startGatewayLive(channel: number) {
  return gatewayClientFromEnvironment().startLive(channel)
}

export function stopGatewayLive() {
  return gatewayClientFromEnvironment().stopLive()
}

export function getGatewayPocTerminalId() {
  const terminalId = process.env.PRODEXY_GATEWAY_POC_TERMINAL_ID?.trim()
  if (!terminalId) {
    throw gatewayError('A videotelemetria ainda não foi configurada. Avise o suporte.', 500)
  }
  return terminalId
}
