import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeOptionalText } from '@/lib/driver-utils'
import { apiErrorResponse } from '@/lib/error-response'
import { parseKmValue, parseOptionalKmValue } from '@/lib/km'
import {
  legacyVehicleDocumentFields,
  type VehicleDocumentCode,
} from '@/lib/vehicle-documents'
import type { VehicleStatus } from '@/types/fleet'

const vehicleStatuses: VehicleStatus[] = [
  'ativo',
  'em_manutencao',
  'inativo',
  'reservado',
  'indisponivel',
]

export type VehiclePayload = {
  type: string
  brand: string
  model: string
  fleetCode: string
  plate: string
  year: number | null
  status: VehicleStatus
  currentKm: number
  capacity: string | null
  notes: string | null
  routeId: string | null
  newRoute: {
    name: string
    origin: string
    destination: string
    estimatedKm: number | null
    notes: string | null
  } | null
  documentDates: Record<VehicleDocumentCode, string>
  driverIds: string[]
  principalDriverId: string | null
}

function parseVehicleDocumentDates(body: Record<string, unknown>): Record<VehicleDocumentCode, string> {
  const sourceDocuments = Array.isArray(body.documents)
    ? body.documents
    : legacyVehicleDocumentFields.flatMap(({ code, formField }) => {
        const dueDate = String(body[formField] ?? '').trim()
        return dueDate ? [{ code, dueDate }] : []
      })

  const documentDates = new Map<string, string>()

  for (const item of sourceDocuments) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const code = String(row.code ?? '').trim()
    const dueDate = String(row.dueDate ?? '').trim()

    if (!code) throw new Error('Documento do veículo inválido.')
    if (documentDates.has(code)) throw new Error('O mesmo documento não pode ser informado mais de uma vez.')
    if (!dueDate) throw new Error('Informe o vencimento dos documentos selecionados.')

    documentDates.set(code, dueDate)
  }

  return Object.fromEntries(documentDates) as Record<VehicleDocumentCode, string>
}

export function parseVehiclePayload(body: Record<string, unknown>): VehiclePayload {
  const yearText = String(body.year ?? '').trim()
  const routeIdText = String(body.routeId ?? '').trim()
  const driverIds = Array.isArray(body.driverIds)
    ? [...new Set(body.driverIds.map((id) => String(id).trim()).filter(Boolean))]
    : []
  const principalDriverId = normalizeOptionalText(body.principalDriverId)

  const payload: VehiclePayload = {
    type: String(body.type ?? '').trim(),
    brand: String(body.brand ?? '').trim(),
    model: String(body.model ?? '').trim(),
    fleetCode: String(body.fleetCode ?? '').trim().toUpperCase(),
    plate: String(body.plate ?? '').trim().toUpperCase(),
    year: yearText ? Number(yearText) : null,
    status: String(body.status ?? 'ativo') as VehicleStatus,
    currentKm: parseKmValue(body.currentKm ?? '0.0', 'A quilometragem atual'),
    capacity: normalizeOptionalText(body.capacity),
    notes: normalizeOptionalText(body.notes),
    routeId: routeIdText && routeIdText !== 'new' ? routeIdText : null,
    newRoute: routeIdText === 'new'
      ? {
          name: String(body.newRouteName ?? '').trim(),
          origin: String(body.newRouteOrigin ?? '').trim(),
          destination: String(body.newRouteDestination ?? '').trim(),
          estimatedKm: parseOptionalKmValue(body.newRouteEstimatedKm, 'O KM estimado da rota'),
          notes: normalizeOptionalText(body.newRouteNotes),
        }
      : null,
    documentDates: parseVehicleDocumentDates(body),
    driverIds,
    principalDriverId,
  }

  validateVehiclePayload(payload)
  return payload
}

function validateVehiclePayload(payload: VehiclePayload) {
  if (!payload.type || !payload.brand || !payload.model || !payload.fleetCode || !payload.plate) {
    throw new Error('Tipo, marca, modelo, frota e placa são obrigatórios.')
  }

  if (!vehicleStatuses.includes(payload.status)) {
    throw new Error('Status operacional inválido.')
  }

  if (!Number.isFinite(payload.currentKm) || payload.currentKm < 0) {
    throw new Error('A quilometragem atual deve ser um número maior ou igual a zero.')
  }

  if (payload.year != null && (!Number.isInteger(payload.year) || payload.year < 1950 || payload.year > 2100)) {
    throw new Error('O ano do veículo deve estar entre 1950 e 2100.')
  }

  if (
    payload.newRoute
    && (!payload.newRoute.name || !payload.newRoute.origin || !payload.newRoute.destination)
  ) {
    throw new Error('Nome, origem e destino são obrigatórios para cadastrar uma nova rota.')
  }

  if (
    payload.newRoute?.estimatedKm != null
    && (!Number.isFinite(payload.newRoute.estimatedKm) || payload.newRoute.estimatedKm < 0)
  ) {
    throw new Error('O KM estimado da rota deve ser maior ou igual a zero.')
  }

  if (Object.values(payload.documentDates).some((date) => !date)) {
    throw new Error('Informe o vencimento dos documentos selecionados.')
  }

  if (payload.principalDriverId && !payload.driverIds.includes(payload.principalDriverId)) {
    throw new Error('O motorista principal deve estar entre os motoristas vinculados.')
  }
}

export async function createVehicleRoute(
  service: SupabaseClient,
  payload: VehiclePayload,
  adminId: string,
) {
  if (!payload.newRoute) return { routeId: payload.routeId, createdRouteId: null }

  const { data, error } = await service
    .from('rotas')
    .insert({
      nome: payload.newRoute.name,
      origem: payload.newRoute.origin,
      destino: payload.newRoute.destination,
      km_estimado: payload.newRoute.estimatedKm,
      observacoes: payload.newRoute.notes,
      ativo: true,
      criado_por: adminId,
      atualizado_por: adminId,
    })
    .select('id')
    .single<{ id: string }>()

  if (error || !data) throw error ?? new Error('Não foi possível cadastrar a rota fixa.')
  return { routeId: data.id, createdRouteId: data.id }
}

export async function syncVehicleDrivers(
  service: SupabaseClient,
  vehicleId: string,
  driverIds: string[],
  principalDriverId: string | null,
  adminId: string,
) {
  const uniqueDriverIds = [...new Set(driverIds)]
  if (principalDriverId && !uniqueDriverIds.includes(principalDriverId)) {
    throw new Error('O motorista principal deve estar entre os motoristas vinculados.')
  }

  if (uniqueDriverIds.length) {
    const { data: validDrivers, error: driversError } = await service
      .from('motoristas')
      .select('id')
      .in('id', uniqueDriverIds)
      .is('excluido_em', null)

    if (driversError) throw driversError
    if ((validDrivers?.length ?? 0) !== uniqueDriverIds.length) {
      throw new Error('Um ou mais motoristas selecionados não estão disponíveis.')
    }
  }

  const { data: currentAssignments, error: assignmentsError } = await service
    .from('veiculo_motoristas')
    .select('id,motorista_id,principal')
    .eq('veiculo_id', vehicleId)
    .eq('ativo', true)
    .is('fim_em', null)

  if (assignmentsError) throw assignmentsError

  const currentByDriver = new Map(
    (currentAssignments ?? []).map((assignment) => [assignment.motorista_id, assignment]),
  )
  const removedIds = (currentAssignments ?? [])
    .filter((assignment) => !uniqueDriverIds.includes(assignment.motorista_id))
    .map((assignment) => assignment.id)

  if (removedIds.length) {
    const { error } = await service
      .from('veiculo_motoristas')
      .update({
        ativo: false,
        fim_em: new Date().toISOString(),
        principal: false,
        atualizado_por: adminId,
      })
      .in('id', removedIds)

    if (error) throw error
  }

  const retainedIds = (currentAssignments ?? [])
    .filter((assignment) => uniqueDriverIds.includes(assignment.motorista_id))
    .map((assignment) => assignment.id)

  if (retainedIds.length) {
    const { error } = await service
      .from('veiculo_motoristas')
      .update({ principal: false, atualizado_por: adminId })
      .in('id', retainedIds)

    if (error) throw error
  }

  const newDriverIds = uniqueDriverIds.filter((driverId) => !currentByDriver.has(driverId))
  if (newDriverIds.length) {
    const { error } = await service.from('veiculo_motoristas').insert(
      newDriverIds.map((driverId) => ({
        veiculo_id: vehicleId,
        motorista_id: driverId,
        ativo: true,
        principal: false,
        tipo_vinculo: 'regular',
        criado_por: adminId,
        atualizado_por: adminId,
      })),
    )

    if (error) throw error
  }

  if (principalDriverId) {
    const { error: demoteError } = await service
      .from('veiculo_motoristas')
      .update({ principal: false, atualizado_por: adminId })
      .eq('motorista_id', principalDriverId)
      .eq('ativo', true)
      .eq('principal', true)
      .is('fim_em', null)
      .neq('veiculo_id', vehicleId)

    if (demoteError) throw demoteError

    const { error: promoteError } = await service
      .from('veiculo_motoristas')
      .update({ principal: true, atualizado_por: adminId })
      .eq('veiculo_id', vehicleId)
      .eq('motorista_id', principalDriverId)
      .eq('ativo', true)
      .is('fim_em', null)

    if (promoteError) throw promoteError
  }
}

export async function createVehicleDocuments(
  service: SupabaseClient,
  vehicleId: string,
  dates: VehiclePayload['documentDates'],
  adminId: string,
) {
  const selectedCodes = Object.keys(dates).filter((code) => dates[code])
  if (!selectedCodes.length) return

  const { data: types, error: typesError } = await service
    .from('tipos_documento_veiculo')
    .select('id,codigo')
    .in('codigo', selectedCodes)
    .eq('ativo', true)

  if (typesError) throw typesError
  if ((types?.length ?? 0) !== selectedCodes.length) {
    throw new Error('Um ou mais documentos selecionados não estão configurados no banco.')
  }

  const typeByCode = new Map((types ?? []).map((type) => [type.codigo, type.id]))
  const { error } = await service.from('veiculo_documentos').insert(
    selectedCodes.map((code) => ({
      veiculo_id: vehicleId,
      tipo_documento_id: typeByCode.get(code),
      vencimento_em: dates[code],
      status_operacional: 'ativo',
      criado_por: adminId,
      atualizado_por: adminId,
    })),
  )

  if (error) throw error
}

export async function renewChangedVehicleDocuments(
  service: SupabaseClient,
  vehicleId: string,
  dates: VehiclePayload['documentDates'],
  adminId: string,
) {
  const { data: currentDocuments, error } = await service
    .from('vw_documentos_veiculo_status')
    .select('id,tipo_codigo,tipo_documento_id,vencimento_em')
    .eq('veiculo_id', vehicleId)

  if (error) throw error

  const selectedCodes = Object.keys(dates).filter((code) => dates[code])
  const selectedCodeSet = new Set(selectedCodes)
  const currentActiveDocuments = currentDocuments ?? []
  const currentByCode = new Map(currentActiveDocuments.map((document) => [document.tipo_codigo, document]))
  const changed: Array<{ oldId: string; newId: string }> = []
  const inserted: string[] = []
  const cancelled: string[] = []

  const { data: selectedTypes, error: typeError } = selectedCodes.length
    ? await service
        .from('tipos_documento_veiculo')
        .select('id,codigo')
        .in('codigo', selectedCodes)
        .eq('ativo', true)
    : { data: [], error: null }

  if (typeError) throw typeError
  if ((selectedTypes?.length ?? 0) !== selectedCodes.length) {
    throw new Error('Um ou mais documentos selecionados não estão configurados no banco.')
  }

  const typeByCode = new Map((selectedTypes ?? []).map((type) => [type.codigo, type.id]))

  try {
    for (const current of currentActiveDocuments) {
      if (selectedCodeSet.has(current.tipo_codigo)) continue

      const { error: cancelError } = await service
        .from('veiculo_documentos')
        .update({ status_operacional: 'cancelado', atualizado_por: adminId })
        .eq('id', current.id)

      if (cancelError) throw cancelError
      cancelled.push(current.id)
    }

    for (const code of selectedCodes) {
      const current = currentByCode.get(code)
      const dueDate = dates[code]

      if (!current) {
        const { data: created, error: createError } = await service
          .from('veiculo_documentos')
          .insert({
            veiculo_id: vehicleId,
            tipo_documento_id: typeByCode.get(code),
            vencimento_em: dueDate,
            status_operacional: 'ativo',
            criado_por: adminId,
            atualizado_por: adminId,
          })
          .select('id')
          .single<{ id: string }>()

        if (createError || !created) throw createError ?? new Error('Não foi possível criar o documento.')
        inserted.push(created.id)
        continue
      }

      if (current.vencimento_em === dueDate) continue

      const { error: replaceError } = await service
        .from('veiculo_documentos')
        .update({ status_operacional: 'substituido', atualizado_por: adminId })
        .eq('id', current.id)

      if (replaceError) throw replaceError

      const { data: created, error: createError } = await service
        .from('veiculo_documentos')
        .insert({
          veiculo_id: vehicleId,
          tipo_documento_id: current.tipo_documento_id,
          vencimento_em: dueDate,
          status_operacional: 'ativo',
          criado_por: adminId,
          atualizado_por: adminId,
        })
        .select('id')
        .single<{ id: string }>()

      if (createError || !created) {
        await service
          .from('veiculo_documentos')
          .update({ status_operacional: 'ativo', atualizado_por: adminId })
          .eq('id', current.id)
        throw createError ?? new Error('Não foi possível renovar o documento.')
      }

      const { error: linkError } = await service
        .from('veiculo_documentos')
        .update({ substituido_por_id: created.id, atualizado_por: adminId })
        .eq('id', current.id)

      if (linkError) {
        await service.from('veiculo_documentos').delete().eq('id', created.id)
        await service
          .from('veiculo_documentos')
          .update({ status_operacional: 'ativo', substituido_por_id: null, atualizado_por: adminId })
          .eq('id', current.id)
        throw linkError
      }

      changed.push({ oldId: current.id, newId: created.id })
    }
  } catch (renewError) {
    for (const document of [...changed].reverse()) {
      await service.from('veiculo_documentos').delete().eq('id', document.newId)
      await service
        .from('veiculo_documentos')
        .update({ status_operacional: 'ativo', substituido_por_id: null, atualizado_por: adminId })
        .eq('id', document.oldId)
    }
    if (inserted.length) await service.from('veiculo_documentos').delete().in('id', inserted)
    if (cancelled.length) {
      await service
        .from('veiculo_documentos')
        .update({ status_operacional: 'ativo', atualizado_por: adminId })
        .in('id', cancelled)
    }
    throw renewError
  }
}

export function vehicleErrorResponse(error: unknown, fallback: string, status = 400) {
  return apiErrorResponse(error, fallback, status, [
    {
      includes: ['veiculos_placa_normalizada_uniq'],
      message: 'Já existe um veículo cadastrado com essa placa.',
      status: 409,
    },
  ])
}
