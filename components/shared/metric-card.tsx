'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@prodexy/ui'
import { Activity, type LucideIcon } from 'lucide-react'

type Props = {
  title: string
  value: string | number
  subtitle?: string
  icon?: LucideIcon
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'blue'
}

const toneClass = {
  default: 'text-foreground',
  success: 'text-emerald-700',
  warning: 'text-amber-700',
  danger: 'text-red-700',
  blue: 'text-primary',
}

export function MetricCard({ title, value, subtitle, icon: Icon, tone = 'default' }: Props) {
  const MetricIcon = Icon ?? Activity

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <MetricIcon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold leading-tight break-words ${toneClass[tone]}`}>{value}</div>
        {subtitle ? <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p> : null}
      </CardContent>
    </Card>
  )
}
