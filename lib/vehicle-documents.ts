export const vehicleDocumentDefinitions = [
  {
    code: 'documentacao',
    label: 'Documentação / CRLV',
  },
  {
    code: 'tacografo',
    label: 'Tacógrafo',
  },
  {
    code: 'ceturb',
    label: 'CETURB',
  },
  {
    code: 'aet',
    label: 'AET',
  },
] as const

export type VehicleDocumentCode = string

export const vehicleDocumentCodes = vehicleDocumentDefinitions.map(({ code }) => code)

const vehicleDocumentLabels = Object.fromEntries(
  vehicleDocumentDefinitions.map(({ code, label }) => [code, label]),
) as Record<string, string>

export const legacyVehicleDocumentFields = [
  { code: 'documentacao', formField: 'documentationDueDate' },
  { code: 'tacografo', formField: 'tachographDueDate' },
  { code: 'ceturb', formField: 'ceturbDueDate' },
  { code: 'aet', formField: 'aetDueDate' },
] as const

export function vehicleDocumentLabel(code: string) {
  return vehicleDocumentLabels[code] ?? code.replaceAll('_', ' ')
}
