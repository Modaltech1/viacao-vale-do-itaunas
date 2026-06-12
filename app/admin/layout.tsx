import { redirect } from 'next/navigation'
import { AdminShell } from '@/components/layout/admin-shell'
import { requireAdmin } from '@/lib/supabase-server'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireAdmin()
  if (!auth.ok) redirect('/login')

  return (
    <AdminShell isGlobalAdmin={auth.admin.isGlobal}>
      {children}
    </AdminShell>
  )
}
