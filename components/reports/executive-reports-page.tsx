'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@prodexy/ui'
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bus,
  CircleDollarSign,
  Download,
  Fuel,
  Gauge,
  Package,
  PackageMinus,
  Route,
  ShieldCheck,
  TrendingUp,
  Wrench,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { PageHeader } from '@/components/layout/page-header'
import { FilterInput, FilterSelect } from '@/components/shared/filters'
import { ProgressBar } from '@/components/shared/progress-bar'
import { StatusBadge } from '@/components/shared/status-badge'
import { TablePagination, useTablePagination } from '@/components/shared/table-pagination'
import { brl, number } from '@/lib/format'
import { formatKm } from '@/lib/km'
import { vehicleDocumentLabel } from '@/lib/vehicle-documents'
import type { ReportData, ReportDelta, ReportInsight } from '@/types/report'

const chartColors = ['#0ea5e9', '#f59e0b', '#10b981', '#ef4444', '#64748b']

function dateValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

function periodDates(preset: string) {
  const now = new Date()
  const end = dateValue(now)
  const start = new Date(now)

  if (preset === 'month') start.setDate(1)
  else if (preset === 'quarter') start.setDate(start.getDate() - 89)
  else if (preset === 'year') {
    start.setMonth(0, 1)
  } else start.setDate(start.getDate() - 29)

  return { start: dateValue(start), end }
}

type Filters = {
  preset: string
  startDate: string
  endDate: string
  vehicleId: string
  driverId: string
  serviceId: string
  maintenanceType: string
}

const initialDates = periodDates('30d')
const initialFilters: Filters = {
  preset: '30d',
  startDate: initialDates.start,
  endDate: initialDates.end,
  vehicleId: 'todos',
  driverId: 'todos',
  serviceId: 'todos',
  maintenanceType: 'todos',
}

export function ExecutiveReportsPage() {
  const [filters, setFilters] = useState<Filters>(initialFilters)
  const [appliedFilters, setAppliedFilters] = useState<Filters>(initialFilters)
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadReport = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({
        inicio: appliedFilters.startDate,
        fim: appliedFilters.endDate,
      })
      if (appliedFilters.vehicleId !== 'todos') params.set('veiculo', appliedFilters.vehicleId)
      if (appliedFilters.driverId !== 'todos') params.set('motorista', appliedFilters.driverId)
      if (appliedFilters.serviceId !== 'todos') params.set('servico', appliedFilters.serviceId)
      if (appliedFilters.maintenanceType !== 'todos') {
        params.set('tipoManutencao', appliedFilters.maintenanceType)
      }

      const response = await fetch(`/api/admin/relatorios?${params}`, { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Não foi possível gerar o relatório.')
      setReport(result.report)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível gerar o relatório.')
    } finally {
      setLoading(false)
    }
  }, [appliedFilters])

  useEffect(() => {
    void loadReport()
  }, [loadReport])

  const reportResetKey = [
    appliedFilters.startDate,
    appliedFilters.endDate,
    appliedFilters.vehicleId,
    appliedFilters.driverId,
    appliedFilters.serviceId,
    appliedFilters.maintenanceType,
  ].join('|')
  const driverPagination = useTablePagination(report?.drivers ?? [], reportResetKey)
  const routePagination = useTablePagination(report?.routes ?? [], reportResetKey)

  function selectPreset(preset: string) {
    if (preset === 'custom') {
      setFilters((current) => ({ ...current, preset }))
      return
    }
    const dates = periodDates(preset)
    setFilters((current) => ({
      ...current,
      preset,
      startDate: dates.start,
      endDate: dates.end,
    }))
  }

  const topVehicleCost = report?.vehicles[0]?.totalCost ?? 0
  const maxExpense = Math.max(...(report?.expenseCategories.map((item) => item.value) ?? []), 1)
  const maxRisk = Math.max(...(report?.risks.byType.map((item) => item.value) ?? []), 1)

  return (
    <>
      <PageHeader
        title="Relatórios"
        description="Visão executiva de custos, produtividade, eficiência, disponibilidade e risco operacional."
      >
        <Button
          variant="outline"
          className="gap-2 print:hidden"
          onClick={() => window.print()}
          disabled={!report}
        >
          <Download className="size-4" />
          Exportar PDF
        </Button>
      </PageHeader>

      <Card className="mb-5 print:hidden">
        <CardContent className="space-y-3 p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(170px,0.6fr)_repeat(4,minmax(180px,1fr))]">
            <FilterSelect value={filters.preset} onValueChange={selectPreset}>
              <option value="30d">Últimos 30 dias</option>
              <option value="month">Mês atual</option>
              <option value="quarter">Últimos 90 dias</option>
              <option value="year">Ano atual</option>
              <option value="custom">Período personalizado</option>
            </FilterSelect>
            <FilterSelect
              value={filters.vehicleId}
              onValueChange={(vehicleId) => setFilters((current) => ({ ...current, vehicleId }))}
            >
              <option value="todos">Todos os veículos</option>
              {report?.options.vehicles.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </FilterSelect>
            <FilterSelect
              value={filters.driverId}
              onValueChange={(driverId) => setFilters((current) => ({ ...current, driverId }))}
            >
              <option value="todos">Todos os motoristas</option>
              {report?.options.drivers.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </FilterSelect>
            <FilterSelect
              value={filters.serviceId}
              onValueChange={(serviceId) => setFilters((current) => ({ ...current, serviceId }))}
            >
              <option value="todos">Todos os serviços</option>
              {report?.options.services.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </FilterSelect>
            <FilterSelect
              value={filters.maintenanceType}
              onValueChange={(maintenanceType) => {
                setFilters((current) => ({ ...current, maintenanceType }))
              }}
            >
              <option value="todos">Todos os tipos de manutenção</option>
              <option value="preventiva">Preventiva</option>
              <option value="corretiva">Corretiva</option>
            </FilterSelect>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="grid gap-3 sm:grid-cols-2">
              <FilterInput
                type="date"
                value={filters.startDate}
                onChange={(event) => setFilters((current) => ({
                  ...current,
                  preset: 'custom',
                  startDate: event.target.value,
                }))}
              />
              <FilterInput
                type="date"
                value={filters.endDate}
                onChange={(event) => setFilters((current) => ({
                  ...current,
                  preset: 'custom',
                  endDate: event.target.value,
                }))}
              />
            </div>
            <Button onClick={() => setAppliedFilters(filters)} disabled={loading}>
              {loading ? 'Gerando...' : 'Aplicar filtros'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Card>
          <CardContent className="flex flex-col gap-3 p-8 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" onClick={() => void loadReport()}>Tentar novamente</Button>
          </CardContent>
        </Card>
      ) : loading || !report ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">Consolidando indicadores...</CardContent></Card>
      ) : (
        <>
          <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <ExecutiveMetric
              title="Custo operacional"
              value={brl(report.metrics.totalCost)}
              subtitle="Combustível, manutenção e despesas"
              icon={CircleDollarSign}
              delta={report.metrics.deltas.totalCost}
              inverseDelta
            />
            <ExecutiveMetric
              title="Custo por KM"
              value={report.metrics.costPerKm == null ? 'Sem base' : `${brl(report.metrics.costPerKm)} / km`}
              subtitle="Custo variável sobre KM concluídos"
              icon={Gauge}
              delta={report.metrics.deltas.costPerKm}
              inverseDelta
            />
            <ExecutiveMetric
              title="KM produzidos"
              value={formatKm(report.metrics.totalKm)}
              subtitle={`${formatKm(report.metrics.averageTripKm ?? 0)} km por viagem concluída`}
              icon={Route}
              delta={report.metrics.deltas.totalKm}
            />
            <ExecutiveMetric
              title="Eficiência de combustível"
              value={report.metrics.fuelEfficiency == null
                ? 'Sem base'
                : `${formatKm(report.metrics.fuelEfficiency, 2)} km/L`}
              subtitle={report.metrics.averageFuelPrice == null
                ? 'Preço médio indisponível'
                : `${brl(report.metrics.averageFuelPrice)} por litro`}
              icon={Fuel}
              delta={report.metrics.deltas.fuelEfficiency}
            />
          </div>

          <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <RatioCard title="Disponibilidade atual" value={report.metrics.fleetAvailability} icon={ShieldCheck} />
            <RatioCard title="Utilização no período" value={report.metrics.fleetUtilization} icon={Bus} />
            <RatioCard title="Viagens concluídas" value={report.metrics.tripCompletionRate} icon={Activity} />
            <RatioCard title="Manutenção preventiva" value={report.metrics.preventiveMaintenanceRate} icon={Wrench} />
          </div>

          <div className="mb-5 grid gap-3 lg:grid-cols-4">
            {report.insights.map((insight) => (
              <Insight key={insight.title} insight={insight} />
            ))}
          </div>

          <Tabs defaultValue="executivo" className="space-y-4">
            <TabsList className="flex h-auto flex-wrap print:hidden">
              <TabsTrigger value="executivo">Visão executiva</TabsTrigger>
              <TabsTrigger value="custos">Custos e eficiência</TabsTrigger>
              <TabsTrigger value="operacao">Operação e risco</TabsTrigger>
            </TabsList>

            <TabsContent value="executivo" className="space-y-5">
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.8fr)]">
                <ChartCard title="Evolução operacional" description="Custos e quilometragem no período selecionado.">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={report.trend} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                      <YAxis yAxisId="cost" tickLine={false} axisLine={false} fontSize={12} width={72} tickFormatter={compactMoney} />
                      <YAxis yAxisId="km" orientation="right" tickLine={false} axisLine={false} fontSize={12} width={48} tickFormatter={(value) => `${formatKm(value)} km`} />
                      <Tooltip formatter={(value, name) => (
                        name === 'km' ? `${formatKm(Number(value))} km` : brl(Number(value))
                      )} />
                      <Legend />
                      <Area yAxisId="cost" type="monotone" dataKey="fuel" name="Combustível" stackId="cost" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.45} />
                      <Area yAxisId="cost" type="monotone" dataKey="maintenance" name="Manutenção" stackId="cost" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.45} />
                      <Area yAxisId="cost" type="monotone" dataKey="expenses" name="Despesas" stackId="cost" stroke="#64748b" fill="#64748b" fillOpacity={0.4} />
                      <Area yAxisId="km" type="monotone" dataKey="km" name="KM" stroke="#10b981" fill="transparent" strokeWidth={2.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Composição do custo" description="Participação por centro de custo variável.">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={report.costBreakdown}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={58}
                        outerRadius={92}
                        paddingAngle={3}
                      >
                        {report.costBreakdown.map((item, index) => (
                          <Cell key={item.name} fill={chartColors[index % chartColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => brl(Number(value))} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Ranking de custo por veículo</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Identifica ativos com maior impacto financeiro e baixa diluição por quilometragem.
                  </p>
                </CardHeader>
                <CardContent className="space-y-5">
                  {report.vehicles.slice(0, 8).map((vehicle) => (
                    <div key={vehicle.id} className="space-y-2">
                      <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
                        <Link href={`/admin/veiculos/${vehicle.id}`} className="font-semibold text-primary">
                          {vehicle.label}
                        </Link>
                        <span>
                          {brl(vehicle.totalCost)}
                          <span className="ml-2 text-muted-foreground">
                            {vehicle.costPerKm == null ? 'sem KM concluído' : `${brl(vehicle.costPerKm)}/km`}
                          </span>
                        </span>
                      </div>
                      <ProgressBar value={vehicle.totalCost} max={Math.max(topVehicleCost, 1)} />
                      <p className="text-xs text-muted-foreground">
                        {formatKm(vehicle.km)} km · {vehicle.trips} viagem(ns) · consumo {vehicle.consumption == null ? 'sem base' : `${formatKm(vehicle.consumption, 2)} km/L`}
                      </p>
                    </div>
                  ))}
                  {!report.vehicles.length ? <EmptyMessage /> : null}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="custos" className="space-y-5">
              <div className="grid gap-5 xl:grid-cols-3">
                <ChartCard title="Custo comparativo por veículo" description="Os ativos mais caros do período, separados por origem.">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={report.vehicles.slice(0, 7)} layout="vertical" margin={{ left: 12, right: 12 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tickFormatter={compactMoney} fontSize={12} />
                      <YAxis type="category" dataKey="label" width={115} tickLine={false} axisLine={false} fontSize={11} />
                      <Tooltip formatter={(value) => brl(Number(value))} />
                      <Legend />
                      <Bar dataKey="fuelCost" name="Combustível" stackId="cost" fill="#0ea5e9" />
                      <Bar dataKey="maintenanceCost" name="Manutenção" stackId="cost" fill="#f59e0b" />
                      <Bar dataKey="expenseCost" name="Despesas" stackId="cost" fill="#64748b" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Composição da manutenção" description="Participação de serviços e peças no custo das intervenções.">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { name: 'Serviços', custo: report.maintenance.servicesCost },
                      { name: 'Peças', custo: report.maintenance.partsCost },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} />
                      <YAxis tickFormatter={compactMoney} fontSize={12} />
                      <Tooltip formatter={(value) => brl(Number(value))} />
                      <Bar dataKey="custo" name="Custo" fill="#0891b2" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <Card>
                  <CardHeader>
                    <CardTitle>Despesas por categoria</CardTitle>
                    <p className="text-sm text-muted-foreground">Custos de viagens e lançamentos avulsos diretamente ligados aos veículos.</p>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {report.expenseCategories.map((item) => (
                      <div key={item.name} className="space-y-2">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span>{item.name}</span>
                          <span className="font-medium">{brl(item.value)}</span>
                        </div>
                        <ProgressBar value={item.value} max={maxExpense} />
                        <p className="text-xs text-muted-foreground">{item.count} lançamento(s)</p>
                      </div>
                    ))}
                    {!report.expenseCategories.length ? <EmptyMessage /> : null}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Produtividade por motorista</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Distância produzida, regularidade de conclusão e custos diretamente atribuídos.
                  </p>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Motorista</TableHead>
                        <TableHead>Viagens</TableHead>
                        <TableHead>Conclusão</TableHead>
                        <TableHead>KM</TableHead>
                        <TableHead>Média por viagem</TableHead>
                        <TableHead>Combustível</TableHead>
                        <TableHead>Despesas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.drivers.length ? driverPagination.pageItems.map((driver) => (
                        <TableRow key={driver.id}>
                          <TableCell>
                            <Link className="font-semibold text-primary" href={`/admin/motoristas/${driver.id}`}>
                              {driver.name}
                            </Link>
                          </TableCell>
                          <TableCell>{driver.trips}</TableCell>
                          <TableCell>{number(driver.completionRate, 1)}%</TableCell>
                          <TableCell>{formatKm(driver.km)}</TableCell>
                          <TableCell>{driver.averageTripKm == null ? '—' : `${formatKm(driver.averageTripKm)} km`}</TableCell>
                          <TableCell>{brl(driver.fuelCost)}</TableCell>
                          <TableCell>{brl(driver.expenseCost)}</TableCell>
                        </TableRow>
                      )) : (
                        <TableRow><TableCell colSpan={7}><EmptyMessage /></TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                  <TablePagination {...driverPagination} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="operacao" className="space-y-5">
              <div className="grid gap-5 xl:grid-cols-2">
                <ChartCard title="Estratégia de manutenção" description="Equilíbrio entre prevenção e correção, por custo e volume.">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { name: 'Preventiva', custo: report.maintenance.preventiveCost, quantidade: report.maintenance.preventiveCount },
                      { name: 'Corretiva', custo: report.maintenance.correctiveCost, quantidade: report.maintenance.correctiveCount },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} />
                      <YAxis yAxisId="cost" tickFormatter={compactMoney} fontSize={12} />
                      <YAxis yAxisId="count" orientation="right" fontSize={12} />
                      <Tooltip formatter={(value, name) => name === 'custo' ? brl(Number(value)) : number(Number(value))} />
                      <Legend />
                      <Bar yAxisId="cost" dataKey="custo" name="Custo" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      <Bar yAxisId="count" dataKey="quantidade" name="Quantidade" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <Card>
                  <CardHeader>
                    <CardTitle>Exposição operacional</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Pendências abertas por origem de risco.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {report.risks.byType.map((item) => (
                      <div key={item.name} className="space-y-2">
                        <div className="flex justify-between gap-3 text-sm">
                          <span className="capitalize">{riskLabel(item.name)}</span>
                          <span className="font-medium">{number(item.value)}</span>
                        </div>
                        <ProgressBar value={item.value} max={maxRisk} />
                      </div>
                    ))}
                    {!report.risks.byType.length ? <EmptyMessage /> : null}
                    <div className="flex flex-wrap gap-2 border-t pt-4">
                      {report.risks.bySeverity.map((item) => (
                        <StatusBadge
                          key={item.name}
                          type="severity"
                          value={item.name as 'critica' | 'atencao' | 'baixa'}
                        />
                      ))}
                      <span className="text-xs text-muted-foreground">
                        {report.metrics.criticalPendings} crítica(s) · {report.metrics.openMaintenances} manutenção(ões) ativa(s)
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-5 xl:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle>Estoque e consumo de peças</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Capital em estoque e itens consumidos nas manutenções do período.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <InventoryMetric
                        label="Valor em estoque"
                        value={brl(report.inventory.stockValue)}
                        icon={Package}
                      />
                      <InventoryMetric
                        label="Consumo no período"
                        value={brl(report.inventory.consumedCost)}
                        icon={Wrench}
                      />
                      <InventoryMetric
                        label="Estoque baixo"
                        value={number(report.inventory.lowStockCount)}
                        icon={PackageMinus}
                      />
                      <InventoryMetric
                        label="Sem estoque"
                        value={number(report.inventory.outOfStockCount)}
                        icon={PackageMinus}
                      />
                    </div>
                    <div className="space-y-3 border-t pt-4">
                      {report.inventory.topParts.slice(0, 5).map((part) => (
                        <div key={part.name} className="flex items-center justify-between gap-3 text-sm">
                          <div>
                            <p className="font-medium">{part.name}</p>
                            <p className="text-xs text-muted-foreground">{part.count} uso(s)</p>
                          </div>
                          <span className="font-semibold">{brl(part.value)}</span>
                        </div>
                      ))}
                      {!report.inventory.topParts.length ? <EmptyMessage /> : null}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Serviços de manutenção por categoria</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Frequência de execução por sistema do veículo.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {report.maintenance.categories.map((item) => (
                      <div key={item.name} className="flex items-center justify-between gap-4 border-b py-3 last:border-0">
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.count} execução(ões)</p>
                        </div>
                        <span className="font-semibold">{item.count} execução(ões)</span>
                      </div>
                    ))}
                    {!report.maintenance.categories.length ? <EmptyMessage /> : null}
                    <div className="border-t pt-4 text-sm text-muted-foreground">
                      Tempo médio para conclusão:{' '}
                      <b className="text-foreground">
                        {report.maintenance.averageResolutionHours == null
                          ? 'sem base'
                          : `${number(report.maintenance.averageResolutionHours, 1)} horas`}
                      </b>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Desempenho por rota</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Volume percorrido e custos vinculados às viagens.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Rota</TableHead>
                          <TableHead>Viagens</TableHead>
                          <TableHead>KM</TableHead>
                          <TableHead>Custo</TableHead>
                          <TableHead>Custo/KM</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {routePagination.pageItems.map((route) => (
                          <TableRow key={route.name}>
                            <TableCell className="font-medium">{route.name}</TableCell>
                            <TableCell>{route.trips}</TableCell>
                            <TableCell>{formatKm(route.km)}</TableCell>
                            <TableCell>{brl(route.totalCost)}</TableCell>
                            <TableCell>{route.costPerKm == null ? '—' : brl(route.costPerKm)}</TableCell>
                          </TableRow>
                        ))}
                        {!report.routes.length ? (
                          <TableRow><TableCell colSpan={5}><EmptyMessage /></TableCell></TableRow>
                        ) : null}
                      </TableBody>
                    </Table>
                    <TablePagination {...routePagination} />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </>
  )
}

function ExecutiveMetric({
  title,
  value,
  subtitle,
  icon: Icon,
  delta,
  inverseDelta = false,
}: {
  title: string
  value: string
  subtitle: string
  icon: typeof TrendingUp
  delta: ReportDelta
  inverseDelta?: boolean
}) {
  const good = delta.direction === 'flat'
    || (inverseDelta ? delta.direction === 'down' : delta.direction === 'up')
  const DeltaIcon = delta.direction === 'up'
    ? ArrowUpRight
    : delta.direction === 'down'
      ? ArrowDownRight
      : ArrowRight
  const deltaLabel = delta.direction === 'new'
    ? 'nova base'
    : delta.value == null
      ? 'sem comparação'
      : `${Math.abs(delta.value).toFixed(1)}%`

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold leading-tight">{value}</p>
        <div className="mt-2 flex items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground">{subtitle}</span>
          <span className={`flex shrink-0 items-center gap-1 ${good ? 'text-emerald-700' : 'text-red-700'}`}>
            <DeltaIcon className="size-3.5" />
            {deltaLabel}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

function RatioCard({
  title,
  value,
  icon: Icon,
}: {
  title: string
  value: number
  icon: typeof Activity
}) {
  const tone = value >= 80 ? 'text-emerald-700' : value >= 60 ? 'text-amber-700' : 'text-red-700'
  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <Icon className="size-4 text-muted-foreground" />
        </div>
        <div className="flex items-end justify-between gap-4">
          <p className={`text-2xl font-bold ${tone}`}>{number(value, 1)}%</p>
          <div className="h-2 min-w-24 flex-1 overflow-hidden rounded-sm bg-muted">
            <div className="h-full bg-primary" style={{ width: `${Math.min(value, 100)}%` }} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function InventoryMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: typeof Package
}) {
  return (
    <div className="border p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <p className="font-semibold">{value}</p>
    </div>
  )
}

function Insight({ insight }: { insight: ReportInsight }) {
  const classes = {
    success: 'border-emerald-200 bg-emerald-50/60',
    warning: 'border-amber-200 bg-amber-50/60',
    danger: 'border-red-200 bg-red-50/60',
    info: 'border-sky-200 bg-sky-50/60',
  }
  return (
    <div className={`border p-4 ${classes[insight.tone]}`}>
      <p className="font-semibold">{insight.title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{insight.description}</p>
    </div>
  )
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="h-[340px]">{children}</CardContent>
    </Card>
  )
}

function EmptyMessage() {
  return <p className="py-8 text-center text-sm text-muted-foreground">Sem dados para o período filtrado.</p>
}

function compactMoney(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

function riskLabel(value: string) {
  const labels: Record<string, string> = {
    servico_km: 'Serviço por KM',
    servico_tempo: 'Serviço por tempo',
    manutencao_aberta: 'Manutenção aberta',
    veiculo_status: 'Situação do veículo',
    cnh: 'CNH',
    manual: 'Manual',
  }
  return labels[value] ?? vehicleDocumentLabel(value)
}
