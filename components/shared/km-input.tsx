'use client'

import type { FocusEvent } from 'react'
import { Input } from '@prodexy/ui'
import { kmInputValue, normalizeKmInput } from '@/lib/km'

type KmInputProps = {
  id: string
  value: string
  onValueChange: (value: string) => void
  minValue?: number
  required?: boolean
  disabled?: boolean
  className?: string
  placeholder?: string
}

function setKmValidity(
  input: HTMLInputElement,
  value: string,
  minValue?: number,
  required?: boolean,
) {
  if (!value && !required) {
    input.setCustomValidity('')
    return
  }

  if (!value || !/^\d+\.\d$/.test(value)) {
    input.setCustomValidity('Informe o KM com um ponto e uma casa decimal, por exemplo 1000.0.')
    return
  }

  if (minValue != null && Number(value) < minValue) {
    input.setCustomValidity(`O KM deve ser maior ou igual a ${kmInputValue(minValue)}.`)
    return
  }

  input.setCustomValidity('')
}

export function KmInput({
  id,
  value,
  onValueChange,
  minValue,
  required,
  disabled,
  className,
  placeholder = '1000.0',
}: KmInputProps) {
  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    const formatted = kmInputValue(value)
    if (formatted !== value) onValueChange(formatted)
    setKmValidity(event.currentTarget, formatted, minValue, required)
  }

  return (
    <Input
      id={id}
      type="text"
      inputMode="decimal"
      pattern="[0-9]+\.[0-9]"
      title="Use apenas números, um ponto e uma casa decimal, como 1000.0"
      value={value}
      onChange={(event) => {
        const normalized = normalizeKmInput(event.target.value)
        setKmValidity(event.currentTarget, normalized, minValue, required)
        onValueChange(normalized)
      }}
      onBlur={handleBlur}
      required={required}
      disabled={disabled}
      className={className}
      placeholder={placeholder}
    />
  )
}
