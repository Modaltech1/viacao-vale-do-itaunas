'use client'

import * as React from 'react'
import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, cn } from '@prodexy/ui'

type FilterSelectProps = {
  children: React.ReactNode
  className?: string
  defaultValue?: string
  disabled?: boolean
  onValueChange?: (value: string) => void
  placeholder?: string
  value?: string
}

type OptionItem = {
  disabled?: boolean
  label: React.ReactNode
  value: string
}

export function FilterInput(props: React.ComponentProps<'input'>) {
  return <Input {...props} />
}

export function FilterSelect({
  children,
  className,
  defaultValue,
  disabled,
  onValueChange,
  placeholder,
  value,
}: FilterSelectProps) {
  const options = toOptions(children)
  const initialValue = defaultValue ?? (!value ? options[0]?.value : undefined)

  return (
    <Select value={value} defaultValue={initialValue} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={cn('w-full min-w-0', className)}>
        <SelectValue placeholder={placeholder ?? String(options[0]?.label ?? 'Selecione')} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function toOptions(children: React.ReactNode) {
  return React.Children.toArray(children).flatMap((child, index): OptionItem[] => {
    if (!React.isValidElement(child)) return []

    const props = child.props as {
      children?: React.ReactNode
      disabled?: boolean
      value?: string | number
    }
    const label = props.children ?? props.value ?? `Opção ${index + 1}`
    const value = props.value != null ? String(props.value) : textFromNode(label)

    return [{ disabled: props.disabled, label, value }]
  })
}

function textFromNode(node: React.ReactNode) {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  return 'option'
}
