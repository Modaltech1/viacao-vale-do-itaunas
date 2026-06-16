-- =========================================================
-- CODIGO DE FROTA COMO IDENTIFICADOR OPERACIONAL PRINCIPAL
-- =========================================================

alter table public.veiculos
  add column if not exists codigo_frota text;

update public.veiculos
set codigo_frota = placa
where codigo_frota is null or btrim(codigo_frota) = '';

alter table public.veiculos
  alter column codigo_frota set not null;

alter table public.veiculos
  add column if not exists codigo_frota_normalizado text
  generated always as (public.normalizar_texto(codigo_frota)) stored;

create unique index if not exists veiculos_codigo_frota_normalizado_uniq
  on public.veiculos(codigo_frota_normalizado)
  where codigo_frota_normalizado is not null and excluido_em is null;

create or replace view public.vw_veiculos_resumo
with (security_invoker = true)
as
select
  v.id,
  v.tipo,
  v.marca,
  v.modelo,
  v.placa,
  v.placa_normalizada,
  v.ano,
  v.status_operacional,
  v.km_atual,
  v.capacidade,
  v.rota_fixa_id,
  r.nome as rota_nome,
  r.origem as rota_origem,
  r.destino as rota_destino,
  p_motorista.nome as motorista_principal_nome,
  vm.motorista_id as motorista_principal_id,
  coalesce(viag.km_rodados_total, 0) as km_rodados_total,
  coalesce(abast.litros_combustivel_total, 0) as litros_combustivel_total,
  case
    when coalesce(abast.litros_combustivel_total, 0) > 0
    then round((coalesce(viag.km_rodados_total, 0) / nullif(abast.litros_combustivel_total, 0))::numeric, 2)
    else null
  end as consumo_medio_km_l,
  coalesce(abast.custo_abastecimento_total, 0) as custo_abastecimento_total,
  coalesce(manut.custo_manutencao_total, 0) as custo_manutencao_total,
  coalesce(desp.custo_despesas_total, 0) as custo_despesas_total,
  coalesce(abast.custo_abastecimento_total, 0) + coalesce(manut.custo_manutencao_total, 0) + coalesce(desp.custo_despesas_total, 0) as custo_total_operacional,
  v.codigo_frota,
  v.codigo_frota_normalizado
from public.veiculos v
left join public.rotas r on r.id = v.rota_fixa_id
left join public.veiculo_motoristas vm on vm.veiculo_id = v.id and vm.ativo = true and vm.principal = true and vm.fim_em is null
left join public.motoristas m_principal on m_principal.id = vm.motorista_id
left join public.perfis p_motorista on p_motorista.id = m_principal.perfil_id
left join lateral (
  select sum(vi.km_final - vi.km_inicial) as km_rodados_total
  from public.viagens vi
  where vi.veiculo_id = v.id and vi.status = 'concluida'
) viag on true
left join lateral (
  select
    sum(case when a.tipo_combustivel <> 'ARLA' then a.litros else 0 end) as litros_combustivel_total,
    sum(coalesce(a.valor_total, 0)) as custo_abastecimento_total
  from public.abastecimentos a
  where a.veiculo_id = v.id and a.cancelado_em is null
) abast on true
left join lateral (
  select sum(
    coalesce(servicos.valor_servicos, 0)
    + coalesce(itens.valor_pecas, 0)
  ) as custo_manutencao_total
  from public.manutencoes m
  left join lateral (
    select sum(ms.valor_aplicado) as valor_servicos
    from public.manutencao_servicos ms
    where ms.manutencao_id = m.id
  ) servicos on true
  left join lateral (
    select sum(mp.valor_total) as valor_pecas
    from public.manutencao_pecas mp
    where mp.manutencao_id = m.id
  ) itens on true
  where m.veiculo_id = v.id and m.status <> 'cancelada'
) manut on true
left join lateral (
  select sum(d.valor) as custo_despesas_total
  from public.despesas_viagem d
  where d.veiculo_id = v.id and d.cancelado_em is null
) desp on true
where v.excluido_em is null;

create or replace view public.vw_viagens_detalhadas
with (security_invoker = true)
as
select
  vi.*,
  p.nome as motorista_nome,
  v.placa as veiculo_placa,
  v.marca as veiculo_marca,
  v.modelo as veiculo_modelo,
  case when vi.status = 'concluida' then vi.km_final - vi.km_inicial else null end as km_total,
  coalesce((select sum(a.litros) from public.abastecimentos a where a.viagem_id = vi.id and a.cancelado_em is null and a.tipo_combustivel <> 'ARLA'),0) as litros_combustivel,
  coalesce((select sum(coalesce(a.valor_total,0)) from public.abastecimentos a where a.viagem_id = vi.id and a.cancelado_em is null),0) as valor_abastecimento,
  coalesce((select sum(d.valor) from public.despesas_viagem d where d.viagem_id = vi.id and d.cancelado_em is null),0) as valor_despesas,
  v.codigo_frota as veiculo_codigo_frota
from public.viagens vi
join public.motoristas m on m.id = vi.motorista_id
left join public.perfis p on p.id = m.perfil_id
join public.veiculos v on v.id = vi.veiculo_id;

create or replace view public.vw_manutencoes_detalhadas
with (security_invoker = true)
as
select
  m.*,
  v.placa as veiculo_placa,
  v.marca as veiculo_marca,
  v.modelo as veiculo_modelo,
  pm.nome as mecanico_responsavel_nome,
  coalesce(servicos.valor_servicos, 0) + coalesce(pecas.valor_pecas, 0) as valor_total_realizado,
  servicos.servicos,
  pecas.pecas,
  coalesce(servicos.valor_servicos, 0) as valor_servicos,
  coalesce(pecas.valor_pecas, 0) as valor_pecas,
  v.codigo_frota as veiculo_codigo_frota
from public.manutencoes m
join public.veiculos v on v.id = m.veiculo_id
left join public.mecanicos mec on mec.id = m.mecanico_responsavel_id
left join public.perfis pm on pm.id = mec.perfil_id
left join lateral (
  select
    sum(ms.valor_aplicado) as valor_servicos,
    jsonb_agg(
      jsonb_build_object(
        'id', ms.servico_id,
        'nome', ms.nome_servico_snapshot,
        'categoria', ms.categoria_snapshot,
        'valor', ms.valor_aplicado
      ) order by ms.criado_em
    ) as servicos
  from public.manutencao_servicos ms
  where ms.manutencao_id = m.id
) servicos on true
left join lateral (
  select
    sum(mp.valor_total) as valor_pecas,
    jsonb_agg(
      jsonb_build_object(
        'id', mp.id,
        'pecaId', mp.peca_id,
        'codigo', mp.codigo_snapshot,
        'nome', mp.nome_snapshot,
        'unidade', mp.unidade_snapshot,
        'quantidade', mp.quantidade,
        'valorUnitario', mp.valor_unitario,
        'valorTotal', mp.valor_total,
        'estoqueDevolvidoEm', mp.estoque_devolvido_em
      ) order by mp.criado_em
    ) as pecas
  from public.manutencao_pecas mp
  where mp.manutencao_id = m.id
) pecas on true;

create or replace view public.vw_servicos_programados_status
with (security_invoker = true)
as
select
  p.*,
  v.placa as veiculo_placa,
  v.km_atual,
  s.nome as servico_nome,
  s.categoria as servico_categoria,
  case
    when not p.ativo or p.excluido_em is not null then 'inativo'
    when p.periodicidade_tipo_snapshot = 'km' and p.proximo_vencimento_km is not null and v.km_atual >= p.proximo_vencimento_km then 'vencido'
    when p.periodicidade_tipo_snapshot = 'km' and p.proximo_vencimento_km is not null and (p.proximo_vencimento_km - v.km_atual) <= p.km_alerta then 'proximo'
    when p.periodicidade_tipo_snapshot = 'tempo' and p.proximo_vencimento_em is not null and p.proximo_vencimento_em < current_date then 'vencido'
    when p.periodicidade_tipo_snapshot = 'tempo' and p.proximo_vencimento_em is not null and p.proximo_vencimento_em <= current_date + make_interval(days => p.dias_alerta) then 'proximo'
    else 'em_dia'
  end as status_calculado,
  case
    when p.periodicidade_tipo_snapshot = 'km' and p.proximo_vencimento_km is not null then p.proximo_vencimento_km - v.km_atual
    else null
  end as km_restante,
  v.codigo_frota as veiculo_codigo_frota
from public.veiculo_servico_programacoes p
join public.veiculos v on v.id = p.veiculo_id
join public.servicos s on s.id = p.servico_id;

create or replace view public.vw_documentos_veiculo_status
with (security_invoker = true)
as
select
  d.*,
  v.placa as veiculo_placa,
  t.codigo as tipo_codigo,
  t.nome as tipo_nome,
  public.calcular_status_vencimento(d.vencimento_em, t.dias_alerta) as status_calculado,
  public.calcular_severidade_vencimento(d.vencimento_em, t.dias_alerta) as severidade_calculada,
  v.codigo_frota as veiculo_codigo_frota
from public.veiculo_documentos d
join public.tipos_documento_veiculo t on t.id = d.tipo_documento_id
join public.veiculos v on v.id = d.veiculo_id
where d.status_operacional = 'ativo' and d.excluido_em is null;

create or replace view public.vw_pendencias_calculadas
with (security_invoker = true)
as
select
  'servico:' || p.id::text as chave,
  'calculada'::text as origem,
  case when p.status_calculado = 'vencido' then 'critica' else 'atencao' end as severidade,
  case when p.periodicidade_tipo_snapshot = 'km' then 'servico_km' else 'servico_tempo' end as tipo,
  p.veiculo_id,
  null::uuid as motorista_id,
  null::uuid as mecanico_id,
  p.servico_id,
  null::uuid as manutencao_id,
  (p.servico_nome || case when p.status_calculado = 'vencido' then ' vencido' else ' próximo' end) as titulo,
  (coalesce(p.veiculo_codigo_frota, p.veiculo_placa) || ' · ' || p.servico_nome || ' · status: ' || p.status_calculado) as descricao,
  p.proximo_vencimento_em as vencimento_em,
  p.proximo_vencimento_km as vencimento_km,
  p.km_atual,
  'aberta'::text as status,
  'Registrar manutenção'::text as acao_label
from public.vw_servicos_programados_status p
where p.status_calculado in ('proximo','vencido')
union all
select
  'documento:' || d.id::text,
  'calculada',
  d.severidade_calculada,
  d.tipo_codigo,
  d.veiculo_id,
  null::uuid,
  null::uuid,
  null::uuid,
  null::uuid,
  d.tipo_nome || ' ' || case when d.status_calculado = 'vencido' then 'vencido' else 'próximo' end,
  coalesce(d.veiculo_codigo_frota, d.veiculo_placa) || ' · vencimento em ' || d.vencimento_em::text,
  d.vencimento_em,
  null::numeric,
  null::numeric,
  'aberta',
  'Abrir veículo'
from public.vw_documentos_veiculo_status d
where d.status_calculado in ('proximo','vencido')
union all
select
  'cnh:' || m.id::text,
  'calculada',
  public.calcular_severidade_vencimento(m.validade_habilitacao, 30),
  'cnh',
  null::uuid,
  m.id,
  null::uuid,
  null::uuid,
  null::uuid,
  'CNH ' || case when public.calcular_status_vencimento(m.validade_habilitacao, 30) = 'vencido' then 'vencida' else 'próxima do vencimento' end,
  p.nome || ' · vencimento em ' || m.validade_habilitacao::text,
  m.validade_habilitacao,
  null::numeric,
  null::numeric,
  'aberta',
  'Abrir motorista'
from public.motoristas m
join public.perfis p on p.id = m.perfil_id
where m.excluido_em is null
  and public.calcular_status_vencimento(m.validade_habilitacao, 30) in ('proximo','vencido')
union all
select
  'manutencao:' || mn.id::text,
  'calculada',
  case when mn.status = 'aberta' then 'critica' else 'atencao' end,
  'manutencao_aberta',
  mn.veiculo_id,
  null::uuid,
  mn.mecanico_responsavel_id,
  null::uuid,
  mn.id,
  'Manutenção ' || mn.status,
  coalesce(v.codigo_frota, v.placa) || ' · ' || coalesce(mn.causa, 'sem descrição'),
  mn.concluido_em::date,
  null::numeric,
  mn.km_veiculo,
  'aberta',
  'Abrir manutenção'
from public.manutencoes mn
join public.veiculos v on v.id = mn.veiculo_id
where mn.status in ('aberta','em_andamento')
union all
select
  'veiculo_status:' || v.id::text,
  'calculada',
  case when v.status_operacional in ('indisponivel','em_manutencao') then 'critica' else 'atencao' end,
  'veiculo_status',
  v.id,
  null::uuid,
  null::uuid,
  null::uuid,
  null::uuid,
  'Veículo ' || v.status_operacional,
  coalesce(v.codigo_frota, v.placa) || ' · ' || v.marca || ' ' || v.modelo,
  null::date,
  null::numeric,
  v.km_atual,
  'aberta',
  'Abrir veículo'
from public.veiculos v
where v.status_operacional in ('em_manutencao','indisponivel') and v.excluido_em is null;

create or replace view public.vw_pendencias_operacionais
with (security_invoker = true)
as
select * from public.vw_pendencias_calculadas
union all
select
  'manual:' || pm.id::text as chave,
  'manual'::text as origem,
  pm.severidade,
  pm.tipo,
  pm.veiculo_id,
  pm.motorista_id,
  pm.mecanico_id,
  pm.servico_id,
  pm.manutencao_id,
  pm.titulo,
  pm.descricao,
  pm.vencimento_em,
  pm.vencimento_km,
  null::numeric as km_atual,
  pm.status,
  'Abrir pendência'::text as acao_label
from public.pendencias_manuais pm
where pm.status = 'aberta';

grant select on
  public.vw_veiculos_resumo,
  public.vw_viagens_detalhadas,
  public.vw_manutencoes_detalhadas,
  public.vw_servicos_programados_status,
  public.vw_documentos_veiculo_status,
  public.vw_pendencias_calculadas,
  public.vw_pendencias_operacionais
to authenticated;
