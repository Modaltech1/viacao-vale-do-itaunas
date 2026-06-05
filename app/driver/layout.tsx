import { DriverShell } from '@/components/layout/admin-shell'

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  return <DriverShell>{children}</DriverShell>
}
