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

test('relatórios ficam disponíveis para admins e respeitam escopo restrito', async () => {
  const [navigation, page, route, repository] = await Promise.all([
    readFile(path.join(root, 'components', 'layout', 'navigation-items.ts'), 'utf8'),
    readFile(path.join(root, 'app', 'admin', 'relatorios', 'page.tsx'), 'utf8'),
    readFile(path.join(root, 'app', 'api', 'admin', 'relatorios', 'route.ts'), 'utf8'),
    readFile(path.join(root, 'lib', 'reports-repository.ts'), 'utf8'),
  ])

  assert.match(navigation, /item\('reports', '\/admin\/relatorios'\)/)
  assert.doesNotMatch(
    navigation,
    /\.\.\.item\('reports', '\/admin\/relatorios'\),\s*globalOnly:\s*true/s,
  )
  assert.match(page, /requireAdmin\(\)/)
  assert.doesNotMatch(page, /requireGlobalAdmin/)
  assert.match(route, /requireAdmin\(\)/)
  assert.match(route, /getReportData\(auth\.supabase,\s*auth\.admin,/)
  assert.doesNotMatch(route, /requireGlobalAdmin/)
  assert.match(repository, /access:\s*AdminAccess/)
  assert.match(repository, /admin_responsavel_id/)
  assert.match(repository, /access\.isGlobal/)
})

test('middleware não converte erros JSON das APIs em redirect HTML', async () => {
  const middleware = await readFile(path.join(root, 'middleware.ts'), 'utf8')
  assert.match(middleware, /\(\?!api\|/, 'O matcher deve deixar autenticação das APIs para os guards.')
})

test('política de privacidade permanece pública com ou sem sessão', async () => {
  const [middleware, page] = await Promise.all([
    readFile(path.join(root, 'middleware.ts'), 'utf8'),
    readFile(path.join(root, 'app', 'politica-de-privacidade', 'page.tsx'), 'utf8'),
  ])

  assert.match(middleware, /publicPaths\s*=\s*\[['"]\/politica-de-privacidade['"]\]/)
  assert.match(middleware, /if \(isPublicPath\(request\.nextUrl\.pathname\)\) return response/)
  assert.match(page, /Política de Privacidade/)
  assert.match(page, /com\.prodexylabs\.valedoitaunas\.motoristas/)
  assert.match(page, /não solicita acesso à localização precisa, câmera, microfone ou lista de contatos/)
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
    'components/sinisters/sinister-details-page.tsx',
  ]

  for (const file of detailComponents) {
    const source = await readFile(path.join(root, file), 'utf8')
    assert.match(source, /\bbackHref=/, `${file} sem navegação de retorno`)
    assert.match(source, /\bbackLabel=/, `${file} sem rótulo contextual de retorno`)
  }
})

test('tabelas cadastrais mantem ordenacao alfabetica apos filtros', async () => {
  const files = [
    'app/admin/motoristas/page.tsx',
    'app/admin/mecanicos/page.tsx',
    'components/vehicles/vehicles-page.tsx',
    'app/admin/servicos/page.tsx',
    'app/mechanic/servicos/page.tsx',
    'components/parts/parts-page.tsx',
    'components/admins/admin-management-page.tsx',
    'lib/drivers-repository.ts',
    'lib/mechanics-repository.ts',
  ]

  for (const file of files) {
    const source = await readFile(path.join(root, file), 'utf8')
    assert.match(source, /compareByTextPtBr/, `${file} sem ordenacao textual compartilhada`)
  }
})

test('todas as tabelas usam paginação compartilhada de dez registros', async () => {
  const pagination = await readFile(
    path.join(root, 'components', 'shared', 'table-pagination.tsx'),
    'utf8',
  )
  assert.match(pagination, /TABLE_PAGE_SIZE\s*=\s*10\b/)
  assert.doesNotMatch(pagination, /if\s*\(totalItems\s*<=\s*pageSize\)\s*return null/)
  assert.match(pagination, /totalItems\s*\?[^:]+:\s*'0 de 0'/)

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

  const pendings = await readFile(
    path.join(root, 'components', 'pendings', 'pendings-page.tsx'),
    'utf8',
  )
  assert.match(pendings, /useTablePagination/)
  assert.match(pendings, /<PaginationFooter(?:\s|>)/)
})

test('ações de detalhe em tabelas usam botão iconográfico compartilhado', async () => {
  const detailsButton = await readFile(
    path.join(root, 'components', 'shared', 'table-details-button.tsx'),
    'utf8',
  )
  assert.match(detailsButton, /Eye/)
  assert.match(detailsButton, /aria-label/)
  assert.match(detailsButton, /sr-only/)

  const detailActionFiles = [
    'app/admin/despesas/page.tsx',
    'app/admin/mecanicos/page.tsx',
    'app/admin/motoristas/page.tsx',
    'app/admin/viagens/page.tsx',
    'components/maintenances/maintenances-page.tsx',
    'components/mechanics/mechanic-details-page.tsx',
    'app/admin/sinistros/page.tsx',
    'components/vehicles/vehicle-details-page.tsx',
    'components/vehicles/vehicles-page.tsx',
  ]

  for (const file of detailActionFiles) {
    const source = await readFile(path.join(root, file), 'utf8')
    assert.match(source, /TableDetailsButton/, `${file} não usa o botão de detalhes compartilhado`)
    assert.doesNotMatch(source, />\s*Detalhes\s*(?:→)?\s*</, `${file} ainda usa texto de detalhes na tabela`)
    assert.doesNotMatch(source, /variant="link"/, `${file} ainda usa link textual como ação de tabela`)
  }
})

test('schema contém as invariantes centrais dos fluxos operacionais', async () => {
  const schema = await readFile(path.join(root, 'database', 'schema.sql'), 'utf8')
  const requiredFragments = [
    'viagens_motorista_em_andamento_uniq',
    'viagens_veiculo_em_andamento_uniq',
    'fn_iniciar_viagem',
    'fn_concluir_viagem',
    'validar_distancia_positiva_viagem',
    'fn_corrigir_viagem_concluida',
    'fn_remover_viagem',
    'fn_km_referencia_atual_veiculo',
    'fn_corrigir_km_atual_veiculo',
    'v_ultimo_km_abastecimento',
    'and cancelado_em is null',
    "app.permitir_correcao_km_veiculo",
    'Somente a ultima viagem do veiculo pode ter KM final corrigido',
    'admin_pode_acessar_veiculo(v_viagem_antes.veiculo_id)',
    'Data de chegada nao pode ser anterior ao ultimo abastecimento da viagem',
    'corrigir_km_final',
    'corrigir_km_atual',
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
    'fn_recalcular_programacao_servico_veiculo',
    'fn_remover_manutencao',
    'fn_cancelar_manutencao',
    'validar_quantidade_peca_discreta',
    'Estoque insuficiente para a peça',
    'vw_pendencias_operacionais',
    'codigo_frota text not null',
    'veiculos_codigo_frota_normalizado_idx',
    'veiculo_codigo_frota',
    'veiculos_placa_normalizada_uniq',
    'nivel_admin text',
    'admin_responsavel_id uuid',
    'eh_admin_global',
    'admin_pode_acessar_veiculo',
    'admin_pode_acessar_motorista',
    'admin_pode_acessar_peca',
    'peca_compativel_com_veiculo',
    'validar_escopo_operacao_veiculo',
    'validar_escopo_peca',
    'validar_escopo_consumo_peca',
    'pecas_admin_responsavel_idx',
    'pecas_admin_codigo_normalizado_uniq',
    'fn_transferir_responsabilidade_admin',
    'veiculos_permitidos',
    'motoristas_permitidos',
    'auditoria_select_global',
    "('aet', 'AET', 30)",
    'create table if not exists public.sinistros_operacionais',
    'create table if not exists public.sinistro_custos',
    'fn_salvar_sinistro',
    'sinistros_validar_escopo_trg',
    'sinistros_select_contexto',
    'sinistro_custos_select_contexto',
  ]

  for (const fragment of requiredFragments) {
    assert.ok(schema.includes(fragment), `Invariante ausente: ${fragment}`)
  }

  assert.doesNotMatch(
    schema,
    /create\s+unique\s+index[^\r\n]*(?:\r?\n\s+[^\r\n]*){0,2}\r?\n\s+on public\.veiculos\(codigo_frota_normalizado\)/i,
    'Frota nao pode ser tratada como identificador unico do veiculo',
  )
})

test('viagens concluídas exigem distância estritamente positiva em toda a stack', async () => {
  const [migration, driverDialog, adminDialog, kmRules] = await Promise.all([
    readFile(
      path.join(root, 'database', 'migrations', '20260619_require_positive_trip_distance.sql'),
      'utf8',
    ),
    readFile(path.join(root, 'components', 'driver', 'driver-operation-dialogs.tsx'), 'utf8'),
    readFile(path.join(root, 'components', 'trips', 'trip-dialogs.tsx'), 'utf8'),
    readFile(path.join(root, 'lib', 'trip-km.ts'), 'utf8'),
  ])

  for (const fragment of [
    'viagens_km_final_check',
    'km_final > km_inicial',
    'validar_distancia_positiva_viagem',
    'new.km_final <= new.km_inicial',
    'KM final deve ser maior que o KM inicial da viagem',
  ]) {
    assert.ok(migration.includes(fragment), `Migration de distância positiva sem ${fragment}`)
  }

  assert.match(driverDialog, /tripFinalKmMinimum/)
  assert.match(driverDialog, /tripFinalKmSuggestion/)
  assert.match(adminDialog, /tripFinalKmMinimum/)
  assert.match(adminDialog, /tripFinalKmSuggestion/)
  assert.match(kmRules, /latestRecordedKm > initialKm/)
})

test('quilometragem usa décimos sem agrupamento em toda a stack', async () => {
  const [migration, schema, kmRules, kmInput] = await Promise.all([
    readFile(
      path.join(root, 'database', 'migrations', '20260622_km_tenths_precision.sql'),
      'utf8',
    ),
    readFile(path.join(root, 'database', 'schema.sql'), 'utf8'),
    readFile(path.join(root, 'lib', 'km.ts'), 'utf8'),
    readFile(path.join(root, 'components', 'shared', 'km-input.tsx'), 'utf8'),
  ])

  for (const fragment of [
    'rotas_km_estimado_decimos_check',
    'veiculos_km_atual_decimos_check',
    'servicos_periodicidade_km_decimos_check',
    'veiculo_servico_programacoes_km_decimos_check',
    'viagens_km_decimos_check',
    'abastecimentos_km_decimos_check',
    'manutencoes_km_decimos_check',
    'pendencias_manuais_km_decimos_check',
  ]) {
    assert.ok(migration.includes(fragment), `Migration de KM sem ${fragment}`)
    assert.ok(schema.includes(fragment), `Schema de KM sem ${fragment}`)
  }

  assert.match(kmRules, /value\.toFixed\(fractionDigits\)/)
  assert.doesNotMatch(kmRules, /toLocaleString/)
  assert.match(kmRules, /\^\\d\+\\\.\\d\$/)
  assert.match(kmInput, /inputMode="decimal"/)
  assert.match(kmInput, /normalizeKmInput/)
  assert.match(kmInput, /pattern="\[0-9\]\+\\\.\[0-9\]"/)

  const formFiles = [
    'app/driver/page.tsx',
    'components/driver/driver-operation-dialogs.tsx',
    'components/maintenances/maintenance-dialog.tsx',
    'components/pendings/pending-dialog.tsx',
    'components/refuelings/refueling-dialog.tsx',
    'components/services/service-dialog.tsx',
    'components/trips/trip-dialogs.tsx',
    'components/vehicles/vehicle-dialog.tsx',
  ]
  for (const file of formFiles) {
    const source = await readFile(path.join(root, file), 'utf8')
    assert.match(source, /<KmInput\b/, `${file} não usa a entrada compartilhada de KM`)
  }

  const serviceFiles = [
    'lib/driver-portal-service.ts',
    'lib/maintenances-service.ts',
    'lib/pendings-service.ts',
    'lib/refuelings-service.ts',
    'lib/services-service.ts',
    'lib/trips-service.ts',
    'lib/vehicles-service.ts',
  ]
  for (const file of serviceFiles) {
    const source = await readFile(path.join(root, file), 'utf8')
    assert.match(source, /parse(?:Optional)?KmValue/, `${file} não valida KM no domínio`)
  }
})

test('remoção de viagem é transacional, recompõe estoque e preserva auditoria', async () => {
  const [migration, route, details, dialogs] = await Promise.all([
    readFile(
      path.join(root, 'database', 'migrations', '20260619_remove_trip_transactionally.sql'),
      'utf8',
    ),
    readFile(path.join(root, 'app', 'api', 'admin', 'viagens', '[id]', 'route.ts'), 'utf8'),
    readFile(path.join(root, 'components', 'trips', 'trip-details-page.tsx'), 'utf8'),
    readFile(path.join(root, 'components', 'trips', 'trip-dialogs.tsx'), 'utf8'),
  ])

  for (const fragment of [
    'fn_remover_viagem',
    'admin_pode_acessar_veiculo',
    'devolucao_cancelamento_despesa',
    'delete from public.abastecimentos',
    'delete from public.despesas_viagem',
    'delete from public.viagens',
    'fn_km_referencia_atual_veiculo',
    "set_config('app.permitir_correcao_km_veiculo'",
    'auditoria_eventos',
    'grant execute',
  ]) {
    assert.ok(migration.includes(fragment), `Migration de remoção sem ${fragment}`)
  }

  assert.match(route, /export async function DELETE/)
  assert.match(route, /fn_remover_viagem/)
  assert.match(details, /<RemoveTripDialog/)
  assert.match(details, /Remover viagem/)
  assert.match(dialogs, /peças consumidas nessas despesas retornarão ao estoque/)
})

test('remoção de manutenção é transacional, recompõe estoque e recalcula serviços', async () => {
  const [migration, schema, route, service, details, dialogs] = await Promise.all([
    readFile(
      path.join(root, 'database', 'migrations', '20260624_remove_maintenance_transactionally.sql'),
      'utf8',
    ),
    readFile(path.join(root, 'database', 'schema.sql'), 'utf8'),
    readFile(path.join(root, 'app', 'api', 'admin', 'manutencoes', '[id]', 'route.ts'), 'utf8'),
    readFile(path.join(root, 'lib', 'maintenances-service.ts'), 'utf8'),
    readFile(path.join(root, 'components', 'maintenances', 'maintenance-details-page.tsx'), 'utf8'),
    readFile(path.join(root, 'components', 'maintenances', 'maintenance-dialog.tsx'), 'utf8'),
  ])

  for (const fragment of [
    'fn_remover_manutencao',
    'fn_recalcular_programacao_servico_veiculo',
    'admin_pode_acessar_veiculo',
    'devolucao_cancelamento',
    'delete from public.manutencao_pecas',
    'delete from public.manutencao_servicos',
    'delete from public.manutencao_mecanicos',
    'delete from public.manutencoes',
    'pendencias_manuais',
    'pendencias_canceladas',
    'auditoria_eventos',
    'grant execute',
  ]) {
    assert.ok(migration.includes(fragment), `Migration de remoção de manutenção sem ${fragment}`)
    assert.ok(schema.includes(fragment), `Schema de remoção de manutenção sem ${fragment}`)
  }

  assert.match(route, /export async function DELETE/)
  assert.match(route, /assertAdminMaintenanceAccess/)
  assert.match(service, /fn_remover_manutencao/)
  assert.match(details, /<RemoveMaintenanceDialog/)
  assert.match(details, /Remover manuten/)
  assert.match(dialogs, /peças consumidas retornarão ao estoque/)
  assert.match(dialogs, /vencimentos recorrentes serão recalculados/)
})

test('AET integra o catálogo documental, formulário e alertas operacionais', async () => {
  const [migration, definitions, vehicleDialog, vehicleDetails, reports, pendings] = await Promise.all([
    readFile(
      path.join(root, 'database', 'migrations', '20260618_add_aet_vehicle_document.sql'),
      'utf8',
    ),
    readFile(path.join(root, 'lib', 'vehicle-documents.ts'), 'utf8'),
    readFile(path.join(root, 'components', 'vehicles', 'vehicle-dialog.tsx'), 'utf8'),
    readFile(path.join(root, 'components', 'vehicles', 'vehicle-details-page.tsx'), 'utf8'),
    readFile(path.join(root, 'components', 'reports', 'executive-reports-page.tsx'), 'utf8'),
    readFile(path.join(root, 'components', 'pendings', 'pendings-page.tsx'), 'utf8'),
  ])

  assert.match(migration, /values \('aet', 'AET', 30\)/)
  assert.match(migration, /on conflict \(codigo\) do update/)
  assert.match(definitions, /code: 'aet'/)
  assert.match(definitions, /formField: 'aetDueDate'/)
  assert.match(vehicleDialog, /options\.documentTypes\.map/)
  assert.doesNotMatch(vehicleDialog, /vehicleDocumentDefinitions\.map/)
  assert.match(vehicleDetails, /vehicle\.documents\.length/)
  assert.doesNotMatch(vehicleDetails, /vehicleDocumentDefinitions\.map/)
  assert.match(reports, /vehicleDocumentLabel\(value\)/)
  assert.match(pendings, /vehicleDocumentLabel\(type\)/)
})

test('documentos de veículo são opcionais por veículo e limpam CETURB legado', async () => {
  const [migration, vehicleDialog, vehiclesPage, service] = await Promise.all([
    readFile(path.join(root, 'database', 'migrations', '20260706_optional_vehicle_documents.sql'), 'utf8'),
    readFile(path.join(root, 'components', 'vehicles', 'vehicle-dialog.tsx'), 'utf8'),
    readFile(path.join(root, 'components', 'vehicles', 'vehicles-page.tsx'), 'utf8'),
    readFile(path.join(root, 'lib', 'vehicles-service.ts'), 'utf8'),
  ])

  assert.match(migration, /t\.ativo = true/)
  assert.match(migration, /v\.placa as veiculo_placa,[\s\S]*v\.codigo_frota as veiculo_codigo_frota/)
  assert.match(migration, /t\.codigo = 'ceturb'/)
  assert.match(migration, /not ilike '%nibus%'/)
  assert.match(vehicleDialog, /options.documentTypes.map/)
  assert.match(vehicleDialog, /Documentos desmarcados não geram pendências/)
  assert.match(vehiclesPage, /Documentos/)
  assert.doesNotMatch(vehiclesPage, /CETURB vencida/)
  assert.match(service, /status_operacional: 'cancelado'/)
})

test('tabelas operacionais identificam veículos pela frota', async () => {
  const [trips, tripRepository, refuelings, expenses, maintenances] = await Promise.all([
    readFile(path.join(root, 'app', 'admin', 'viagens', 'page.tsx'), 'utf8'),
    readFile(path.join(root, 'lib', 'trips-repository.ts'), 'utf8'),
    readFile(path.join(root, 'app', 'admin', 'abastecimentos', 'page.tsx'), 'utf8'),
    readFile(path.join(root, 'app', 'admin', 'despesas', 'page.tsx'), 'utf8'),
    readFile(path.join(root, 'components', 'maintenances', 'maintenances-page.tsx'), 'utf8'),
  ])

  assert.match(trips, /\{trip\.vehicleFleetCode\}/)
  assert.match(tripRepository, /\.from\('veiculos'\)/)
  assert.match(tripRepository, /\.select\('id,codigo_frota'\)/)
  assert.match(refuelings, /\{refueling\.vehicleFleetCode\}/)
  assert.match(expenses, /\{expense\.vehicleFleetCode\}/)
  assert.match(maintenances, /\{item\.vehicleFleetCode\}/)
})

test('tabela de viagens protege colunas numéricas e explicita os marcos de tempo', async () => {
  const page = await readFile(
    path.join(root, 'app', 'admin', 'viagens', 'page.tsx'),
    'utf8',
  )

  assert.match(page, /table-fixed/)
  assert.match(page, />Saída<\/span>/)
  assert.match(page, />Chegada<\/span>/)
  assert.match(page, /Duração:/)
  assert.match(page, />Início<\/span>/)
  assert.match(page, />Final<\/span>/)
  assert.match(page, /truncate tabular-nums/)
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

test('migration permite codigo de frota repetido mantendo indice de busca', async () => {
  const migration = await readFile(
    path.join(
      root,
      'database',
      'migrations',
      '20260701_allow_duplicate_vehicle_fleet_codes.sql',
    ),
    'utf8',
  )
  const requiredFragments = [
    'drop index if exists public.veiculos_codigo_frota_normalizado_uniq',
    'create index if not exists veiculos_codigo_frota_normalizado_idx',
    'on public.veiculos(codigo_frota_normalizado)',
  ]

  for (const fragment of requiredFragments) {
    assert.ok(migration.includes(fragment), `Migration sem ${fragment}`)
  }

  assert.doesNotMatch(
    migration,
    /create\s+unique\s+index[^\r\n]*(?:\r?\n\s+[^\r\n]*){0,2}\r?\n\s+on public\.veiculos\(codigo_frota_normalizado\)/i,
    'Nova regra nao pode recriar unicidade de frota',
  )
})

test('migration de peças aplica carteira administrativa e compatibilidade operacional', async () => {
  const migration = await readFile(
    path.join(
      root,
      'database',
      'migrations',
      '20260703_parts_admin_ownership.sql',
    ),
    'utf8',
  )
  const requiredFragments = [
    'admin_responsavel_id uuid references public.perfis',
    'pecas_admin_codigo_normalizado_uniq',
    'admin_pode_acessar_peca',
    'peca_compativel_com_veiculo',
    'validar_escopo_peca',
    'validar_escopo_consumo_peca',
    'pecas_select_contexto',
    'estoque_movimentacoes_select_contexto',
    "p_tipo not in ('vehicle', 'driver', 'part')",
    "'parts', cardinality(v_peca_ids)",
    'public.admin_pode_acessar_peca(id)',
  ]

  for (const fragment of requiredFragments) {
    assert.ok(migration.includes(fragment), `Migration sem ${fragment}`)
  }
})

test('migration de correcao de km de viagem preserva invariantes operacionais', async () => {
  const migration = await readFile(
    path.join(
      root,
      'database',
      'migrations',
      '20260616_trip_km_correction.sql',
    ),
    'utf8',
  )
  const requiredFragments = [
    'fn_corrigir_viagem_concluida',
    "posterior.status <> 'cancelada'",
    'admin_pode_acessar_veiculo(v_viagem_antes.veiculo_id)',
    'v_ultimo_abastecimento_em',
    "set_config('app.permitir_correcao_km_veiculo'",
    'update public.veiculos',
    'auditoria_eventos',
    'grant execute',
  ]

  for (const fragment of requiredFragments) {
    assert.ok(migration.includes(fragment), `Migration sem ${fragment}`)
  }
})

test('migration de correcao de km atual usa ultimo evento operacional', async () => {
  const migration = await readFile(
    path.join(
      root,
      'database',
      'migrations',
      '20260617_vehicle_current_km_corrections.sql',
    ),
    'utf8',
  )
  const requiredFragments = [
    'fn_km_referencia_atual_veiculo',
    'order by eventos.evento_em desc',
    'fn_corrigir_km_atual_veiculo',
    'Nao e possivel corrigir o KM atual com viagem em andamento',
    'KM atual nao pode ser menor que o ultimo evento operacional',
    'corrigir_km_atual',
    'v_km_atual_corrigido := public.fn_km_referencia_atual_veiculo',
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


test('videotelemetria preserva escopo administrativo e segredos no servidor', async () => {
  const [
    migration,
    gateway,
    service,
    deviceRoute,
    statusRoute,
    liveRoute,
    component,
    vehicleDetails,
    documentation,
  ] = await Promise.all([
    readFile(path.join(root, 'database', 'migrations', '20260726_videotelemetria_dispositivos.sql'), 'utf8'),
    readFile(path.join(root, 'lib', 'videotelemetry-gateway.ts'), 'utf8'),
    readFile(path.join(root, 'lib', 'videotelemetry-service.ts'), 'utf8'),
    readFile(path.join(root, 'app', 'api', 'admin', 'veiculos', '[id]', 'videotelemetria', 'route.ts'), 'utf8'),
    readFile(path.join(root, 'app', 'api', 'admin', 'veiculos', '[id]', 'videotelemetria', 'status', 'route.ts'), 'utf8'),
    readFile(path.join(root, 'app', 'api', 'admin', 'veiculos', '[id]', 'videotelemetria', 'live', 'route.ts'), 'utf8'),
    readFile(path.join(root, 'components', 'vehicles', 'vehicle-videotelemetry.tsx'), 'utf8'),
    readFile(path.join(root, 'components', 'vehicles', 'vehicle-details-page.tsx'), 'utf8'),
    readFile(path.join(root, 'docs', 'videotelemetry-poc.md'), 'utf8'),
  ])

  for (const fragment of [
    'dispositivos_videotelemetria',
    'admin_pode_acessar_veiculo(veiculo_id)',
    'enable row level security',
    'revoke all',
  ]) {
    assert.ok(migration.includes(fragment), `Migration de videotelemetria sem ${fragment}`)
  }

  assert.match(gateway, /import 'server-only'/)
  assert.ok(gateway.includes('Authorization: `Bearer ${normalizedApiKey}`'))
  assert.match(gateway, /cache: 'no-store'/)
  assert.ok(gateway.includes('new AbortController()'))
  assert.match(gateway, /PRODEXY_GATEWAY_BASE_URL/)
  assert.match(gateway, /PRODEXY_GATEWAY_API_KEY/)
  assert.match(gateway, /PRODEXY_GATEWAY_POC_TERMINAL_ID/)
  assert.doesNotMatch(gateway, /console\.(?:log|error|warn)/)

  assert.match(service, /assertAdminVehicleAccess/)
  assert.match(service, /getGatewayPocTerminalId/)
  assert.ok(deviceRoute.includes('requireAdmin()'))
  assert.ok(statusRoute.includes('requireAdmin()'))
  assert.ok(liveRoute.includes('requireAdmin()'))
  assert.match(liveRoute, /assertVideotelemetryChannel/)

  assert.match(component, /window\.open/)
  assert.doesNotMatch(component, /<iframe/i)
  assert.doesNotMatch(component, /PRODEXY_GATEWAY_API_KEY|Authorization:\s*['"]Bearer/)
  assert.ok(vehicleDetails.includes('isAdmin ? <VehicleVideotelemetry'))

  for (const variable of [
    'PRODEXY_GATEWAY_BASE_URL',
    'PRODEXY_GATEWAY_API_KEY',
    'PRODEXY_GATEWAY_POC_TERMINAL_ID',
  ]) {
    assert.match(documentation, new RegExp(`^${variable}=`, 'm'))
    assert.doesNotMatch(documentation, new RegExp(`NEXT_PUBLIC_${variable}`))
  }
  assert.doesNotMatch(documentation, /32\.196\.8\.246|628072026338/)
})

test('motorista inapto é permanente, perde acesso e não recebe novos vínculos', async () => {
  const [migration, schema, createRoute, updateRoute, dialog, listPage] = await Promise.all([
    readFile(path.join(root, 'database', 'migrations', '20260810_add_unfit_driver_status.sql'), 'utf8'),
    readFile(path.join(root, 'database', 'schema.sql'), 'utf8'),
    readFile(path.join(root, 'app', 'api', 'admin', 'motoristas', 'route.ts'), 'utf8'),
    readFile(path.join(root, 'app', 'api', 'admin', 'motoristas', '[id]', 'route.ts'), 'utf8'),
    readFile(path.join(root, 'components', 'drivers', 'driver-dialog.tsx'), 'utf8'),
    readFile(path.join(root, 'app', 'admin', 'motoristas', 'page.tsx'), 'utf8'),
  ])

  for (const fragment of [
    "'ativo', 'inativo', 'afastado', 'inapto'",
    'proteger_status_inapto_motorista',
    'bloquear_operacao_motorista_inapto',
    'validar_motorista_apto_para_vinculo',
    'set ativo = false',
    'principal = false',
  ]) {
    assert.ok(migration.includes(fragment), `Migration de motorista inapto sem ${fragment}`)
    assert.ok(schema.includes(fragment), `Schema de motorista inapto sem ${fragment}`)
  }

  assert.match(createRoute, /professionalStatus === 'inapto' \? false/)
  assert.match(updateRoute, /status_profissional === 'inapto'/)
  assert.match(updateRoute, /professionalStatus === 'inapto' \? null/)
  assert.match(dialog, /O status Inapto é permanente/)
  assert.match(dialog, /accessDisabled=\{isUnfit\}/)
  assert.match(listPage, /value="inapto">Inaptos/)
})
