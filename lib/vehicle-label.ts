type VehicleIdentity = {
  codigo_frota?: string | null
  fleetCode?: string | null
  placa?: string | null
  plate?: string | null
  marca?: string | null
  brand?: string | null
  modelo?: string | null
  model?: string | null
}

export function vehicleFleetCode(vehicle?: VehicleIdentity | null) {
  const code = vehicle?.fleetCode ?? vehicle?.codigo_frota ?? ''
  return String(code).trim() || 'Sem frota'
}

export function vehiclePlate(vehicle?: VehicleIdentity | null) {
  const plate = vehicle?.plate ?? vehicle?.placa ?? ''
  return String(plate).trim()
}

export function vehicleModelName(vehicle?: VehicleIdentity | null) {
  const brand = vehicle?.brand ?? vehicle?.marca ?? ''
  const model = vehicle?.model ?? vehicle?.modelo ?? ''
  return `${brand} ${model}`.trim()
}

export function vehicleLabel(vehicle?: VehicleIdentity | null) {
  const name = vehicleModelName(vehicle)
  return name ? `${vehicleFleetCode(vehicle)} · ${name}` : vehicleFleetCode(vehicle)
}
