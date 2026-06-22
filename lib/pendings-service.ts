import 'server-only'

import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeOptionalText } from '@/lib/driver-utils'
import { parseOptionalKmValue } from '@/lib/km'
import type { Severity } from '@/types/fleet'
import type {
  PendingInteractionAction,
  PendingOrigin,
} from '@/types/pending'

const severities: Severity[] = ['baixa', 'atencao', 'critica']
const interactionActions: PendingInteractionAction[] = [
  'visualizada',
  'resolvida_manual',
  'ignorada',
]

export type PendingPayload = {
  title: string
  description: string | null
  severity: Severity
  type: string
  vehicleId: string | null
  driverId: string | null
  mechanicId: string | null
  serviceId: string | null
  maintenanceId: string | null
  dueDate: string | null
  dueKm: number | null
}

export function parsePendingPayload(
  body: Record<string, unknown>,
  forcedMechanicId?: string,
): PendingPayload {
  const payload: PendingPayload = {
    title: String(body.title ?? '').trim(),
    description: normalizeOptionalText(body.description),
    severity: String(body.severity ?? 'atencao') as Severity,
    type: String(body.type ?? 'manual').trim() || 'manual',
    vehicleId: normalizeOptionalText(body.vehicleId),
    driverId: normalizeOptionalText(body.driverId),
    mechanicId: forcedMechanicId ?? normalizeOptionalText(body.mechanicId),
    serviceId: normalizeOptionalText(body.serviceId),
    maintenanceId: normalizeOptionalText(body.maintenanceId),
    dueDate: normalizeOptionalText(body.dueDate),
    dueKm: parseOptionalKmValue(body.dueKm, 'O vencimento em KM'),
  }

  if (!payload.title) throw new Error('O título da pendência é obrigatório.')
  if (!severities.includes(payload.severity)) throw new Error('Severidade inválida.')
  if (payload.dueKm != null && (!Number.isFinite(payload.dueKm) || payload.dueKm < 0)) {
    throw new Error('O vencimento em KM deve ser maior ou igual a zero.')
  }
  if (
    !payload.vehicleId
    && !payload.driverId
    && !payload.mechanicId
    && !payload.serviceId
    && !payload.maintenanceId
  ) {
    throw new Error('Vincule a pendência a pelo menos um registro operacional.')
  }

  return payload
}

export async function createManualPending(
  client: SupabaseClient,
  payload: PendingPayload,
  userId: string,
  adminOwnerId?: string | null,
) {
  const { data, error } = await client
    .from('pendencias_manuais')
    .insert({
      tipo: payload.type,
      severidade: payload.severity,
      titulo: payload.title,
      descricao: payload.description,
      veiculo_id: payload.vehicleId,
      motorista_id: payload.driverId,
      mecanico_id: payload.mechanicId,
      servico_id: payload.serviceId,
      manutencao_id: payload.maintenanceId,
      vencimento_em: payload.dueDate,
      vencimento_km: payload.dueKm,
      status: 'aberta',
      admin_responsavel_id: adminOwnerId ?? null,
      criado_por: userId,
      atualizado_por: userId,
    })
    .select('id')
    .single<{ id: string }>()

  if (error || !data) throw error ?? new Error('Não foi possível criar a pendência.')
  return data.id
}

async function addInteraction(
  client: SupabaseClient,
  key: string,
  origin: PendingOrigin,
  action: PendingInteractionAction,
  comment: string | null,
  userId: string,
) {
  if (!interactionActions.includes(action)) throw new Error('Ação de pendência inválida.')

  const { error } = await client.from('pendencia_interacoes').insert({
    pendencia_chave: key,
    pendencia_origem: origin,
    acao: action,
    observacao: comment,
    criado_por: userId,
  })
  if (error) throw error
}

export async function interactWithPending(
  client: SupabaseClient,
  input: {
    key: string
    origin: PendingOrigin
    action: PendingInteractionAction | 'cancelada'
    comment: string
    userId: string
  },
) {
  const comment = normalizeOptionalText(input.comment)

  if (input.action === 'resolvida_manual' || input.action === 'cancelada') {
    if (input.origin !== 'manual') {
      throw new Error('Pendências calculadas são encerradas somente pela correção da causa.')
    }
    if (!comment) {
      throw new Error('Informe uma observação para encerrar a pendência.')
    }

    const manualId = input.key.replace('manual:', '')
    const status = input.action === 'resolvida_manual' ? 'resolvida' : 'cancelada'
    const { data: current, error: findError } = await client
      .from('pendencias_manuais')
      .select('status,resolvida_em,resolvida_por,observacoes_resolucao')
      .eq('id', manualId)
      .single()
    if (findError || !current) throw new Error('Pendência manual não encontrada.')
    if (current.status !== 'aberta') throw new Error('Esta pendência já foi encerrada.')

    const { error: updateError } = await client
      .from('pendencias_manuais')
      .update({
        status,
        resolvida_em: status === 'resolvida' ? new Date().toISOString() : null,
        resolvida_por: status === 'resolvida' ? input.userId : null,
        observacoes_resolucao: comment,
        atualizado_por: input.userId,
      })
      .eq('id', manualId)
    if (updateError) throw updateError

    try {
      await addInteraction(
        client,
        input.key,
        input.origin,
        input.action === 'cancelada' ? 'ignorada' : 'resolvida_manual',
        comment,
        input.userId,
      )
    } catch (error) {
      await client
        .from('pendencias_manuais')
        .update({
          status: current.status,
          resolvida_em: current.resolvida_em,
          resolvida_por: current.resolvida_por,
          observacoes_resolucao: current.observacoes_resolucao,
          atualizado_por: input.userId,
        })
        .eq('id', manualId)
      throw error
    }
    return
  }

  throw new Error('Ação de pendência inválida.')
}

export function pendingErrorResponse(error: unknown, fallback: string, status = 400) {
  const message = error instanceof Error ? error.message : fallback
  if (message.toLowerCase().includes('invalid api key')) {
    return NextResponse.json(
      { error: 'A configuração server-side do Supabase está inválida.' },
      { status: 500 },
    )
  }
  return NextResponse.json({ error: message || fallback }, { status })
}
