'use client'

import Link from 'next/link'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@prodexy/ui'
import { PageHeader } from '@/components/layout/page-header'
import { FilterSelect } from '@/components/shared/filters'
import { MetricCard } from '@/components/shared/metric-card'
import { ProgressBar } from '@/components/shared/progress-bar'
import { brl, number } from '@/lib/format'
import { dashboardTotals, driverTotalKm, vehicleConsumption, vehicleTotalCost } from '@/lib/calculations'
import { drivers, services, travelExpenses, vehicles } from '@/lib/mock-data'

export default function ReportsPage() {
  const totals = dashboardTotals()
  const totalCost = totals.refuelingCost + totals.maintenanceCost + totals.travelExpenseCost

  const vehicleCosts = vehicles
    .map((vehicle) => ({ vehicle, total: vehicleTotalCost(vehicle.id) }))
    .sort((a, b) => b.total - a.total)
  const maxCost = Math.max(...vehicleCosts.map((item) => item.total), 1)

  const expenseByType = ['Pedágio', 'Alimentação', 'Hospedagem', 'Descarga', 'Outros'].map((type) => ({
    type,
    total: travelExpenses
      .filter((expense) => expense.type === type)
      .reduce((acc, expense) => acc + expense.value, 0),
  }))
  const maxExpense = Math.max(...expenseByType.map((item) => item.total), 1)

  const driversByKm = drivers
    .map((driver) => ({ driver, km: driverTotalKm(driver.id) }))
    .sort((a, b) => b.km - a.km)
  const maxKm = Math.max(...driversByKm.map((item) => item.km), 1)

  return (
    <>
      <PageHeader title="Relatórios" description="Relatórios gerenciais com filtros por período, veículo, motorista, serviço e tipo de despesa.">
        <Button>Exportar PDF</Button>
      </PageHeader>

      <Card className="mb-5">
        <CardContent className="grid gap-3 p-4 lg:grid-cols-[repeat(5,minmax(0,1fr))_200px]">
          <FilterSelect>
            <option>Últimos 30 dias</option>
            <option>Mês atual</option>
            <option>Personalizado</option>
          </FilterSelect>
          <FilterSelect>
            <option>Todos os veículos</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id}>{vehicle.plate}</option>
            ))}
          </FilterSelect>
          <FilterSelect>
            <option>Todos os motoristas</option>
            {drivers.map((driver) => (
              <option key={driver.id}>{driver.name}</option>
            ))}
          </FilterSelect>
          <FilterSelect>
            <option>Todos os serviços</option>
            {services.map((service) => (
              <option key={service.id}>{service.name}</option>
            ))}
          </FilterSelect>
          <FilterSelect>
            <option>Tipo manutenção</option>
            <option>Preventiva</option>
            <option>Corretiva</option>
          </FilterSelect>
          <Button>Aplicar filtros</Button>
        </CardContent>
      </Card>

      <div className="mb-5 grid gap-4 md:grid-cols-4">
        <MetricCard title="Gasto total" value={brl(totalCost)} />
        <MetricCard title="KM rodados" value={number(totals.totalKm)} />
        <MetricCard title="Consumo médio" value={`${number(totals.averageConsumption, 2)} km/L`} />
        <MetricCard title="Manutenção" value={brl(totals.maintenanceCost)} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ranking de custo por veículo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {vehicleCosts.map(({ vehicle, total }) => (
              <div key={vehicle.id} className="space-y-2">
                <div className="flex justify-between gap-3 text-sm">
                  <Link href={`/admin/veiculos/${vehicle.id}`} className="font-semibold text-primary">
                    {vehicle.plate} — {vehicle.model}
                  </Link>
                  <span>{brl(total)}</span>
                </div>
                <ProgressBar value={total} max={maxCost} />
                <p className="text-xs text-muted-foreground">
                  Consumo médio: {number(vehicleConsumption(vehicle.id) || vehicle.averageConsumption, 2)} km/L
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Despesas por categoria</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {expenseByType.map((item) => (
              <div key={item.type} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>{item.type}</span>
                  <span>{brl(item.total)}</span>
                </div>
                <ProgressBar value={item.total} max={maxExpense} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Relatório por motorista</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {driversByKm.map(({ driver, km }) => (
              <div key={driver.id} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <Link href={`/admin/motoristas/${driver.id}`} className="font-semibold text-primary">
                    {driver.name}
                  </Link>
                  <span>{number(km)} km</span>
                </div>
                <ProgressBar value={km} max={maxKm} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
