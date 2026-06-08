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
} from '@prodexy/ui'
import { Edit3 } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { MechanicDialog } from '@/components/mechanics/mechanic-dialog'
import { MetricCard } from '@/components/shared/metric-card'
import { Section } from '@/components/shared/section'
import { StatusBadge } from '@/components/shared/status-badge'
import { brl, dateTime } from '@/lib/format'
import type { MechanicDetails } from '@/types/mechanic'

export function MechanicDetailsPage({ mechanicId }: { mechanicId: string }) {
  const [mechanic, setMechanic] = useState<MechanicDetails | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadMechanic = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/admin/mecanicos/${mechanicId}`, { cache: 'no-store' })
      const result = await response.json()

      if (!response.ok) throw new Error(result.error || 'Não foi possível carregar o mecânico.')

      setMechanic(result.mechanic)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar o mecânico.')
    } finally {
      setLoading(false)
    }
  }, [mechanicId])

  useEffect(() => {
    void loadMechanic()
  }, [loadMechanic])

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Carregando mecânico...
        </CardContent>
      </Card>
    )
  }

  if (error || !mechanic) {
    return (
      <Card>
        <CardContent className="space-y-4 p-8 text-center">
          <p className="text-destructive">{error || 'Mecânico não encontrado.'}</p>
          <Button variant="outline" asChild>
            <Link href="/admin/mecanicos">Voltar para mecânicos</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <PageHeader
        title={mechanic.name}
        description="Detalhes do acesso, cadastro profissional e histórico de manutenções."
      >
        <Button variant="outline" className="gap-2" onClick={() => setEditOpen(true)}>
          <Edit3 className="size-4" />
          Editar mecânico
        </Button>
      </PageHeader>

      <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Manutenções" value={mechanic.maintenancesCount} />
        <MetricCard title="Abertas" value={mechanic.openMaintenancesCount} tone="warning" />
        <MetricCard title="Concluídas" value={mechanic.completedMaintenancesCount} tone="success" />
        <MetricCard title="Custo em peças" value={brl(mechanic.totalValue)} />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cadastro</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4 border-b pb-3">
              <span className="text-muted-foreground">Acesso</span>
              <StatusBadge
                type="raw"
                value={mechanic.accessActive ? 'ativo' : 'inativo'}
                label={mechanic.accessActive ? 'Ativo' : 'Inativo'}
              />
            </div>
            <p><b>Email:</b> {mechanic.email}</p>
            <p><b>Telefone:</b> {mechanic.phone || 'Não informado'}</p>
            <p><b>Especialidade:</b> {mechanic.specialty}</p>
            <p><b>Status profissional:</b> {mechanic.professionalStatus === 'ativo' ? 'Ativo' : 'Inativo'}</p>
            {mechanic.notes ? <p><b>Observações:</b> {mechanic.notes}</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumo operacional</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p><b>Responsável ou apoio em:</b> {mechanic.maintenancesCount} manutenções</p>
            <p><b>Em execução:</b> {mechanic.openMaintenancesCount}</p>
            <p><b>Finalizadas:</b> {mechanic.completedMaintenancesCount}</p>
            <p><b>Custo acumulado em peças:</b> {brl(mechanic.totalValue)}</p>
          </CardContent>
        </Card>
      </div>

      <Section
        title="Histórico de manutenções"
        description="Registros em que o mecânico atua como responsável ou apoio."
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Veículo</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Causa</TableHead>
              <TableHead>Aberta em</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {mechanic.maintenances.length ? mechanic.maintenances.map((maintenance) => (
              <TableRow key={maintenance.id}>
                <TableCell className="font-semibold">{maintenance.vehicle}</TableCell>
                <TableCell>{maintenance.maintenanceType === 'preventiva' ? 'Preventiva' : 'Corretiva'}</TableCell>
                <TableCell>{maintenance.cause || 'Não informada'}</TableCell>
                <TableCell>{dateTime(maintenance.openedAt)}</TableCell>
                <TableCell>{maintenance.role === 'responsavel' ? 'Responsável' : 'Apoio'}</TableCell>
                <TableCell>{brl(maintenance.value)}</TableCell>
                <TableCell><StatusBadge type="maintenance" value={maintenance.status} /></TableCell>
                <TableCell className="text-right">
                  <Button variant="link" asChild>
                    <Link href={`/admin/manutencoes/${maintenance.id}`}>Detalhes →</Link>
                  </Button>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  Nenhuma manutenção registrada para este mecânico.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Section>

      <MechanicDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mechanic={mechanic}
        onSaved={loadMechanic}
      />
    </>
  )
}
