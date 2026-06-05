import { MechanicDetailsPage } from '@/components/mechanics/mechanic-details-page'

export default async function MechanicDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <MechanicDetailsPage mechanicId={id} />
}
