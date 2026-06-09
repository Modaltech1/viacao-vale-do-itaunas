begin;

alter table public.servicos
  add column if not exists valor_padrao numeric(12,2) not null default 0;

alter table public.servicos
  drop constraint if exists servicos_valor_padrao_check;
alter table public.servicos
  add constraint servicos_valor_padrao_check check (valor_padrao >= 0);

update public.manutencao_servicos ms
set valor_aplicado = coalesce(ms.valor_aplicado, s.valor_padrao, 0),
    atualizado_em = now()
from public.servicos s
where s.id = ms.servico_id
  and ms.valor_aplicado is null;

create or replace function public.fn_salvar_manutencao(
  p_manutencao_id uuid,
  p_veiculo_id uuid,
  p_tipo_manutencao text,
  p_causa text,
  p_aberto_em timestamptz,
  p_km_veiculo numeric,
  p_mecanico_responsavel_id uuid,
  p_status text,
  p_observacoes text,
  p_servicos jsonb,
  p_pecas jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_servico_ids uuid[];
begin
  if jsonb_typeof(coalesce(p_servicos, '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_servicos, '[]'::jsonb)) = 0 then
    raise exception 'Selecione pelo menos um serviço';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_servicos) item
    group by item->>'serviceId'
    having count(*) > 1
  ) then
    raise exception 'O mesmo serviço não pode ser informado mais de uma vez';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_servicos) item
    where nullif(item->>'serviceId', '') is null
      or nullif(item->>'appliedValue', '') is null
      or (item->>'appliedValue')::numeric < 0
  ) then
    raise exception 'Dados de serviço inválidos';
  end if;

  select array_agg((item->>'serviceId')::uuid)
  into v_servico_ids
  from jsonb_array_elements(p_servicos) item;

  v_id := public.fn_salvar_manutencao(
    p_manutencao_id,
    p_veiculo_id,
    p_tipo_manutencao,
    p_causa,
    p_aberto_em,
    p_km_veiculo,
    p_mecanico_responsavel_id,
    p_status,
    p_observacoes,
    v_servico_ids,
    p_pecas
  );

  update public.manutencao_servicos ms
  set valor_aplicado = item.valor_aplicado,
      atualizado_por = auth.uid(),
      atualizado_em = now()
  from (
    select
      (value->>'serviceId')::uuid as servico_id,
      (value->>'appliedValue')::numeric as valor_aplicado
    from jsonb_array_elements(p_servicos)
  ) item
  where ms.manutencao_id = v_id
    and ms.servico_id = item.servico_id;

  return v_id;
end;
$$;

create or replace function public.fn_editar_manutencao_concluida(
  p_manutencao_id uuid,
  p_veiculo_id uuid,
  p_tipo_manutencao text,
  p_causa text,
  p_aberto_em timestamptz,
  p_km_veiculo numeric,
  p_mecanico_responsavel_id uuid,
  p_status text,
  p_observacoes text,
  p_servicos jsonb,
  p_pecas jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_servico_ids uuid[];
begin
  if jsonb_typeof(coalesce(p_servicos, '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_servicos, '[]'::jsonb)) = 0 then
    raise exception 'Selecione pelo menos um serviço';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_servicos) item
    group by item->>'serviceId'
    having count(*) > 1
  ) then
    raise exception 'O mesmo serviço não pode ser informado mais de uma vez';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_servicos) item
    where nullif(item->>'serviceId', '') is null
      or nullif(item->>'appliedValue', '') is null
      or (item->>'appliedValue')::numeric < 0
  ) then
    raise exception 'Dados de serviço inválidos';
  end if;

  select array_agg((item->>'serviceId')::uuid)
  into v_servico_ids
  from jsonb_array_elements(p_servicos) item;

  v_id := public.fn_editar_manutencao_concluida(
    p_manutencao_id,
    p_veiculo_id,
    p_tipo_manutencao,
    p_causa,
    p_aberto_em,
    p_km_veiculo,
    p_mecanico_responsavel_id,
    p_status,
    p_observacoes,
    v_servico_ids,
    p_pecas
  );

  update public.manutencao_servicos ms
  set valor_aplicado = item.valor_aplicado,
      atualizado_por = auth.uid(),
      atualizado_em = now()
  from (
    select
      (value->>'serviceId')::uuid as servico_id,
      (value->>'appliedValue')::numeric as valor_aplicado
    from jsonb_array_elements(p_servicos)
  ) item
  where ms.manutencao_id = v_id
    and ms.servico_id = item.servico_id;

  return v_id;
end;
$$;

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
  coalesce(abast.custo_abastecimento_total, 0)
    + coalesce(manut.custo_manutencao_total, 0)
    + coalesce(desp.custo_despesas_total, 0) as custo_total_operacional
from public.veiculos v
left join public.rotas r on r.id = v.rota_fixa_id
left join public.veiculo_motoristas vm
  on vm.veiculo_id = v.id and vm.ativo = true and vm.principal = true and vm.fim_em is null
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
    + coalesce(pecas.valor_pecas, 0)
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
  ) pecas on true
  where m.veiculo_id = v.id and m.status <> 'cancelada'
) manut on true
left join lateral (
  select sum(d.valor) as custo_despesas_total
  from public.despesas_viagem d
  where d.veiculo_id = v.id and d.cancelado_em is null
) desp on true
where v.excluido_em is null;

create or replace view public.vw_manutencoes_detalhadas
with (security_invoker = true)
as
select
  m.*,
  v.placa as veiculo_placa,
  v.marca as veiculo_marca,
  v.modelo as veiculo_modelo,
  pm.nome as mecanico_responsavel_nome,
  coalesce(servicos.valor_servicos, 0)
    + coalesce(pecas.valor_pecas, 0) as valor_total_realizado,
  servicos.servicos,
  pecas.pecas,
  coalesce(servicos.valor_servicos, 0) as valor_servicos,
  coalesce(pecas.valor_pecas, 0) as valor_pecas
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

create or replace function public.fn_dashboard_admin(
  p_inicio date default null,
  p_fim date default null,
  p_veiculo_id uuid default null,
  p_motorista_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inicio timestamptz := coalesce(p_inicio::timestamptz, date_trunc('month', now()));
  v_fim timestamptz := coalesce((p_fim::timestamptz + interval '1 day'), now() + interval '1 day');
  result jsonb;
begin
  if not public.eh_admin() then
    raise exception 'Somente admin pode consultar dashboard administrativo';
  end if;

  with viagens_filtradas as (
    select * from public.viagens v
    where v.saiu_em >= v_inicio and v.saiu_em < v_fim
      and (p_veiculo_id is null or v.veiculo_id = p_veiculo_id)
      and (p_motorista_id is null or v.motorista_id = p_motorista_id)
  ), abastecimentos_filtrados as (
    select a.* from public.abastecimentos a
    where a.registrado_em >= v_inicio and a.registrado_em < v_fim
      and a.cancelado_em is null
      and (p_veiculo_id is null or a.veiculo_id = p_veiculo_id)
      and (p_motorista_id is null or a.motorista_id = p_motorista_id)
  ), despesas_filtradas as (
    select d.* from public.despesas_viagem d
    where d.registrado_em >= v_inicio and d.registrado_em < v_fim
      and d.cancelado_em is null
      and (p_veiculo_id is null or d.veiculo_id = p_veiculo_id)
      and (p_motorista_id is null or d.motorista_id = p_motorista_id)
  ), manutencoes_filtradas as (
    select m.*,
      coalesce(servicos.valor_servicos, 0)
        + coalesce(pecas.valor_pecas, 0) as valor_realizado
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
    ) pecas on true
    where m.aberto_em >= v_inicio and m.aberto_em < v_fim
      and m.status <> 'cancelada'
      and (p_veiculo_id is null or m.veiculo_id = p_veiculo_id)
  )
  select jsonb_build_object(
    'total_veiculos', (select count(*) from public.veiculos where excluido_em is null),
    'veiculos_em_manutencao', (select count(*) from public.veiculos where status_operacional = 'em_manutencao' and excluido_em is null),
    'viagens_em_andamento', (select count(*) from public.viagens where status = 'em_andamento'),
    'pendencias_criticas', (select count(*) from public.vw_pendencias_operacionais where severidade = 'critica' and status = 'aberta'),
    'km_rodados', coalesce((select sum(km_final - km_inicial) from viagens_filtradas where status = 'concluida'), 0),
    'litros_abastecidos', coalesce((select sum(litros) from abastecimentos_filtrados where tipo_combustivel <> 'ARLA'), 0),
    'consumo_medio', case when coalesce((select sum(litros) from abastecimentos_filtrados where tipo_combustivel <> 'ARLA'), 0) > 0 then round(((select coalesce(sum(km_final - km_inicial),0) from viagens_filtradas where status='concluida') / nullif((select coalesce(sum(litros),0) from abastecimentos_filtrados where tipo_combustivel <> 'ARLA'),0))::numeric,2) else null end,
    'gasto_abastecimento', coalesce((select sum(coalesce(valor_total,0)) from abastecimentos_filtrados),0),
    'gasto_manutencao', coalesce((select sum(valor_realizado) from manutencoes_filtradas),0),
    'gasto_despesas', coalesce((select sum(valor) from despesas_filtradas),0),
    'gasto_total', coalesce((select sum(coalesce(valor_total,0)) from abastecimentos_filtrados),0) + coalesce((select sum(valor_realizado) from manutencoes_filtradas),0) + coalesce((select sum(valor) from despesas_filtradas),0),
    'pecas_estoque_baixo', (select count(*) from public.pecas where ativo and excluido_em is null and quantidade_estoque <= estoque_minimo),
    'valor_estoque_pecas', (select coalesce(sum(quantidade_estoque * valor_unitario),0) from public.pecas where ativo and excluido_em is null)
  ) into result;

  return result;
end;
$$;

revoke execute on function public.fn_salvar_manutencao(
  uuid,uuid,text,text,timestamptz,numeric,uuid,text,text,jsonb,jsonb
) from public, anon;
revoke execute on function public.fn_editar_manutencao_concluida(
  uuid,uuid,text,text,timestamptz,numeric,uuid,text,text,jsonb,jsonb
) from public, anon;

grant execute on function public.fn_salvar_manutencao(
  uuid,uuid,text,text,timestamptz,numeric,uuid,text,text,jsonb,jsonb
) to authenticated;
grant execute on function public.fn_editar_manutencao_concluida(
  uuid,uuid,text,text,timestamptz,numeric,uuid,text,text,jsonb,jsonb
) to authenticated;

commit;
