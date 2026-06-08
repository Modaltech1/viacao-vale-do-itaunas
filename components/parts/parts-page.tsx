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
import { Boxes, CircleDollarSign, Package, PackageMinus, Pencil, Plus } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { PartDialog } from '@/components/parts/part-dialog'
import { FilterInput, FilterSelect } from '@/components/shared/filters'
import { MetricCard } from '@/components/shared/metric-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { brl, quantity } from '@/lib/format'
import { partCategories, type PartListItem } from '@/types/part'

export function PartsPage({ mode }: { mode: 'admin' | 'mechanic' }) {
  const [items, setItems] = useState<PartListItem[]>([])
  const [selectedPart, setSelectedPart] = useState<PartListItem | null>(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('todas')
  const [stock, setStock] = useState('todos')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const isAdmin = mode === 'admin'

  const loadParts = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/${mode}/pecas`, { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Não foi possível carregar as peças.')
      setItems(result.items ?? [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar as peças.')
    } finally {
      setLoading(false)
    }
  }, [mode])

  useEffect(() => {
    void loadParts()
  }, [loadParts])

  const filteredItems = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')
    return items.filter((part) => {
      const matchesSearch = !term
        || part.name.toLocaleLowerCase('pt-BR').includes(term)
        || part.code.toLocaleLowerCase('pt-BR').includes(term)
        || part.description.toLocaleLowerCase('pt-BR').includes(term)
      const matchesCategory = category === 'todas' || part.category === category
      const matchesStock = stock === 'todos'
        || (stock === 'baixo' && part.stockQuantity <= part.minimumStock && part.stockQuantity > 0)
        || (stock === 'zerado' && part.stockQuantity === 0)
        || (stock === 'normal' && part.stockQuantity > part.minimumStock)
      return matchesSearch && matchesCategory && matchesStock
    })
  }, [category, items, search, stock])

  const activeItems = items.filter((item) => item.active)
  const lowStock = activeItems.filter((item) => item.stockQuantity <= item.minimumStock)
  const stockValue = activeItems.reduce((total, item) => total + item.stockValue, 0)

  return (
    <>
      <PageHeader
        title="Peças"
        description={isAdmin
          ? 'Catálogo, custo e disponibilidade dos itens utilizados nas manutenções.'
          : 'Consulta operacional de peças, preços de referência e disponibilidade em estoque.'}
      >
        {isAdmin ? (
          <Button className="gap-2" onClick={() => {
            setSelectedPart(null)
            setDialogOpen(true)
          }}>
            <Plus className="size-4" />
            Nova peça
          </Button>
        ) : null}
      </PageHeader>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Peças ativas" value={activeItems.length} icon={Package} />
        <MetricCard
          title="Estoque baixo"
          value={lowStock.filter((item) => item.stockQuantity > 0).length}
          icon={PackageMinus}
          tone="warning"
        />
        <MetricCard
          title="Sem estoque"
          value={lowStock.filter((item) => item.stockQuantity === 0).length}
          icon={Boxes}
          tone="danger"
        />
        <MetricCard
          title="Valor em estoque"
          value={brl(stockValue)}
          icon={CircleDollarSign}
        />
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_minmax(200px,0.5fr)_minmax(200px,0.5fr)]">
            <FilterInput
              placeholder="Buscar por código, nome ou descrição..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <FilterSelect value={category} onValueChange={setCategory}>
              <option value="todas">Todas as categorias</option>
              {partCategories.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </FilterSelect>
            <FilterSelect value={stock} onValueChange={setStock}>
              <option value="todos">Todas as situações</option>
              <option value="normal">Estoque normal</option>
              <option value="baixo">Estoque baixo</option>
              <option value="zerado">Sem estoque</option>
            </FilterSelect>
          </div>

          {error ? (
            <div className="flex flex-col gap-3 border-t py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={() => void loadParts()}>
                Tentar novamente
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Peça</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Estoque</TableHead>
                  <TableHead>Valor unitário</TableHead>
                  <TableHead>Valor em estoque</TableHead>
                  <TableHead>Utilização</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin ? <TableHead /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 8 : 7} className="h-24 text-center text-muted-foreground">
                      Carregando peças...
                    </TableCell>
                  </TableRow>
                ) : filteredItems.length ? filteredItems.map((part) => {
                  const stockTone = part.stockQuantity === 0
                    ? 'critica'
                    : part.stockQuantity <= part.minimumStock
                      ? 'atencao'
                      : 'ativo'
                  return (
                    <TableRow key={part.id}>
                      <TableCell>
                        <p className="font-semibold">{part.name}</p>
                        <p className="text-xs text-muted-foreground">{part.code}</p>
                      </TableCell>
                      <TableCell>{part.category}</TableCell>
                      <TableCell>
                        <StatusBadge
                          type="raw"
                          value={stockTone}
                          label={`${quantity(part.stockQuantity, part.unit)} ${part.unit}`}
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          mínimo {quantity(part.minimumStock, part.unit)}
                        </p>
                      </TableCell>
                      <TableCell>{brl(part.unitValue)}</TableCell>
                      <TableCell>{brl(part.stockValue)}</TableCell>
                      <TableCell>
                        <p>{part.maintenanceUsesCount} manutenção(ões)</p>
                        <p className="text-xs text-muted-foreground">
                          {part.expenseUsesCount} despesa(s) avulsa(s)
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {quantity(part.consumedQuantity, part.unit)} {part.unit} consumidos
                        </p>
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          type="raw"
                          value={part.active ? 'ativo' : 'inativo'}
                          label={part.active ? 'Ativa' : 'Inativa'}
                        />
                      </TableCell>
                      {isAdmin ? (
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => {
                              setSelectedPart(part)
                              setDialogOpen(true)
                            }}
                          >
                            <Pencil className="size-4" />
                            Editar
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  )
                }) : (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 8 : 7} className="h-24 text-center text-muted-foreground">
                      Nenhuma peça encontrada.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {isAdmin ? (
        <PartDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          part={selectedPart}
          onSaved={loadParts}
        />
      ) : null}
    </>
  )
}
