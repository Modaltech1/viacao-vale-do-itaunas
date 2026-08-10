import {
  Children,
  Fragment,
  isValidElement,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type ReactNode,
} from 'react'

export function Button({
  variant: _variant,
  size: _size,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) {
  return <button {...props} />
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} />
}

export function Label(props: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label {...props} />
}

export function Card(props: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} />
}

export function CardHeader(props: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} />
}

export function CardTitle(props: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 {...props} />
}

export function CardContent(props: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} />
}

export function Badge(props: HTMLAttributes<HTMLSpanElement> & { variant?: string }) {
  const { variant: _variant, ...badgeProps } = props
  return <span {...badgeProps} />
}

type SelectItemProps = {
  value: string
  children?: ReactNode
}

export function SelectItem(_props: SelectItemProps) {
  return null
}

SelectItem.isTestSelectItem = true

function collectItems(children: ReactNode, result: SelectItemProps[] = []) {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return
    if ((child.type as typeof SelectItem).isTestSelectItem) {
      result.push(child.props as SelectItemProps)
      return
    }
    collectItems((child.props as { children?: ReactNode }).children, result)
  })
  return result
}

export function Select({
  value,
  onValueChange,
  children,
}: {
  value?: string
  onValueChange?: (value: string) => void
  children?: ReactNode
}) {
  const items = collectItems(children)
  return (
    <select
      aria-label="Selecionar item"
      value={value}
      onChange={(event) => onValueChange?.(event.target.value)}
    >
      <option value="">Selecione</option>
      {items.map((item) => (
        <option key={item.value} value={item.value}>{item.children}</option>
      ))}
    </select>
  )
}

export function SelectTrigger({ children }: { children?: ReactNode }) {
  return <Fragment>{children}</Fragment>
}

export function SelectValue() {
  return null
}

export function SelectContent({ children }: { children?: ReactNode }) {
  return <Fragment>{children}</Fragment>
}
