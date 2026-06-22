import { useState } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { KmInput } from '@/components/shared/km-input'

afterEach(cleanup)

function Harness({ initialValue = '' }: { initialValue?: string }) {
  const [value, setValue] = useState(initialValue)
  return (
    <KmInput
      id="km"
      value={value}
      onValueChange={setValue}
      required
    />
  )
}

describe('entrada compartilhada de quilometragem', () => {
  it('corrige a digitação para ponto e limita a uma casa decimal', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    const input = screen.getByRole('textbox')
    await user.type(input, '1000,29')

    expect(input).toHaveValue('1000.2')
    expect(input).toHaveAttribute('inputmode', 'decimal')
    expect(input).toHaveAttribute('pattern', '[0-9]+\\.[0-9]')
  })

  it('completa o décimo ao sair do campo', async () => {
    const user = userEvent.setup()
    render(<Harness initialValue="34567" />)

    const input = screen.getByRole('textbox')
    await user.click(input)
    await user.tab()

    expect(input).toHaveValue('34567.0')
  })
})
