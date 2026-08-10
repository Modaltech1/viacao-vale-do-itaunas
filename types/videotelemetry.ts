export type VideotelemetryChannel = {
  number: number
  name: string
  type: string | null
}

export type VideotelemetryDevice = {
  id: string
  vehicleId: string
  terminalId: string
  model: string
  channels: VideotelemetryChannel[]
  active: boolean
  deletedAt: string | null
}

export type VideotelemetryDeviceView = {
  id: string
  model: string
  terminalLabel: string
  channels: VideotelemetryChannel[]
  active: boolean
}

export type VideotelemetryLiveStatus = {
  running: boolean
  channel: number | null
  startedAt: string | null
  url: string | null
}

export type VideotelemetryStartResult = {
  running: true
  channel: number
  startedAt: string
  url: string
  alreadyRunning: boolean
}

export type VideotelemetryStopResult = {
  stopped: boolean
}
