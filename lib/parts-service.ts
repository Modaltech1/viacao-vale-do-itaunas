import 'server-only'

import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeOptionalText } from '@/lib/driver-utils'
import {
  partCategories,
  partUnits,
  type PartCategory,
  type PartUnit,
} from '@/types/part'

export type PartPayload = {
  code: string
  name: string
  category: PartCategory
  unit: PartUnit
  stockQuantity: number
  minimumStock: number
  unitValue: number
  description: string | null
  active: boolean
}

function numeric(value: unknown) {
  return Number(String(value ?? '').replace(',', '.').trim())
}

export function parsePartPayload(body: Record<string, unknown>): PartPayload {
  const payload: PartPayload = {
    code: String(body.code ?? '').trim().toUpperCase(),
    name: String(body.name ?? '').trim(),
    category: String(body.category ?? '') as PartCategory,
    unit: String(body.unit ?? '') as PartUnit,
    stockQuantity: numeric(body.stockQuantity),
    minimumStock: numeric(body.minimumStock),
    unitValue: numeric(body.unitValue),
    description: normalizeOptionalText(body.description),
    active: body.active !== false,
  }

  if (!payload.code || !payload.name) {
    throw new Error('Código e nome da peça são obrigatórios.')
  }
  if (!partCategories.includes(payload.category)) {
    throw new Error('Categoria da peça inválida.')
  }
  if (!partUnits.includes(payload.unit)) {
    throw new Error('Unidade de medida inválida.')
  }
  if (!Number.isFinite(payload.stockQuantity) || payload.stockQuantity < 0) {
    throw new Error('A quantidade em estoque deve ser maior ou igual a zero.')
  }
  if (!Number.isFinite(payload.minimumStock) || payload.minimumStock < 0) {
    throw new Error('O estoque mínimo deve ser maior ou igual a zero.')
  }
  if (!Number.isFinite(payload.unitValue) || payload.unitValue < 0) {
    throw new Error('O valor unitário deve ser maior ou igual a zero.')
  }
  if (
    payload.unit !== 'litro'
    && payload.unit !== 'metro'
    && (!Number.isInteger(payload.stockQuantity) || !Number.isInteger(payload.minimumStock))
  ) {
    throw new Error('Estoque de unidade, kit e par deve ser informado em números inteiros.')
  }

  return payload
}

export async function savePart(
  client: SupabaseClient,
  partId: string | null,
  payload: PartPayload,
) {
  const { data, error } = await client.rpc('fn_salvar_peca', {
    p_peca_id: partId,
    p_codigo: payload.code,
    p_nome: payload.name,
    p_categoria: payload.category,
    p_unidade_medida: payload.unit,
    p_quantidade_estoque: payload.stockQuantity,
    p_estoque_minimo: payload.minimumStock,
    p_valor_unitario: payload.unitValue,
    p_descricao: payload.description,
    p_ativo: payload.active,
  })

  if (error) throw error
  return String(data)
}

export function partErrorResponse(error: unknown, fallback: string, status = 400) {
  const message = error instanceof Error ? error.message : fallback
  const normalized = message.toLowerCase()

  if (
    normalized.includes('pecas_codigo_normalizado_uniq')
    || normalized.includes('duplicate')
  ) {
    return NextResponse.json(
      { error: 'Já existe uma peça cadastrada com esse código.' },
      { status: 409 },
    )
  }

  return NextResponse.json({ error: message || fallback }, { status })
}
