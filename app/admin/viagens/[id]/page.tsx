import { TripDetailsPage } from '@/components/trips/trip-details-page'

export default async function TripDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <TripDetailsPage tripId={id} />
}
