'use client'

import { Button, Card, CardContent, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@prodexy/ui'
import { PageHeader } from '@/components/layout/page-header'
import { MetricCard } from '@/components/shared/metric-card'
import { brl, dateTime, number } from '@/lib/format'
import { refuelings } from '@/lib/mock-data'
import { getDriver, getVehicle } from '@/lib/selectors'
import { FilterInput, FilterSelect } from '@/components/shared/filters'

export default function RefuelingsPage() {
  const totalLiters = refuelings.reduce((acc, item) => acc + item.liters, 0)
  const totalCost = refuelings.reduce((acc, item) => acc + (item.totalValue ?? 0), 0)
  return <><PageHeader title="Abastecimentos" description="Registro operacional de consumo. Motorista informa KM e litros."><Button>Novo abastecimento</Button></PageHeader><div className="mb-5 grid gap-4 md:grid-cols-4"><MetricCard title="Registros" value={refuelings.length}/><MetricCard title="Litros" value={number(totalLiters)}/><MetricCard title="Valor estimado" value={brl(totalCost)}/><MetricCard title="Preço médio" value={brl(totalCost/totalLiters)}/></div><Card><CardContent className="space-y-4 p-4"><div className="grid gap-3 md:grid-cols-4"><FilterInput placeholder="Buscar placa/motorista..."/><FilterSelect><option>Todos os combustíveis</option><option>Diesel S10</option><option>Gasolina</option></FilterSelect><FilterInput type="date"/><FilterInput type="date"/></div><Table><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Veículo</TableHead><TableHead>Motorista</TableHead><TableHead>KM atual</TableHead><TableHead>Combustível</TableHead><TableHead>Litros</TableHead><TableHead>Valor</TableHead></TableRow></TableHeader><TableBody>{refuelings.map((item)=>{const vehicle=getVehicle(item.vehicleId); const driver=getDriver(item.driverId);return <TableRow key={item.id}><TableCell>{dateTime(item.date)}</TableCell><TableCell>{vehicle?.plate}</TableCell><TableCell>{driver?.name}</TableCell><TableCell>{number(item.currentKm)}</TableCell><TableCell>{item.fuelType}</TableCell><TableCell>{number(item.liters)}</TableCell><TableCell>{brl(item.totalValue??0)}</TableCell></TableRow>})}</TableBody></Table></CardContent></Card></>
}
