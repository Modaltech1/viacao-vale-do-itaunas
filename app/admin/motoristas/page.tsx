'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@prodexy/ui'
import { BadgeAlert, Gauge, Plus, UserCheck, Users } from 'lucide-react'
import { DriverDialog } from '@/components/drivers/driver-dialog'
import { PageHeader } from '@/components/layout/page-header'
import { FilterInput, FilterSelect } from '@/components/shared/filters'
import { MetricCard } from '@/components/shared/metric-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { TableDetailsButton } from '@/components/shared/table-details-button'
import { TablePagination, useTablePagination } from '@/components/shared/table-pagination'
import { number } from '@/lib/format'
import { formatKm } from '@/lib/km'
import { driverProfessionalStatusLabel } from '@/lib/driver-utils'
import { compareByTextPtBr } from '@/lib/sorting'
import type { DriverListItem, DriverVehicleOption } from '@/types/driver'

export default function DriversPage() {
  const [drivers, setDrivers] = useState<DriverListItem[]>([])
  const [vehicles, setVehicles] = useState<DriverVehicleOption[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('todos')
  const [licenseStatus, setLicenseStatus] = useState('todos')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadDrivers = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/admin/motoristas', { cache: 'no-store' })
      const result = await response.json()

      if (!response.ok) throw new Error(result.error || 'Não foi possível carregar os motoristas.')

      setDrivers(result.items ?? [])
      setVehicles(result.vehicles ?? [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar os motoristas.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDrivers()
  }, [loadDrivers])

  const filteredDrivers = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')

    return drivers.filter((driver) => {
      const matchesSearch =
        !term
        || driver.name.toLocaleLowerCase('pt-BR').includes(term)
        || driver.email.toLocaleLowerCase('pt-BR').includes(term)
        || driver.phone.toLocaleLowerCase('pt-BR').includes(term)
        || driver.cpf.toLocaleLowerCase('pt-BR').includes(term)
        || driver.vehicle?.fleetCode.toLocaleLowerCase('pt-BR').includes(term)
        || driver.vehicle?.plate.toLocaleLowerCase('pt-BR').includes(term)

      const matchesStatus = status === 'todos' || driver.professionalStatus === status
      const matchesLicense = licenseStatus === 'todos' || driver.licenseStatus === licenseStatus

      return matchesSearch && matchesStatus && matchesLicense
    }).sort((a, b) => compareByTextPtBr(a, b, (driver) => driver.name, (driver) => driver.email))
  }, [drivers, licenseStatus, search, status])
  const driverPagination = useTablePagination(
    filteredDrivers,
    `${search}|${status}|${licenseStatus}`,
  )

  const totalKm = drivers.reduce((total, driver) => total + driver.totalKm, 0)

  return (
    <>
      <PageHeader
        title="Motoristas"
        description="Controle de acesso, dados cadastrais, CNH, veículos vinculados e histórico operacional."
      >
        <Button className="gap-2" onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" />
          Novo motorista
        </Button>
      </PageHeader>

      <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total" value={drivers.length} icon={Users} />
        <MetricCard
          title="Ativos"
          value={drivers.filter((driver) => driver.professionalStatus === 'ativo' && driver.accessActive).length}
          icon={UserCheck}
          tone="success"
        />
        <MetricCard
          title="CNH vencida"
          value={drivers.filter((driver) => driver.licenseStatus === 'vencido').length}
          icon={BadgeAlert}
          tone="danger"
        />
        <MetricCard title="KM total" value={formatKm(totalKm)} icon={Gauge} />
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_minmax(190px,0.55fr)_minmax(190px,0.55fr)]">
            <FilterInput
              placeholder="Buscar por nome, email, CPF, telefone ou frota..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <FilterSelect value={status} onValueChange={setStatus}>
              <option value="todos">Todos os status</option>
              <option value="ativo">Ativos</option>
              <option value="afastado">Afastados</option>
              <option value="inativo">Inativos</option>
              <option value="inapto">Inaptos</option>
            </FilterSelect>
            <FilterSelect value={licenseStatus} onValueChange={setLicenseStatus}>
              <option value="todos">Todas as CNHs</option>
              <option value="em_dia">Em dia</option>
              <option value="proximo">Próximas do vencimento</option>
              <option value="vencido">Vencidas</option>
            </FilterSelect>
          </div>

          {error ? (
            <div className="flex flex-col gap-3 border-t py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={() => void loadDrivers()}>
                Tentar novamente
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Veículo vinculado</TableHead>
                  <TableHead>CNH</TableHead>
                  <TableHead>KM</TableHead>
                  <TableHead>Litros</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      Carregando motoristas...
                    </TableCell>
                  </TableRow>
                ) : filteredDrivers.length ? (
                  driverPagination.pageItems.map((driver) => (
                    <TableRow key={driver.id}>
                      <TableCell>
                        <p className="font-semibold">{driver.name}</p>
                        <p className="text-xs text-muted-foreground">{driver.email}</p>
                      </TableCell>
                      <TableCell>{driver.phone || 'Não informado'}</TableCell>
                      <TableCell>
                        {driver.vehicle
                          ? `${driver.vehicle.fleetCode} · ${driver.vehicle.model}`
                          : 'Sem veículo'}
                      </TableCell>
                      <TableCell>
                        <StatusBadge type="document" value={driver.licenseStatus} />
                      </TableCell>
                      <TableCell>{formatKm(driver.totalKm)}</TableCell>
                      <TableCell>{number(driver.totalLiters, 1)}</TableCell>
                      <TableCell>
                        <StatusBadge
                          type="raw"
                          value={driver.professionalStatus === 'inapto'
                            ? 'inapto'
                            : driver.accessActive
                              ? driver.professionalStatus
                              : 'inativo'}
                          label={
                            driver.professionalStatus === 'inapto'
                              ? 'Inapto'
                              : !driver.accessActive
                                ? 'Acesso inativo'
                                : driverProfessionalStatusLabel[driver.professionalStatus]
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <TableDetailsButton href={`/admin/motoristas/${driver.id}`} />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      Nenhum motorista encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
          {!error && !loading ? <TablePagination {...driverPagination} /> : null}
        </CardContent>
      </Card>

      <DriverDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        vehicles={vehicles}
        onSaved={loadDrivers}
      />
    </>
  )
}
