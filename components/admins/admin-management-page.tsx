'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Button,
  Card,
  CardContent,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@prodexy/ui'
import {
  Bus,
  Pencil,
  Plus,
  ShieldCheck,
  UserRoundCog,
  Users,
} from 'lucide-react'
import { AdminDialog } from '@/components/admins/admin-dialog'
import { PageHeader } from '@/components/layout/page-header'
import { FilterInput } from '@/components/shared/filters'
import { MetricCard } from '@/components/shared/metric-card'
import { StatusBadge } from '@/components/shared/status-badge'
import {
  TablePagination,
  useTablePagination,
} from '@/components/shared/table-pagination'
import type {
  AdminListItem,
  AdminManagementData,
  AdminOwnedResource,
  AdminResourceType,
} from '@/types/admin-management'

const emptyData: AdminManagementData = {
  admins: [],
  vehicles: [],
  drivers: [],
}

function ResourceTable({
  admins,
  items,
  resourceType,
  search,
  savingId,
  onAssign,
}: {
  admins: AdminListItem[]
  items: AdminOwnedResource[]
  resourceType: AdminResourceType
  search: string
  savingId: string | null
  onAssign: (
    resourceType: AdminResourceType,
    resourceId: string,
    adminId: string | null,
  ) => void
}) {
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')
    if (!term) return items
    return items.filter((item) => (
      item.label.toLocaleLowerCase('pt-BR').includes(term)
      || item.detail.toLocaleLowerCase('pt-BR').includes(term)
      || item.ownerName?.toLocaleLowerCase('pt-BR').includes(term)
    ))
  }, [items, search])
  const pagination = useTablePagination(filtered, search)

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              {resourceType === 'vehicle' ? 'Veículo' : 'Motorista'}
            </TableHead>
            <TableHead>Responsável</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pagination.pageItems.length ? pagination.pageItems.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <p className="font-semibold">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.detail}</p>
              </TableCell>
              <TableCell className="w-[280px]">
                <Select
                  value={item.ownerId ?? 'unassigned'}
                  disabled={savingId === item.id}
                  onValueChange={(value) => {
                    onAssign(
                      resourceType,
                      item.id,
                      value === 'unassigned' ? null : value,
                    )
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned" disabled={Boolean(item.ownerId)}>
                      Sem responsável
                    </SelectItem>
                    {admins.filter((admin) => admin.active).map((admin) => (
                      <SelectItem key={admin.id} value={admin.id}>
                        {admin.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
            </TableRow>
          )) : (
            <TableRow>
              <TableCell colSpan={2} className="h-24 text-center text-muted-foreground">
                Nenhum registro encontrado.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <TablePagination {...pagination} />
    </>
  )
}

export function AdminManagementPage() {
  const [data, setData] = useState<AdminManagementData>(emptyData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [adminSearch, setAdminSearch] = useState('')
  const [vehicleSearch, setVehicleSearch] = useState('')
  const [driverSearch, setDriverSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingAdmin, setEditingAdmin] = useState<AdminListItem | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/admin/administradores', {
        cache: 'no-store',
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Não foi possível carregar a gestão administrativa.')
      }
      setData(result)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Não foi possível carregar a gestão administrativa.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const filteredAdmins = useMemo(() => {
    const term = adminSearch.trim().toLocaleLowerCase('pt-BR')
    if (!term) return data.admins
    return data.admins.filter((admin) => (
      admin.name.toLocaleLowerCase('pt-BR').includes(term)
      || admin.email.toLocaleLowerCase('pt-BR').includes(term)
    ))
  }, [adminSearch, data.admins])
  const adminPagination = useTablePagination(filteredAdmins, adminSearch)

  async function assignResource(
    resourceType: AdminResourceType,
    resourceId: string,
    adminId: string | null,
  ) {
    setSavingId(resourceId)
    setError('')
    try {
      const response = await fetch('/api/admin/administradores/atribuicoes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceType, resourceId, adminId }),
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Não foi possível transferir a responsabilidade.')
      }
      await loadData()
    } catch (assignmentError) {
      setError(
        assignmentError instanceof Error
          ? assignmentError.message
          : 'Não foi possível transferir a responsabilidade.',
      )
    } finally {
      setSavingId(null)
    }
  }

  function openNewAdmin() {
    setEditingAdmin(null)
    setDialogOpen(true)
  }

  function openEditAdmin(admin: AdminListItem) {
    setEditingAdmin(admin)
    setDialogOpen(true)
  }

  const assignedVehicles = data.vehicles.filter((item) => item.ownerId).length
  const assignedDrivers = data.drivers.filter((item) => item.ownerId).length

  return (
    <>
      <PageHeader
        title="Administradores"
        description="Controle níveis de acesso e distribua veículos e motoristas entre os responsáveis."
      >
        <Button className="gap-2" onClick={openNewAdmin}>
          <Plus className="size-4" />
          Novo administrador
        </Button>
      </PageHeader>

      <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Administradores ativos"
          value={data.admins.filter((admin) => admin.active).length}
          icon={Users}
        />
        <MetricCard
          title="Acesso global"
          value={data.admins.filter((admin) => admin.active && admin.level === 'global').length}
          icon={ShieldCheck}
          tone="success"
        />
        <MetricCard
          title="Veículos atribuídos"
          value={`${assignedVehicles}/${data.vehicles.length}`}
          icon={Bus}
        />
        <MetricCard
          title="Motoristas atribuídos"
          value={`${assignedDrivers}/${data.drivers.length}`}
          icon={UserRoundCog}
        />
      </div>

      {error ? (
        <div className="mb-5 flex flex-col gap-3 border-y py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={() => void loadData()}>
            Tentar novamente
          </Button>
        </div>
      ) : null}

      <div className="space-y-5">
        <Card>
          <CardContent className="space-y-4 p-4">
            <div>
              <h2 className="font-semibold">Equipe administrativa</h2>
              <p className="text-sm text-muted-foreground">
                Globais enxergam toda a operação. Restritos enxergam somente sua responsabilidade.
              </p>
            </div>
            <FilterInput
              placeholder="Buscar administrador..."
              value={adminSearch}
              onChange={(event) => setAdminSearch(event.target.value)}
            />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Administrador</TableHead>
                  <TableHead>Nível</TableHead>
                  <TableHead>Veículos</TableHead>
                  <TableHead>Motoristas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      Carregando administradores...
                    </TableCell>
                  </TableRow>
                ) : adminPagination.pageItems.length ? (
                  adminPagination.pageItems.map((admin) => (
                    <TableRow key={admin.id}>
                      <TableCell>
                        <p className="font-semibold">
                          {admin.name}
                          {admin.current ? (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              Você
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs text-muted-foreground">{admin.email}</p>
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          type="raw"
                          value={admin.level}
                          label={admin.level === 'global' ? 'Global' : 'Restrito'}
                        />
                      </TableCell>
                      <TableCell>{admin.vehiclesCount}</TableCell>
                      <TableCell>{admin.driversCount}</TableCell>
                      <TableCell>
                        <StatusBadge
                          type="raw"
                          value={admin.active ? 'ativo' : 'inativo'}
                          label={admin.active ? 'Ativo' : 'Inativo'}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Editar administrador"
                          onClick={() => openEditAdmin(admin)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      Nenhum administrador encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <TablePagination {...adminPagination} />
          </CardContent>
        </Card>

        <div className="grid items-start gap-5 xl:grid-cols-2">
          <Card>
            <CardContent className="space-y-4 p-4">
              <div>
                <h2 className="font-semibold">Responsabilidade por veículo</h2>
                <p className="text-sm text-muted-foreground">
                  Operações e motoristas vinculados ativos são transferidos em conjunto.
                </p>
              </div>
              <FilterInput
                placeholder="Buscar veículo ou responsável..."
                value={vehicleSearch}
                onChange={(event) => setVehicleSearch(event.target.value)}
              />
              <ResourceTable
                admins={data.admins}
                items={data.vehicles}
                resourceType="vehicle"
                search={vehicleSearch}
                savingId={savingId}
                onAssign={assignResource}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-4">
              <div>
                <h2 className="font-semibold">Responsabilidade por motorista</h2>
                <p className="text-sm text-muted-foreground">
                  Veículos e outros motoristas conectados por vínculos ativos acompanham a transferência.
                </p>
              </div>
              <FilterInput
                placeholder="Buscar motorista ou responsável..."
                value={driverSearch}
                onChange={(event) => setDriverSearch(event.target.value)}
              />
              <ResourceTable
                admins={data.admins}
                items={data.drivers}
                resourceType="driver"
                search={driverSearch}
                savingId={savingId}
                onAssign={assignResource}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <AdminDialog
        admin={editingAdmin}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={loadData}
      />
    </>
  )
}
