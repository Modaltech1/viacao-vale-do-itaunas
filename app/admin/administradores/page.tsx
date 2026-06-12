import { redirect } from 'next/navigation'
import { AdminManagementPage } from '@/components/admins/admin-management-page'
import { requireGlobalAdmin } from '@/lib/supabase-server'

export default async function AdministratorsPage() {
  const auth = await requireGlobalAdmin()
  if (!auth.ok) redirect('/admin/dashboard')

  return <AdminManagementPage />
}
