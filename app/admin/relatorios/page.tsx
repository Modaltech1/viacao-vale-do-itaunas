import { redirect } from 'next/navigation'
import { ExecutiveReportsPage } from '@/components/reports/executive-reports-page'
import { requireAdmin } from '@/lib/supabase-server'

export default async function ReportsPage() {
  const auth = await requireAdmin()
  if (!auth.ok) redirect('/login')

  return <ExecutiveReportsPage />
}
