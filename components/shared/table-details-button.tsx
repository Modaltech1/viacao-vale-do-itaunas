'use client'

import Link from 'next/link'
import { Button } from '@prodexy/ui'
import { Eye } from 'lucide-react'

export function TableDetailsButton({
  href,
  label = 'Ver detalhes',
}: {
  href: string
  label?: string
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="size-9 p-0"
      asChild
    >
      <Link href={href} aria-label={label} title={label}>
        <Eye className="size-4" aria-hidden="true" />
        <span className="sr-only">{label}</span>
      </Link>
    </Button>
  )
}
