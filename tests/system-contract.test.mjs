import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

const root = process.cwd()

async function filesRecursively(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name)
    return entry.isDirectory() ? filesRecursively(fullPath) : [fullPath]
  }))
  return nested.flat()
}

test('todas as APIs privadas usam o guard do respectivo perfil', async () => {
  const apiRoot = path.join(root, 'app', 'api')
  const routes = (await filesRecursively(apiRoot)).filter((file) => file.endsWith('route.ts'))

  for (const route of routes) {
    const source = await readFile(route, 'utf8')
    const relative = path.relative(apiRoot, route).replaceAll('\\', '/')
    const expectedGuard = relative.startsWith('admin/')
      ? 'requireAdmin'
      : relative.startsWith('driver/')
        ? 'requireDriver'
        : 'requireMechanic'

    assert.match(source, new RegExp(`\\b${expectedGuard}\\b`), `${relative} sem ${expectedGuard}`)
  }
})

test('middleware não converte erros JSON das APIs em redirect HTML', async () => {
  const middleware = await readFile(path.join(root, 'middleware.ts'), 'utf8')
  assert.match(middleware, /\(\?!api\|/, 'O matcher deve deixar autenticação das APIs para os guards.')
})

test('nenhum módulo de aplicação referencia mocks ou IDs fictícios', async () => {
  const directories = ['app', 'components', 'lib', 'types']
  const files = (await Promise.all(
    directories.map((directory) => filesRecursively(path.join(root, directory))),
  )).flat().filter((file) => /\.(ts|tsx)$/.test(file))

  for (const file of files) {
    const source = await readFile(file, 'utf8')
    assert.doesNotMatch(source, /mock-data|driver-\d+|vehicle-\d+|trip-\d+/i)
  }
})

test('schema contém as invariantes centrais dos fluxos operacionais', async () => {
  const schema = await readFile(path.join(root, 'database', 'schema.sql'), 'utf8')
  const requiredFragments = [
    'viagens_motorista_em_andamento_uniq',
    'viagens_veiculo_em_andamento_uniq',
    'fn_iniciar_viagem',
    'fn_concluir_viagem',
    'v_ultimo_km_abastecimento',
    'and cancelado_em is null',
    'Data de chegada não pode ser anterior à data de saída',
    'fn_registrar_abastecimento',
    'fn_registrar_despesa_viagem',
    'fn_concluir_manutencao',
    'create table if not exists public.pecas',
    'create table if not exists public.manutencao_pecas',
    'create table if not exists public.despesa_pecas',
    'create table if not exists public.estoque_movimentacoes',
    'fn_salvar_peca',
    'fn_salvar_despesa',
    'fn_salvar_manutencao',
    'fn_editar_manutencao_concluida',
    'fn_cancelar_manutencao',
    'validar_quantidade_peca_discreta',
    'Estoque insuficiente para a peça',
    'vw_pendencias_operacionais',
    'veiculos_placa_normalizada_uniq',
  ]

  for (const fragment of requiredFragments) {
    assert.match(schema, new RegExp(fragment), `Invariante ausente: ${fragment}`)
  }
})
