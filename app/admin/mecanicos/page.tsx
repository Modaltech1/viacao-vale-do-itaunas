'use client'

import { Button, Card, CardContent, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@prodexy/ui'
import { PageHeader } from '@/components/layout/page-header'
import { FilterInput, FilterSelect } from '@/components/shared/filters'
import { MetricCard } from '@/components/shared/metric-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { brl } from '@/lib/format'
import { mechanics } from '@/lib/mock-data'
import { mechanicMaintenances } from '@/lib/selectors'

export default function MechanicsPage() {
  return (
    <>
      <PageHeader title="Mecânicos" description="Responsáveis pelos registros de manutenção e acompanhamento de pendências.">
        <Button>Novo mecânico</Button>
      </PageHeader>

      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <MetricCard title="Total" value={mechanics.length} />
        <MetricCard title="Ativos" value={mechanics.filter((mechanic) => mechanic.status === 'ativo').length} />
        <MetricCard
          title="Manutenções abertas"
          value={mechanics.reduce(
            (total, mechanic) => total + mechanicMaintenances(mechanic.id).filter((item) => item.status !== 'concluida').length,
            0,
          )}
        />
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <FilterInput placeholder="Buscar mecânico..." />
            <FilterSelect>
              <option>Todos os status</option>
              <option>Ativo</option>
              <option>Inativo</option>
            </FilterSelect>
            <FilterSelect>
              <option>Todas as especialidades</option>
              <option>Motor e câmbio</option>
              <option>Freios e suspensão</option>
              <option>Elétrica e pneus</option>
            </FilterSelect>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Especialidade</TableHead>
                <TableHead>Manutenções</TableHead>
                <TableHead>Valor lançado</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mechanics.map((mechanic) => {
                const list = mechanicMaintenances(mechanic.id)

                return (
                  <TableRow key={mechanic.id}>
                    <TableCell className="font-semibold">{mechanic.name}</TableCell>
                    <TableCell>{mechanic.phone}</TableCell>
                    <TableCell>{mechanic.specialty}</TableCell>
                    <TableCell>{list.length}</TableCell>
                    <TableCell>{brl(list.reduce((total, maintenance) => total + maintenance.value, 0))}</TableCell>
                    <TableCell>
                      <StatusBadge type="raw" value={mechanic.status} label={mechanic.status === 'ativo' ? 'Ativo' : 'Inativo'} />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  )
}
