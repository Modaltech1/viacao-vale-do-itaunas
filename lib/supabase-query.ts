import 'server-only'

export type DatabaseRow = Record<string, any>

export async function queryRows(
  query: PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
) {
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as DatabaseRow[]
}
