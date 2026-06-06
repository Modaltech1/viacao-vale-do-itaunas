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
import { ClipboardList, Repeat, Wrench } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { FilterInput, FilterSelect } from '@/components/shared/filters'
import { MetricCard } from '@/components/shared/metric-card'
import { number } from '@/lib/format'
import {
  serviceCategories,
  type ServiceListItem,
} from '@/types/service'

function periodicityLabel(service: ServiceListItem) {
  if (service.periodicityType === 'km') return `${number(service.periodicityKm ?? 0)} km`
  if (service.periodicityType === 'tempo') return `${number(service.periodicityDays ?? 0)} dias`
  return 'Sem recorrência'
}

export default function MechanicServicesPage() {
  const [services, setServices] = useState<ServiceListItem[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('todas')
  const [maintenanceType, setMaintenanceType] = useState('todos')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadServices = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/mechanic/servicos', { cache: 'no-store' })
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

      return (
        matchesSearch
        && (category === 'todas' || service.category === category)
        && (
          maintenanceType === 'todos'
          || service.suggestedMaintenanceType === maintenanceType
        )
      )
    })
  }, [category, maintenanceType, search, services])

  const recurringServices = services.filter(
    (service) => service.periodicityType !== 'nenhuma',
  )

  return (
    <>
      <PageHeader
        title="Serviços"
        description="Catálogo operacional usado no registro de manutenções e na geração de pendências."
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total" value={services.length} icon={ClipboardList} />
        <MetricCard
          title="Preventivos"
          value={services.filter(
            (service) => service.suggestedMaintenanceType === 'preventiva',
          ).length}
          tone="success"
        />
        <MetricCard
          title="Corretivos"
          value={services.filter(
            (service) => service.suggestedMaintenanceType === 'corretiva',
          ).length}
          icon={Wrench}
          tone="warning"
        />
        <MetricCard title="Recorrentes" value={recurringServices.length} icon={Repeat} />
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_minmax(210px,0.55fr)_minmax(210px,0.55fr)]">
            <FilterInput
              placeholder="Buscar por nome ou descrição..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <FilterSelect value={category} onValueChange={setCategory}>
              <option value="todas">Todas as categorias</option>
              {serviceCategories.map((serviceCategory) => (
                <option key={serviceCategory} value={serviceCategory}>
                  {serviceCategory}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect value={maintenanceType} onValueChange={setMaintenanceType}>
              <option value="todos">Todos os tipos</option>
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
                  <TableHead>Veículos vinculados</TableHead>
                  <TableHead>Execuções</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      Carregando serviços...
                    </TableCell>
                  </TableRow>
                ) : filteredServices.length ? (
                  filteredServices.map((service) => (
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
                      <TableCell>{service.linkedVehiclesCount}</TableCell>
                      <TableCell>{service.maintenanceUsesCount}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      Nenhum serviço encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  )
}
