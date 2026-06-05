export function ProgressBar({ value, max = 100 }: { value: number; max?: number }) {
  const width = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div className="h-2 w-full rounded-full bg-muted">
      <div className="h-2 rounded-full bg-primary" style={{ width: `${width}%` }} />
    </div>
  )
}
