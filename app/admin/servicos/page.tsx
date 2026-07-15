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
import { CircleGauge, Clock3, Droplets, Pencil, Plus, RotateCw, Wrench } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { ServiceDialog } from '@/components/services/service-dialog'
import { FilterInput, FilterSelect } from '@/components/shared/filters'
import { MetricCard } from '@/components/shared/metric-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { TablePagination, useTablePagination } from '@/components/shared/table-pagination'
import { brl, number } from '@/lib/format'
import { formatKm } from '@/lib/km'
import { compareByTextPtBr } from '@/lib/sorting'
import { serviceCategories, type ServiceListItem } from '@/types/service'

function periodicityLabel(service: ServiceListItem) {
  if (service.periodicityType === 'km') return `${formatKm(service.periodicityKm ?? 0)} km`
  if (service.periodicityType === 'tempo') return `${number(service.periodicityDays ?? 0)} dias`
  return 'Sem recorrência'
}

export default function ServicesPage() {
  const [services, setServices] = useState<ServiceListItem[]>([])
  const [selectedService, setSelectedService] = useState<ServiceListItem | null>(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('todas')
  const [periodicity, setPeriodicity] = useState('todas')
  const [maintenanceType, setMaintenanceType] = useState('todos')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadServices = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/admin/servicos', { cache: 'no-store' })
      const result = await response.json()

      if (!response.ok) throw new Error(result.error || 'Não foi possível carregar os serviços.')

      setServices(result.items ?? [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar os serviços.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadServices()
  }, [loadServices])

  const filteredServices = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')

    return services.filter((service) => {
      const matchesSearch =
        !term
        || service.name.toLocaleLowerCase('pt-BR').includes(term)
        || service.description.toLocaleLowerCase('pt-BR').includes(term)
      const matchesCategory = category === 'todas' || service.category === category
      const matchesPeriodicity =
        periodicity === 'todas' || service.periodicityType === periodicity
      const matchesMaintenanceType =
        maintenanceType === 'todos' || service.suggestedMaintenanceType === maintenanceType

      return matchesSearch && matchesCategory && matchesPeriodicity && matchesMaintenanceType
    }).sort((a, b) => compareByTextPtBr(a, b, (service) => service.name, (service) => service.category))
  }, [category, maintenanceType, periodicity, search, services])
  const servicePagination = useTablePagination(
    filteredServices,
    `${search}|${category}|${periodicity}|${maintenanceType}`,
  )

  function openNewService() {
    setSelectedService(null)
    setDialogOpen(true)
  }

  function openEditService(service: ServiceListItem) {
    setSelectedService(service)
    setDialogOpen(true)
  }

  return (
    <>
      <PageHeader
        title="Serviços"
        description="Catálogo central de manutenção. Óleo e pneus são categorias de serviço com periodicidade."
      >
        <Button className="gap-2" onClick={openNewService}>
          <Plus className="size-4" />
          Novo serviço
        </Button>
      </PageHeader>

      <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard title="Serviços" value={services.length} icon={Wrench} />
        <MetricCard
          title="Por KM"
          value={services.filter((service) => service.periodicityType === 'km').length}
          icon={CircleGauge}
        />
        <MetricCard
          title="Por tempo"
          value={services.filter((service) => service.periodicityType === 'tempo').length}
          icon={Clock3}
        />
        <MetricCard
          title="Óleo"
          value={services.filter((service) => service.category === 'Óleo').length}
          icon={Droplets}
        />
        <MetricCard
          title="Pneus"
          value={services.filter((service) => service.category === 'Pneus').length}
          icon={RotateCw}
        />
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_minmax(190px,0.55fr)_minmax(190px,0.55fr)_minmax(190px,0.55fr)]">
            <FilterInput
              placeholder="Buscar por nome ou descrição..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <FilterSelect value={category} onValueChange={setCategory}>
              <option value="todas">Todas as categorias</option>
              {serviceCategories.map((serviceCategory) => (
                <option key={serviceCategory} value={serviceCategory}>{serviceCategory}</option>
              ))}
            </FilterSelect>
            <FilterSelect value={periodicity} onValueChange={setPeriodicity}>
              <option value="todas">Todas as periodicidades</option>
              <option value="km">Por KM</option>
              <option value="tempo">Por tempo</option>
              <option value="nenhuma">Sem recorrência</option>
            </FilterSelect>
            <FilterSelect value={maintenanceType} onValueChange={setMaintenanceType}>
              <option value="todos">Todos os tipos sugeridos</option>
              <option value="preventiva">Preventiva</option>
              <option value="corretiva">Corretiva</option>
            </FilterSelect>
          </div>

          {error ? (
            <div className="flex flex-col gap-3 border-t py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={() => void loadServices()}>
                Tentar novamente
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Serviço</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Tipo sugerido</TableHead>
                  <TableHead>Periodicidade</TableHead>
                  <TableHead>Valor padrão</TableHead>
                  <TableHead>Veículos vinculados</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      Carregando serviços...
                    </TableCell>
                  </TableRow>
                ) : filteredServices.length ? (
                  servicePagination.pageItems.map((service) => (
                    <TableRow key={service.id}>
                      <TableCell>
                        <p className="font-semibold">{service.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {service.description || 'Sem descrição'}
                        </p>
                      </TableCell>
                      <TableCell>{service.category}</TableCell>
                      <TableCell>
                        {service.suggestedMaintenanceType === 'preventiva'
                          ? 'Preventiva'
                          : 'Corretiva'}
                      </TableCell>
                      <TableCell>{periodicityLabel(service)}</TableCell>
                      <TableCell>{brl(service.defaultValue)}</TableCell>
                      <TableCell>
                        {service.linkedVehiclesCount}
                        {service.maintenanceUsesCount ? (
                          <span className="ml-1 text-xs text-muted-foreground">
                            · {service.maintenanceUsesCount} usos
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          type="raw"
                          value={service.active ? 'ativo' : 'inativo'}
                          label={service.active ? 'Ativo' : 'Inativo'}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => openEditService(service)}
                        >
                          <Pencil className="size-4" />
                          Editar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      Nenhum serviço encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
          {!error && !loading ? <TablePagination {...servicePagination} /> : null}
        </CardContent>
      </Card>

      <ServiceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        service={selectedService}
        onSaved={loadServices}
      />
    </>
  )
}
