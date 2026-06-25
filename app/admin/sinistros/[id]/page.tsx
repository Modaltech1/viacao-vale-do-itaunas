import { SinisterDetailsPage } from '@/components/sinisters/sinister-details-page'

export default async function AdminSinisterDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <SinisterDetailsPage sinisterId={id} />
}
