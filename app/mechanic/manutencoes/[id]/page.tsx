import { MaintenanceDetailsPage } from '@/components/maintenances/maintenance-details-page'

export default async function MechanicMaintenanceDetailsRoute({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <MaintenanceDetailsPage maintenanceId={id} mode="mechanic" />
}
