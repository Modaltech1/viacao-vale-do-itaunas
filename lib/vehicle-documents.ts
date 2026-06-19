export const vehicleDocumentDefinitions = [
  {
    code: 'documentacao',
    label: 'Documentação / CRLV',
    formField: 'documentationDueDate',
  },
  {
    code: 'tacografo',
    label: 'Tacógrafo',
    formField: 'tachographDueDate',
  },
  {
    code: 'ceturb',
    label: 'CETURB',
    formField: 'ceturbDueDate',
  },
  {
    code: 'aet',
    label: 'AET',
    formField: 'aetDueDate',
  },
] as const

export type VehicleDocumentCode = (typeof vehicleDocumentDefinitions)[number]['code']

export const vehicleDocumentCodes = vehicleDocumentDefinitions.map(({ code }) => code)

const vehicleDocumentLabels = Object.fromEntries(
  vehicleDocumentDefinitions.map(({ code, label }) => [code, label]),
) as Record<VehicleDocumentCode, string>

export function vehicleDocumentLabel(code: string) {
  return vehicleDocumentLabels[code as VehicleDocumentCode] ?? code.replaceAll('_', ' ')
}
