import { redirect } from 'next/navigation'
import { ExecutiveReportsPage } from '@/components/reports/executive-reports-page'
import { requireGlobalAdmin } from '@/lib/supabase-server'

export default async function ReportsPage() {
  const auth = await requireGlobalAdmin()
  if (!auth.ok) redirect('/admin/dashboard')

  return <ExecutiveReportsPage />
}
