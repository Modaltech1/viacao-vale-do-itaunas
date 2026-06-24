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
import { CircleCheckBig, Plus, UserCheck, Users, Wrench } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { MechanicDialog } from '@/components/mechanics/mechanic-dialog'
import { FilterInput, FilterSelect } from '@/components/shared/filters'
import { MetricCard } from '@/components/shared/metric-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { TableDetailsButton } from '@/components/shared/table-details-button'
import { TablePagination, useTablePagination } from '@/components/shared/table-pagination'
import { brl } from '@/lib/format'
import type { MechanicListItem } from '@/types/mechanic'

export default function MechanicsPage() {
  const [mechanics, setMechanics] = useState<MechanicListItem[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('todos')
  const [specialty, setSpecialty] = useState('todas')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadMechanics = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/admin/mecanicos', { cache: 'no-store' })
      const result = await response.json()

      if (!response.ok) throw new Error(result.error || 'Não foi possível carregar os mecânicos.')

      setMechanics(result.items ?? [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar os mecânicos.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadMechanics()
  }, [loadMechanics])

  const specialties = useMemo(
    () => [...new Set(mechanics.map((mechanic) => mechanic.specialty).filter(Boolean))].sort(),
    [mechanics],
  )

  const filteredMechanics = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')

    return mechanics.filter((mechanic) => {
      const matchesSearch =
        !term
        || mechanic.name.toLocaleLowerCase('pt-BR').includes(term)
        || mechanic.email.toLocaleLowerCase('pt-BR').includes(term)
        || mechanic.phone.toLocaleLowerCase('pt-BR').includes(term)
        || mechanic.specialty.toLocaleLowerCase('pt-BR').includes(term)
      const matchesStatus = status === 'todos' || mechanic.professionalStatus === status
      const matchesSpecialty = specialty === 'todas' || mechanic.specialty === specialty

      return matchesSearch && matchesStatus && matchesSpecialty
    })
  }, [mechanics, search, specialty, status])
  const mechanicPagination = useTablePagination(
    filteredMechanics,
    `${search}|${status}|${specialty}`,
  )

  return (
    <>
      <PageHeader
        title="Mecânicos"
        description="Controle de acesso, especialidades e histórico de manutenção da equipe."
      >
        <Button className="gap-2" onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" />
          Novo mecânico
        </Button>
      </PageHeader>

      <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total" value={mechanics.length} icon={Users} />
        <MetricCard
          title="Ativos"
          value={mechanics.filter(
            (mechanic) => mechanic.professionalStatus === 'ativo' && mechanic.accessActive,
          ).length}
          icon={UserCheck}
          tone="success"
        />
        <MetricCard
          title="Manutenções abertas"
          value={mechanics.reduce((total, mechanic) => total + mechanic.openMaintenancesCount, 0)}
          icon={Wrench}
          tone="warning"
        />
        <MetricCard
          title="Concluídas"
          value={mechanics.reduce((total, mechanic) => total + mechanic.completedMaintenancesCount, 0)}
          icon={CircleCheckBig}
          tone="success"
        />
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_minmax(190px,0.55fr)_minmax(220px,0.65fr)]">
            <FilterInput
              placeholder="Buscar por nome, email, telefone ou especialidade..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <FilterSelect value={status} onValueChange={setStatus}>
              <option value="todos">Todos os status</option>
              <option value="ativo">Ativos</option>
              <option value="inativo">Inativos</option>
            </FilterSelect>
            <FilterSelect value={specialty} onValueChange={setSpecialty}>
              <option value="todas">Todas as especialidades</option>
              {specialties.map((item) => <option key={item} value={item}>{item}</option>)}
            </FilterSelect>
          </div>

          {error ? (
            <div className="flex flex-col gap-3 border-t py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={() => void loadMechanics()}>
                Tentar novamente
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Especialidade</TableHead>
                  <TableHead>Manutenções</TableHead>
                  <TableHead>Custo em peças</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      Carregando mecânicos...
                    </TableCell>
                  </TableRow>
                ) : filteredMechanics.length ? (
                  mechanicPagination.pageItems.map((mechanic) => (
                    <TableRow key={mechanic.id}>
                      <TableCell>
                        <p className="font-semibold">{mechanic.name}</p>
                        <p className="text-xs text-muted-foreground">{mechanic.email}</p>
                      </TableCell>
                      <TableCell>{mechanic.phone || 'Não informado'}</TableCell>
                      <TableCell>{mechanic.specialty}</TableCell>
                      <TableCell>
                        {mechanic.maintenancesCount}
                        {mechanic.openMaintenancesCount
                          ? <span className="ml-1 text-xs text-muted-foreground">({mechanic.openMaintenancesCount} abertas)</span>
                          : null}
                      </TableCell>
                      <TableCell>{brl(mechanic.totalValue)}</TableCell>
                      <TableCell>
                        <StatusBadge
                          type="raw"
                          value={mechanic.accessActive ? mechanic.professionalStatus : 'inativo'}
                          label={
                            !mechanic.accessActive
                              ? 'Acesso inativo'
                              : mechanic.professionalStatus === 'ativo'
                                ? 'Ativo'
                                : 'Inativo'
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <TableDetailsButton href={`/admin/mecanicos/${mechanic.id}`} />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      Nenhum mecânico encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
          {!error && !loading ? <TablePagination {...mechanicPagination} /> : null}
        </CardContent>
      </Card>

      <MechanicDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={loadMechanics}
      />
    </>
  )
}
