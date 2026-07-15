const ptBrCollator = new Intl.Collator('pt-BR', {
  numeric: true,
  sensitivity: 'base',
})

export function compareTextPtBr(a: string | null | undefined, b: string | null | undefined) {
  return ptBrCollator.compare(a ?? '', b ?? '')
}

export function compareByTextPtBr<T>(
  left: T,
  right: T,
  ...selectors: Array<(item: T) => string | null | undefined>
) {
  for (const selector of selectors) {
    const result = compareTextPtBr(selector(left), selector(right))
    if (result !== 0) return result
  }

  return 0
}
