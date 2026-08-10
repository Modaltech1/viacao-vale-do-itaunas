'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@prodexy/ui'
import {
  Camera,
  CircleAlert,
  ExternalLink,
  LoaderCircle,
  Radio,
  RefreshCw,
  Square,
  Video,
} from 'lucide-react'
import { Section } from '@/components/shared/section'
import { StatusBadge } from '@/components/shared/status-badge'
import { dateTime } from '@/lib/format'
import type {
  VideotelemetryDeviceView,
  VideotelemetryLiveStatus,
  VideotelemetryStartResult,
} from '@/types/videotelemetry'

type Operation = 'device' | 'status' | 'stop' | `start-${number}` | null

type Notice = {
  tone: 'warning' | 'error'
  text: string
}

async function readApiResponse<T>(response: Response, fallback: string): Promise<T> {
  let result: (T & { error?: string }) | null = null

  try {
    result = await response.json() as T & { error?: string }
  } catch {
    // The route should always return JSON, but the user still receives a useful message.
  }

  if (!response.ok || !result) {
    throw new Error(result?.error || fallback)
  }

  return result
}

export function VehicleVideotelemetry({ vehicleId }: { vehicleId: string }) {
  const [device, setDevice] = useState<VideotelemetryDeviceView | null>(null)
  const [live, setLive] = useState<VideotelemetryLiveStatus | null>(null)
  const [operation, setOperation] = useState<Operation>('device')
  const [deviceLoaded, setDeviceLoaded] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const baseEndpoint = `/api/admin/veiculos/${vehicleId}/videotelemetria`

  const refreshStatus = useCallback(async () => {
    setOperation('status')
    setNotice(null)

    try {
      const response = await fetch(`${baseEndpoint}/status`, { cache: 'no-store' })
      const result = await readApiResponse<{ live: VideotelemetryLiveStatus }>(
        response,
        'Não foi possível consultar a transmissão.',
      )
      setLive(result.live)
    } catch (error) {
      setLive(null)
      setNotice({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Não foi possível consultar a transmissão.',
      })
    } finally {
      setOperation(null)
    }
  }, [baseEndpoint])

  const loadDevice = useCallback(async () => {
    setOperation('device')
    setDeviceLoaded(false)
    setNotice(null)

    try {
      const response = await fetch(baseEndpoint, { cache: 'no-store' })
      const result = await readApiResponse<{ device: VideotelemetryDeviceView | null }>(
        response,
        'Não foi possível consultar a videotelemetria.',
      )
      setDevice(result.device)
      setDeviceLoaded(true)

      if (result.device?.active) {
        await refreshStatus()
      } else {
        setLive(null)
        setOperation(null)
      }
    } catch (error) {
      setDevice(null)
      setDeviceLoaded(true)
      setOperation(null)
      setNotice({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Não foi possível consultar a videotelemetria.',
      })
    }
  }, [baseEndpoint, refreshStatus])

  useEffect(() => {
    void loadDevice()
  }, [loadDevice])

  async function startLive(channel: number) {
    const playerWindow = window.open('about:blank', 'prodexy-videotelemetry-live')
    if (playerWindow) playerWindow.opener = null

    setOperation(('start-' + channel) as Operation)
    setNotice(null)

    try {
      const response = await fetch(baseEndpoint + '/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel }),
      })
      const result = await readApiResponse<{ live: VideotelemetryStartResult }>(
        response,
        'Não foi possível iniciar a transmissão.',
      )

      setLive(result.live)

      if (playerWindow && !playerWindow.closed) {
        playerWindow.location.replace(result.live.url)
        playerWindow.focus()
        setNotice(null)
      } else {
        setNotice({
          tone: 'warning',
          text: 'Transmissão pronta. Use o botão Abrir vídeo para assistir.',
        })
      }
    } catch (error) {
      if (playerWindow && !playerWindow.closed) playerWindow.close()
      setNotice({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Não foi possível iniciar a transmissão.',
      })
    } finally {
      setOperation(null)
    }
  }

  async function stopLive() {
    setOperation('stop')
    setNotice(null)

    try {
      const response = await fetch(`${baseEndpoint}/live`, { method: 'DELETE' })
      await readApiResponse<{ stopped: boolean }>(
        response,
        'Não foi possível encerrar a transmissão.',
      )
      setLive({ running: false, channel: null, startedAt: null, url: null })
      setNotice(null)
    } catch (error) {
      setNotice({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Não foi possível encerrar a transmissão.',
      })
    } finally {
      setOperation(null)
    }
  }

  function openCurrentLive() {
    if (!live?.url) return

    const playerWindow = window.open(live.url, 'prodexy-videotelemetry-live')
    if (playerWindow) {
      playerWindow.opener = null
      setNotice(null)
    } else {
      setNotice({
        tone: 'warning',
        text: 'O navegador bloqueou a abertura do vídeo. Permita a nova aba e tente novamente.',
      })
    }
  }

  const busy = operation !== null
  const currentChannel = live?.running
    ? device?.channels.find((channel) => channel.number === live.channel) ?? null
    : null

  return (
    <Section
      title="Videotelemetria"
      description="Acesso ao vivo às câmeras vinculadas a este veículo."
      action={device?.active ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="size-9 p-0"
          title="Atualizar transmissão"
          aria-label="Atualizar transmissão"
          disabled={busy}
          onClick={() => void refreshStatus()}
        >
          <RefreshCw className={'size-4 ' + (operation === 'status' ? 'animate-spin' : '')} />
        </Button>
      ) : undefined}
    >
      {!deviceLoaded ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />
          Consultando dispositivo...
        </div>
      ) : !device ? (
        <div className="space-y-3 py-8 text-center">
          <Camera className="mx-auto size-7 text-muted-foreground" />
          <div>
            <p className="font-medium">Nenhuma câmera vinculada</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Este veículo ainda não possui videotelemetria disponível.
            </p>
          </div>
          {notice?.tone === 'error' ? (
            <div className="space-y-3">
              <p role="alert" className="text-sm text-destructive">{notice.text}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void loadDevice()}>
                Tentar novamente
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <div>
          <div className="flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-muted/30">
                <Camera className="size-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold">{device.model}</p>
                <p className="text-sm text-muted-foreground">
                  Terminal {device.terminalLabel} · {device.channels.length} câmera(s)
                </p>
              </div>
            </div>
            <StatusBadge
              type="raw"
              value={device.active ? 'ativo' : 'inativo'}
              label={device.active ? 'Dispositivo ativo' : 'Dispositivo inativo'}
            />
          </div>

          {device.active ? (
            <>
              <div
                className={
                  'my-4 flex flex-col gap-4 border-l-4 px-4 py-3 sm:flex-row sm:items-center sm:justify-between ' +
                  (live?.running
                    ? 'border-emerald-500 bg-emerald-50/70'
                    : 'border-border bg-muted/25')
                }
              >
                <div className="flex min-w-0 items-start gap-3">
                  <Radio
                    className={
                      'mt-0.5 size-5 shrink-0 ' +
                      (live?.running ? 'text-emerald-700' : 'text-muted-foreground')
                    }
                  />
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {operation === 'status'
                        ? 'Consultando transmissão...'
                        : live?.running
                          ? (currentChannel?.name ?? 'Câmera em transmissão')
                          : 'Nenhuma transmissão ativa'}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {live?.running && live.startedAt
                        ? 'Ao vivo desde ' + dateTime(live.startedAt)
                        : 'Selecione abaixo a câmera que deseja acompanhar.'}
                    </p>
                  </div>
                </div>

                {live?.running ? (
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {live.url ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        disabled={busy}
                        onClick={openCurrentLive}
                      >
                        <ExternalLink className="size-4" />
                        Abrir vídeo
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="gap-2"
                      disabled={busy}
                      onClick={() => void stopLive()}
                    >
                      {operation === 'stop'
                        ? <LoaderCircle className="size-4 animate-spin" />
                        : <Square className="size-4" />}
                      {operation === 'stop' ? 'Encerrando...' : 'Encerrar'}
                    </Button>
                  </div>
                ) : null}
              </div>

              {notice ? (
                <div
                  role={notice.tone === 'error' ? 'alert' : 'status'}
                  className={
                    'mb-4 flex items-start gap-2 border-l-2 px-3 py-2 text-sm ' +
                    (notice.tone === 'error'
                      ? 'border-destructive text-destructive'
                      : 'border-amber-500 text-amber-800')
                  }
                >
                  <CircleAlert className="mt-0.5 size-4 shrink-0" />
                  <span>{notice.text}</span>
                </div>
              ) : null}

              <div className="pt-1">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="font-semibold">Câmeras disponíveis</p>
                    <p className="text-sm text-muted-foreground">
                      Escolha a visão que deseja acompanhar em tempo real.
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Uma câmera por vez nesta etapa
                  </p>
                </div>

                {device.channels.length ? (
                  <div className="mt-3 grid border-y sm:grid-cols-2 sm:divide-x">
                    {device.channels.map((channel) => {
                      const startOperation = ('start-' + channel.number) as Operation
                      const isPreparing = operation === startOperation
                      const isCurrentChannel = live?.running && live.channel === channel.number

                      return (
                        <div
                          key={channel.number}
                          className="flex min-h-32 flex-col justify-between gap-4 px-4 py-4 first:pl-0 last:pr-0 max-sm:border-b max-sm:px-0 max-sm:last:border-b-0 sm:first:pr-4 sm:last:pl-4"
                        >
                          <div className="flex min-w-0 items-start gap-3">
                            <div
                              className={
                                'flex size-9 shrink-0 items-center justify-center rounded-md ' +
                                (isCurrentChannel
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-muted text-muted-foreground')
                              }
                            >
                              <Video className="size-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium">{channel.name}</p>
                                {isCurrentChannel ? (
                                  <StatusBadge type="raw" value="ativo" label="Ao vivo" />
                                ) : null}
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Canal {channel.number}{channel.type ? ' · ' + channel.type : ''}
                              </p>
                              {live?.running && !isCurrentChannel ? (
                                <p className="mt-2 text-xs text-muted-foreground">
                                  Ao iniciar, substitui a câmera atual.
                                </p>
                              ) : null}
                            </div>
                          </div>

                          {isCurrentChannel && live?.url ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="w-full gap-2"
                              disabled={busy}
                              onClick={openCurrentLive}
                            >
                              <ExternalLink className="size-4" />
                              Abrir vídeo
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              className="w-full gap-2"
                              disabled={busy}
                              aria-label={'Assistir ao vivo: ' + channel.name}
                              onClick={() => void startLive(channel.number)}
                            >
                              {isPreparing
                                ? <LoaderCircle className="size-4 animate-spin" />
                                : <Video className="size-4" />}
                              {isPreparing ? 'Conectando...' : 'Assistir ao vivo'}
                            </Button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="mt-3 border-y py-8 text-center text-sm text-muted-foreground">
                    Nenhum canal válido foi cadastrado neste dispositivo.
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-start gap-3 border-y py-5 text-sm text-muted-foreground">
              <CircleAlert className="mt-0.5 size-4 shrink-0" />
              <p>Este dispositivo está inativo. As transmissões não estão disponíveis.</p>
            </div>
          )}
        </div>
      )}
    </Section>
  )
}
