import { VehicleDetailsPage } from '@/components/vehicles/vehicle-details-page'

export default async function MechanicVehicleDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <VehicleDetailsPage vehicleId={id} mode="mechanic" />
}
