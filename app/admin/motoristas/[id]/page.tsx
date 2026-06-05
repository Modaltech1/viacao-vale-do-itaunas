import { DriverDetailsPage } from '@/components/drivers/driver-details-page'

export default async function DriverDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <DriverDetailsPage driverId={id} />
}
