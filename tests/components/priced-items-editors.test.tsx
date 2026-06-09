import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ServiceUsageEditor } from '@/components/maintenances/service-usage-editor'
import { PartUsageEditor } from '@/components/parts/part-usage-editor'
import type { MaintenanceServiceFormValue } from '@/types/maintenance'
import type { PartUsageFormValue } from '@/types/part'

const services = [
  {
    id: 'service-1',
    name: 'Revisão de freios',
    category: 'Freios' as const,
    suggestedMaintenanceType: 'preventiva' as const,
    defaultValue: 180,
  },
  {
    id: 'service-2',
    name: 'Reparo elétrico',
    category: 'Elétrica' as const,
    suggestedMaintenanceType: 'corretiva' as const,
    defaultValue: 250,
  },
]

const parts = [
  {
    id: 'part-1',
    code: 'FLT-001',
    name: 'Filtro',
    unit: 'unidade',
    stockQuantity: 8,
    unitValue: 50,
  },
  {
    id: 'part-2',
    code: 'OLE-001',
    name: 'Óleo',
    unit: 'litro',
    stockQuantity: 20,
    unitValue: 30,
  },
]

function ServiceHarness() {
  const [value, setValue] = useState<MaintenanceServiceFormValue[]>([])
  return (
    <ServiceUsageEditor
      options={services}
      maintenanceType="preventiva"
      value={value}
      onChange={setValue}
    />
  )
}

function PartHarness() {
  const [value, setValue] = useState<PartUsageFormValue[]>([])
  return (
    <PartUsageEditor
      options={parts}
      value={value}
      onChange={setValue}
      description="Itens consumidos"
      emptyMessage="Nenhuma peça"
      totalLabel="Total em peças"
    />
  )
}

describe('editores de itens precificados', () => {
  it('adiciona serviço com valor padrão, permite editar e remover', async () => {
    const user = userEvent.setup()
    render(<ServiceHarness />)

    expect(screen.getByText('Nenhum serviço adicionado a esta manutenção.')).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Reparo elétrico/ })).not.toBeInTheDocument()

    await user.selectOptions(screen.getByRole('combobox'), 'service-1')
    await user.click(screen.getByRole('button', { name: 'Adicionar' }))

    const valueInput = screen.getByLabelText('Valor aplicado')
    expect(valueInput).toHaveValue(180)
    expect(screen.getByText('R$ 180,00')).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Revisão de freios/ })).not.toBeInTheDocument()

    await user.clear(valueInput)
    await user.type(valueInput, '215.50')
    expect(screen.getByText('R$ 215,50')).toBeInTheDocument()

    await user.click(screen.getByTitle('Remover serviço'))
    expect(screen.getByText('Nenhum serviço adicionado a esta manutenção.')).toBeInTheDocument()
    expect(screen.getByText('R$ 0,00')).toBeInTheDocument()
  })

  it('adiciona peça, aplica regras de quantidade e recalcula o total', async () => {
    const user = userEvent.setup()
    render(<PartHarness />)

    await user.selectOptions(screen.getByRole('combobox'), 'part-1')
    await user.click(screen.getByRole('button', { name: 'Adicionar' }))

    const quantityInput = screen.getByLabelText('Quantidade')
    const valueInput = screen.getByLabelText('Valor unitário')
    expect(quantityInput).toHaveAttribute('step', '1')
    expect(valueInput).toHaveValue(50)

    await user.clear(quantityInput)
    await user.type(quantityInput, '3')
    expect(screen.getAllByText('R$ 150,00')).toHaveLength(2)

    await user.click(screen.getByTitle('Remover peça'))
    await user.selectOptions(screen.getByRole('combobox'), 'part-2')
    await user.click(screen.getByRole('button', { name: 'Adicionar' }))

    expect(screen.getByLabelText('Quantidade')).toHaveAttribute('step', '0.001')
    await user.clear(screen.getByLabelText('Quantidade'))
    await user.type(screen.getByLabelText('Quantidade'), '1.5')
    expect(screen.getAllByText('R$ 45,00')).toHaveLength(2)
  })
})
