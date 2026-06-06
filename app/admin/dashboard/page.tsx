'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@prodexy/ui'
import {
  AlertTriangle,
  Bus,
  DollarSign,
  Fuel,
  Gauge,
  Route,
  Wrench,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { FilterInput, FilterSelect } from '@/components/shared/filters'
import { MetricCard } from '@/components/shared/metric-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { brl, number } from '@/lib/format'
import type { DashboardData } from '@/types/dashboard'

type Period = 'mes_atual' | 'ultimos_30' | 'trimestre' | 'ano_atual' | 'personalizado'

function dateValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function periodDates(period: Period) {
  const today = new Date()
  const end = dateValue(today)

  if (period === 'mes_atual') {
    return { start: dateValue(new Date(today.getFullYear(), today.getMonth(), 1)), end }
  }
  if (period === 'trimestre') {
    return { start: dateValue(new Date(today.getFullYear(), today.getMonth() - 2, 1)), end }
  }
  if (period === 'ano_atual') {
    return { start: `${today.getFullYear()}-01-01`, end }
  }

  const start = new Date(today)
  start.setDate(start.getDate() - 29)
  return { start: dateValue(start), end }
}

const initialDates = periodDates('ultimos_30')

export default function AdminDashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [period, setPeriod] = useState<Period>('ultimos_30')
  const [startDate, setStartDate] = useState(initialDates.start)
  const [endDate, setEndDate] = useState(initialDates.end)
  const [vehicleId, setVehicleId] = useState('todos')
  const [driverId, setDriverId] = useState('todos')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams({
        inicio: startDate,
        fim: endDate,
      })
      if (vehicleId !== 'todos') params.set('veiculo', vehicleId)
      if (driverId !== 'todos') params.set('motorista', driverId)

      const response = await fetch(`/api/admin/dashboard?${params}`, { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Não foi possível carregar o dashboard.')

      setDashboard(result.dashboard)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar o dashboard.')
    } finally {
      setLoading(false)
    }
  }, [driverId, endDate, startDate, vehicleId])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  function changePeriod(value: string) {
    const nextPeriod = value as Period
    setPeriod(nextPeriod)
    if (nextPeriod !== 'personalizado') {
      const dates = periodDates(nextPeriod)
      setStartDate(dates.start)
      setEndDate(dates.end)
    }
  }

  const metrics = dashboard?.metrics
  const periodLabel = useMemo(() => {
    if (period === 'mes_atual') return 'no mês atual'
    if (period === 'trimestre') return 'nos últimos 3 meses'
    if (period === 'ano_atual') return 'no ano atual'
    if (period === 'personalizado') return 'no período selecionado'
    return 'nos últimos 30 dias'
  }, [period])

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Visão gerencial da operação, com filtros e indicadores gerais da frota."
      />

      <div className="mb-5 grid gap-3 md:grid-cols-3 xl:grid-cols-[minmax(190px,0.7fr)_minmax(220px,1fr)_minmax(220px,1fr)]">
        <FilterSelect value={period} onValueChange={changePeriod}>
          <option value="ultimos_30">Últimos 30 dias</option>
          <option value="mes_atual">Mês atual</option>
          <option value="trimestre">Últimos 3 meses</option>
          <option value="ano_atual">Ano atual</option>
          <option value="personalizado">Período personalizado</option>
        </FilterSelect>
        <FilterSelect value={vehicleId} onValueChange={setVehicleId}>
          <option value="todos">Todos os veículos</option>
          {(dashboard?.options.vehicles ?? []).map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>{vehicle.label}</option>
          ))}
        </FilterSelect>
        <FilterSelect value={driverId} onValueChange={setDriverId}>
          <option value="todos">Todos os motoristas</option>
          {(dashboard?.options.drivers ?? []).map((driver) => (
            <option key={driver.id} value={driver.id}>{driver.label}</option>
          ))}
        </FilterSelect>
      </div>

      {period === 'personalizado' ? (
        <div className="mb-5 grid gap-3 sm:grid-cols-2">
          <FilterInput
            type="date"
            aria-label="Data inicial"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
          <FilterInput
            type="date"
            aria-label="Data final"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </div>
      ) : null}

      {error && !dashboard ? (
        <Card>
          <CardContent className="space-y-4 p-8 text-center">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" onClick={() => void loadDashboard()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Total de veículos"
              value={metrics?.totalVehicles ?? 0}
              icon={Bus}
            />
            <MetricCard
              title="Em manutenção"
              value={metrics?.maintenanceVehicles ?? 0}
              icon={Wrench}
              tone="warning"
            />
            <MetricCard
              title="Viagens em andamento"
              value={metrics?.openTrips ?? 0}
              icon={Route}
            />
            <MetricCard
              title="Pendências críticas"
              value={metrics?.criticalPendings ?? 0}
              icon={AlertTriangle}
              tone="danger"
            />
            <MetricCard
              title="KM rodados"
              value={number(metrics?.totalKm ?? 0)}
              subtitle={periodLabel}
              icon={Gauge}
            />
            <MetricCard
              title="Litros abastecidos"
              value={number(metrics?.totalLiters ?? 0, 1)}
              subtitle={periodLabel}
              icon={Fuel}
            />
            <MetricCard
              title="Consumo médio"
              value={metrics?.averageConsumption == null
                ? 'Sem dados'
                : `${number(metrics.averageConsumption, 2)} km/L`}
              subtitle={periodLabel}
              icon={Gauge}
            />
            <MetricCard
              title="Gasto total"
              value={brl(metrics?.totalCost ?? 0)}
              subtitle={periodLabel}
              icon={DollarSign}
              tone="danger"
            />
          </div>

          {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <CardTitle>Alertas recentes</CardTitle>
                <Button variant="link" asChild>
                  <Link href="/admin/pendencias">Ver todas →</Link>
                </Button>
              </CardHeader>
              <CardContent>
                {loading && !dashboard ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">Carregando alertas...</p>
                ) : dashboard?.alerts.length ? (
                  <div className="divide-y">
                    {dashboard.alerts.map((alert) => (
                      <div
                        key={alert.id}
                        className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <Link href={alert.href} className="font-semibold hover:text-primary">
                            {alert.title}
                          </Link>
                          <p className="text-sm text-muted-foreground">{alert.description}</p>
                        </div>
                        <StatusBadge type="severity" value={alert.severity} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Nenhum alerta aberto para os filtros selecionados.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <CardTitle>Status dos veículos</CardTitle>
                <Button variant="link" asChild>
                  <Link href="/admin/veiculos">Ver todos →</Link>
                </Button>
              </CardHeader>
              <CardContent>
                {loading && !dashboard ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">Carregando veículos...</p>
                ) : dashboard?.vehicles.length ? (
                  <div className="divide-y">
                    {dashboard.vehicles.map((vehicle) => (
                      <div
                        key={vehicle.id}
                        className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <Link
                            href={`/admin/veiculos/${vehicle.id}`}
                            className="font-semibold text-primary hover:underline"
                          >
                            {vehicle.label}
                          </Link>
                          <p className="text-sm text-muted-foreground">
                            KM atual: {number(vehicle.currentKm)}
                          </p>
                        </div>
                        <StatusBadge type="vehicle" value={vehicle.status} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Nenhum veículo encontrado para os filtros selecionados.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </>
  )
}
