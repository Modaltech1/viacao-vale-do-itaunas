import assert from 'node:assert/strict'
import { access, readFile, readdir } from 'node:fs/promises'
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

test('PWA mantém instalação global sem armazenar dados privados', async () => {
  const [manifest, layout, serviceWorker, nextConfig] = await Promise.all([
    readFile(path.join(root, 'app', 'manifest.ts'), 'utf8'),
    readFile(path.join(root, 'app', 'layout.tsx'), 'utf8'),
    readFile(path.join(root, 'public', 'sw.js'), 'utf8'),
    readFile(path.join(root, 'next.config.ts'), 'utf8'),
  ])

  assert.match(manifest, /start_url:\s*['"]\/['"]/)
  assert.match(manifest, /display:\s*['"]standalone['"]/)
  assert.match(manifest, /purpose:\s*['"]maskable['"]/)
  assert.match(layout, /<ServiceWorkerRegister\s*\/>/)
  assert.match(serviceWorker, /request\.method !== ['"]GET['"]/)
  assert.match(serviceWorker, /INSTALL_ASSETS\.includes\(url\.pathname\)/)
  assert.doesNotMatch(serviceWorker, /\/api\//)
  assert.match(nextConfig, /Service-Worker-Allowed/)

  const requiredIcons = [
    'apple-touch-icon.png',
    'icon-192.png',
    'icon-512.png',
    'icon-maskable-512.png',
  ]

  for (const icon of requiredIcons) {
    await assert.doesNotReject(
      access(path.join(root, 'public', 'pwa', icon)),
      `Ícone PWA ausente: ${icon}`,
    )
  }
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

test('todas as páginas de detalhe oferecem navegação contextual de retorno', async () => {
  const detailComponents = [
    'components/drivers/driver-details-page.tsx',
    'components/mechanics/mechanic-details-page.tsx',
    'components/vehicles/vehicle-details-page.tsx',
    'components/trips/trip-details-page.tsx',
    'components/maintenances/maintenance-details-page.tsx',
  ]

  for (const file of detailComponents) {
    const source = await readFile(path.join(root, file), 'utf8')
    assert.match(source, /\bbackHref=/, `${file} sem navegação de retorno`)
    assert.match(source, /\bbackLabel=/, `${file} sem rótulo contextual de retorno`)
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
    'p_concluido_em timestamptz',
    'concluido_em = p_concluido_em',
    'valor_padrao numeric(12,2)',
    'valor_aplicado numeric(12,2)',
    'p_servicos jsonb',
    'fn_cancelar_manutencao',
    'validar_quantidade_peca_discreta',
    'Estoque insuficiente para a peça',
    'vw_pendencias_operacionais',
    'veiculos_placa_normalizada_uniq',
  ]

  for (const fragment of requiredFragments) {
    assert.ok(schema.includes(fragment), `Invariante ausente: ${fragment}`)
  }
})
