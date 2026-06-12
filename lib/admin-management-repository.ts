import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AdminListItem,
  AdminManagementData,
  AdminOwnedResource,
} from '@/types/admin-management'
import type { AdminLevel } from '@/lib/admin-scope'

type ProfileRow = {
  id: string
  nome: string
  email: string | null
  telefone: string | null
  nivel_admin: AdminLevel | null
  ativo: boolean
}

type VehicleRow = {
  id: string
  placa: string
  marca: string
  modelo: string
  admin_responsavel_id: string | null
}

type DriverRow = {
  id: string
  perfil_id: string | null
  numero_habilitacao: string | null
  admin_responsavel_id: string | null
}

export async function getAdminManagementData(
  service: SupabaseClient,
  currentAdminId: string,
): Promise<AdminManagementData> {
  const [
    { data: adminRows, error: adminsError },
    { data: vehicleRows, error: vehiclesError },
    { data: driverRows, error: driversError },
  ] = await Promise.all([
    service
      .from('perfis')
      .select('id,nome,email,telefone,nivel_admin,ativo')
      .eq('papel', 'admin')
      .order('nome'),
    service
      .from('veiculos')
      .select('id,placa,marca,modelo,admin_responsavel_id')
      .is('excluido_em', null)
      .order('placa'),
    service
      .from('motoristas')
      .select('id,perfil_id,numero_habilitacao,admin_responsavel_id')
      .is('excluido_em', null)
      .order('criado_em'),
  ])

  if (adminsError) throw adminsError
  if (vehiclesError) throw vehiclesError
  if (driversError) throw driversError

  const admins = (adminRows ?? []) as ProfileRow[]
  const vehicles = (vehicleRows ?? []) as VehicleRow[]
  const drivers = (driverRows ?? []) as DriverRow[]
  const driverProfileIds = drivers
    .map((driver) => driver.perfil_id)
    .filter((id): id is string => Boolean(id))

  const { data: driverProfiles, error: driverProfilesError } = driverProfileIds.length
    ? await service
        .from('perfis')
        .select('id,nome')
        .in('id', driverProfileIds)
    : { data: [], error: null }

  if (driverProfilesError) throw driverProfilesError

  const adminNames = new Map(admins.map((admin) => [admin.id, admin.nome]))
  const driverNames = new Map(
    (driverProfiles ?? []).map((profile) => [String(profile.id), String(profile.nome)]),
  )

  const adminItems: AdminListItem[] = admins.map((admin) => ({
    id: admin.id,
    name: admin.nome,
    email: admin.email ?? '',
    phone: admin.telefone ?? '',
    level: admin.nivel_admin === 'restrito' ? 'restrito' : 'global',
    active: admin.ativo,
    vehiclesCount: vehicles.filter((vehicle) => vehicle.admin_responsavel_id === admin.id).length,
    driversCount: drivers.filter((driver) => driver.admin_responsavel_id === admin.id).length,
    current: admin.id === currentAdminId,
  }))

  const vehicleItems: AdminOwnedResource[] = vehicles.map((vehicle) => ({
    id: vehicle.id,
    label: vehicle.placa,
    detail: `${vehicle.marca} ${vehicle.modelo}`.trim(),
    ownerId: vehicle.admin_responsavel_id,
    ownerName: vehicle.admin_responsavel_id
      ? adminNames.get(vehicle.admin_responsavel_id) ?? null
      : null,
  }))

  const driverItems: AdminOwnedResource[] = drivers.map((driver) => ({
    id: driver.id,
    label: driver.perfil_id
      ? driverNames.get(driver.perfil_id) ?? 'Motorista sem nome'
      : 'Motorista sem acesso',
    detail: driver.numero_habilitacao
      ? `CNH ${driver.numero_habilitacao}`
      : 'CNH não informada',
    ownerId: driver.admin_responsavel_id,
    ownerName: driver.admin_responsavel_id
      ? adminNames.get(driver.admin_responsavel_id) ?? null
      : null,
  }))

  return {
    admins: adminItems,
    vehicles: vehicleItems,
    drivers: driverItems,
  }
}
