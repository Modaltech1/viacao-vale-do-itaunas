'use client'

import { Button, Card, CardContent, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@prodexy/ui'
import { PageHeader } from '@/components/layout/page-header'
import { MetricCard } from '@/components/shared/metric-card'
import { brl, dateTime } from '@/lib/format'
import { travelExpenses } from '@/lib/mock-data'
import { getDriver, getVehicle } from '@/lib/selectors'
import { FilterInput, FilterSelect } from '@/components/shared/filters'

export default function ExpensesPage() {
  const total = travelExpenses.reduce((acc, item) => acc + item.value, 0)
  const types = Array.from(new Set(travelExpenses.map((item) => item.type)))
  return <><PageHeader title="Despesas" description="Pedágio, alimentação, hospedagem, descarga e outros gastos da viagem."><Button>Nova despesa</Button></PageHeader><div className="mb-5 grid gap-4 md:grid-cols-4"><MetricCard title="Total" value={brl(total)}/><MetricCard title="Pedágio" value={brl(travelExpenses.filter(e=>e.type==='Pedágio').reduce((a,e)=>a+e.value,0))}/><MetricCard title="Alimentação" value={brl(travelExpenses.filter(e=>e.type==='Alimentação').reduce((a,e)=>a+e.value,0))}/><MetricCard title="Categorias" value={types.length}/></div><Card><CardContent className="space-y-4 p-4"><div className="grid gap-3 md:grid-cols-4"><FilterInput placeholder="Buscar..."/><FilterSelect><option>Todos os tipos</option>{types.map(t=><option key={t}>{t}</option>)}</FilterSelect><FilterInput type="date"/><FilterInput type="date"/></div><Table><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Tipo</TableHead><TableHead>Veículo</TableHead><TableHead>Motorista</TableHead><TableHead>Valor</TableHead><TableHead>Observação</TableHead></TableRow></TableHeader><TableBody>{travelExpenses.map((item)=>{const vehicle=getVehicle(item.vehicleId); const driver=getDriver(item.driverId);return <TableRow key={item.id}><TableCell>{dateTime(item.date)}</TableCell><TableCell>{item.type}</TableCell><TableCell>{vehicle?.plate}</TableCell><TableCell>{driver?.name}</TableCell><TableCell>{brl(item.value)}</TableCell><TableCell>{item.notes}</TableCell></TableRow>})}</TableBody></Table></CardContent></Card></>
}
