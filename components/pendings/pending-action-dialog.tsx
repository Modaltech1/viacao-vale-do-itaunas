'use client'

import { useEffect, useState } from 'react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Textarea,
} from '@prodexy/ui'
import type { PendingListItem } from '@/types/pending'

export type PendingUiAction = 'reconhecida' | 'comentario' | 'resolvida_manual' | 'cancelada'

const actionContent = {
  reconhecida: {
    title: 'Reconhecer pendência',
    description: 'Registra que a equipe tomou ciência. A causa calculada continuará ativa até ser corrigida.',
    confirm: 'Reconhecer',
  },
  comentario: {
    title: 'Adicionar comentário',
    description: 'Registre uma observação operacional no histórico da pendência.',
    confirm: 'Adicionar comentário',
  },
  resolvida_manual: {
    title: 'Resolver pendência',
    description: 'Encerra esta pendência manual preservando seu histórico.',
    confirm: 'Resolver pendência',
  },
  cancelada: {
    title: 'Cancelar pendência',
    description: 'Cancela esta pendência manual sem removê-la do histórico.',
    confirm: 'Cancelar pendência',
  },
} as const

export function PendingActionDialog({
  item,
  action,
  open,
  onOpenChange,
  mode,
  onSaved,
}: {
  item: PendingListItem | null
  action: PendingUiAction
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'admin' | 'mechanic'
  onSaved: () => void | Promise<void>
}) {
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const content = actionContent[action]
  const commentRequired = action !== 'reconhecida'

  useEffect(() => {
    if (!open) return
    setComment('')
    setError('')
  }, [open, action])

  async function submit() {
    if (!item) return
    setSaving(true)
    setError('')
    try {
      const response = await fetch(`/api/${mode}/pendencias/acao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: item.key,
          origin: item.origin,
          action,
          comment,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Não foi possível atualizar a pendência.')
      await onSaved()
      onOpenChange(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível atualizar a pendência.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{content.title}</DialogTitle>
          <DialogDescription>{content.description}</DialogDescription>
        </DialogHeader>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="space-y-2">
          <Label htmlFor="pending-action-comment">
            {commentRequired ? 'Observação' : 'Observação opcional'}
          </Label>
          <Textarea
            id="pending-action-comment"
            rows={3}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Voltar</Button>
          <Button
            variant={action === 'cancelada' ? 'destructive' : 'default'}
            onClick={() => void submit()}
            disabled={saving || (commentRequired && !comment.trim())}
          >
            {saving ? 'Salvando...' : content.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
