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
    const expectedGuard = relative.startsWith('admin/administradores')
      ? 'requireGlobalAdmin'
      : relative.startsWith('admin/')
        ? 'requireAdmin'
        : relative.startsWith('driver/')
          ? 'requireDriver'
          : 'requireMechanic'

    assert.match(source, new RegExp(`\\b${expectedGuard}\\b`), `${relative} sem ${expectedGuard}`)
  }
})

test('rotas privilegiadas validam escopo antes de usar service role', async () => {
  const guardedRoutes = [
    'app/api/admin/veiculos/route.ts',
    'app/api/admin/veiculos/[id]/route.ts',
    'app/api/admin/motoristas/route.ts',
    'app/api/admin/motoristas/[id]/route.ts',
    'app/api/admin/abastecimentos/route.ts',
    'app/api/admin/abastecimentos/[id]/route.ts',
    'app/api/admin/viagens/[id]/route.ts',
  ]

  for (const file of guardedRoutes) {
    const source = await readFile(path.join(root, file), 'utf8')
    assert.match(
      source,
      /assertAdmin(?:Vehicle|Driver|Trip)Access/,
      `${file} usa service role sem validar o escopo administrativo`,
    )
  }
})

test('gestão de administradores é exclusiva do global e aparece condicionalmente no menu', async () => {
  const [layout, navigation, shell, route, assignmentRoute] = await Promise.all([
    readFile(path.join(root, 'app', 'admin', 'layout.tsx'), 'utf8'),
    readFile(path.join(root, 'components', 'layout', 'navigation-items.ts'), 'utf8'),
    readFile(path.join(root, 'components', 'layout', 'admin-shell.tsx'), 'utf8'),
    readFile(path.join(root, 'app', 'api', 'admin', 'administradores', 'route.ts'), 'utf8'),
    readFile(
      path.join(
        root,
        'app',
        'api',
        'admin',
        'administradores',
        'atribuicoes',
        'route.ts',
      ),
      'utf8',
    ),
  ])

  assert.match(layout, /auth\.admin\.isGlobal/)
  assert.match(navigation, /globalOnly:\s*true/)
  assert.match(shell, /!item\.globalOnly \|\| isGlobalAdmin/)
  assert.match(route, /requireGlobalAdmin/)
  assert.match(assignmentRoute, /transferAdminResource\(\s*auth\.supabase/)
  assert.doesNotMatch(assignmentRoute, /createSupabaseServiceClient/)
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

test('todas as tabelas usam paginação compartilhada de dez registros', async () => {
  const pagination = await readFile(
    path.join(root, 'components', 'shared', 'table-pagination.tsx'),
    'utf8',
  )
  assert.match(pagination, /TABLE_PAGE_SIZE\s*=\s*10\b/)

  const files = (await Promise.all(
    ['app', 'components'].map((directory) => filesRecursively(path.join(root, directory))),
  )).flat().filter((file) => file.endsWith('.tsx'))

  for (const file of files) {
    const source = await readFile(file, 'utf8')
    const tableCount = source.match(/<Table(?:\s|>)/g)?.length ?? 0
    if (!tableCount) continue

    const paginationCount = source.match(/<TablePagination(?:\s|>)/g)?.length ?? 0
    assert.equal(
      paginationCount,
      tableCount,
      `${path.relative(root, file)} deve paginar cada tabela`,
    )
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
    'fn_criar_manutencao_concluida',
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
    'codigo_frota text not null',
    'veiculos_codigo_frota_normalizado_uniq',
    'veiculo_codigo_frota',
    'veiculos_placa_normalizada_uniq',
    'nivel_admin text',
    'admin_responsavel_id uuid',
    'eh_admin_global',
    'admin_pode_acessar_veiculo',
    'admin_pode_acessar_motorista',
    'validar_escopo_operacao_veiculo',
    'fn_transferir_responsabilidade_admin',
    'veiculos_permitidos',
    'motoristas_permitidos',
    'auditoria_select_global',
  ]

  for (const fragment of requiredFragments) {
    assert.ok(schema.includes(fragment), `Invariante ausente: ${fragment}`)
  }
})

test('migration de responsabilidade administrativa cobre RLS e dashboard', async () => {
  const migration = await readFile(
    path.join(
      root,
      'database',
      'migrations',
      '20260612_admin_data_ownership.sql',
    ),
    'utf8',
  )
  const requiredFragments = [
    "nivel_admin in ('global', 'restrito')",
    'veiculos_admin_responsavel_idx',
    'motoristas_admin_responsavel_idx',
    'perfil_visivel_para_usuario',
    'veiculos_select_por_contexto',
    'motoristas_select_por_contexto',
    'viagens_select_contexto',
    'despesas_select_contexto',
    'manutencoes_select_contexto',
    'pendencias_manuais_select_contexto',
    'fn_dashboard_admin',
  ]

  for (const fragment of requiredFragments) {
    assert.ok(migration.includes(fragment), `Migration sem ${fragment}`)
  }
})

test('transferência administrativa percorre e atualiza todo o grafo ativo', async () => {
  const migration = await readFile(
    path.join(
      root,
      'database',
      'migrations',
      '20260612_transfer_admin_responsibility_graph.sql',
    ),
    'utf8',
  )
  const requiredFragments = [
    'fn_transferir_responsabilidade_admin',
    'with recursive componentes',
    'vm.ativo = true',
    'vm.fim_em is null',
    'update public.veiculos',
    'update public.motoristas',
    'update public.pendencias_manuais',
    'public.eh_admin_global()',
    'to authenticated',
  ]

  for (const fragment of requiredFragments) {
    assert.ok(migration.includes(fragment), `Migration sem ${fragment}`)
  }
})

test('migration de código de frota preserva compatibilidade e troca labels operacionais', async () => {
  const migration = await readFile(
    path.join(
      root,
      'database',
      'migrations',
      '20260616_vehicle_fleet_code.sql',
    ),
    'utf8',
  )
  const requiredFragments = [
    'add column if not exists codigo_frota',
    'set codigo_frota = placa',
    'veiculos_codigo_frota_normalizado_uniq',
    'v.codigo_frota as veiculo_codigo_frota',
    'coalesce(p.veiculo_codigo_frota, p.veiculo_placa)',
    'coalesce(v.codigo_frota, v.placa)',
    'grant select on',
  ]

  for (const fragment of requiredFragments) {
    assert.ok(migration.includes(fragment), `Migration sem ${fragment}`)
  }
})
