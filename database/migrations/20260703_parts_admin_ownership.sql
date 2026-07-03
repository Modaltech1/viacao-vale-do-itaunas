-- Carteira administrativa para peças.
-- Cada admin restrito vê e gerencia apenas as peças da própria responsabilidade.
-- O admin global continua enxergando e redistribuindo todos os registros.

alter table public.pecas
  add column if not exists admin_responsavel_id uuid references public.perfis(id) on delete set null;

update public.pecas p
set admin_responsavel_id = p.criado_por
where p.admin_responsavel_id is null
  and exists (
    select 1
    from public.perfis a
    where a.id = p.criado_por
      and a.papel = 'admin'
      and a.ativo = true
  );

with fallback as (
  select id
  from public.perfis
  where papel = 'admin'
    and ativo = true
  order by
    case when nivel_admin = 'global' then 0 else 1 end,
    criado_em nulls last,
    nome
  limit 1
)
update public.pecas p
set admin_responsavel_id = fallback.id
from fallback
where p.admin_responsavel_id is null;

drop index if exists public.pecas_codigo_normalizado_uniq;
create unique index if not exists pecas_admin_codigo_normalizado_uniq
  on public.pecas(
    coalesce(admin_responsavel_id, '00000000-0000-0000-0000-000000000000'::uuid),
    codigo_normalizado
  )
  where excluido_em is null;

create index if not exists pecas_admin_responsavel_idx
  on public.pecas(admin_responsavel_id)
  where excluido_em is null;

create or replace function public.admin_pode_acessar_peca(p_peca_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.eh_admin()
    and (
      public.eh_admin_global()
      or exists (
        select 1
        from public.pecas p
        where p.id = p_peca_id
          and p.excluido_em is null
          and p.admin_responsavel_id = auth.uid()
      )
    )
$$;

create or replace function public.peca_compativel_com_veiculo(
  p_peca_id uuid,
  p_veiculo_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.pecas p
    join public.veiculos v on v.id = p_veiculo_id
    where p.id = p_peca_id
      and p.excluido_em is null
      and v.excluido_em is null
      and p.admin_responsavel_id is not distinct from v.admin_responsavel_id
  )
$$;

create or replace function public.validar_escopo_peca()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin public.perfis%rowtype;
begin
  if public.eh_admin() and not public.eh_admin_global() then
    if tg_op = 'UPDATE' and old.admin_responsavel_id is distinct from auth.uid() then
      raise exception 'Peça fora da responsabilidade do administrador';
    end if;
    new.admin_responsavel_id := auth.uid();
  end if;

  if new.admin_responsavel_id is not null then
    select * into v_admin
    from public.perfis
    where id = new.admin_responsavel_id
      and papel = 'admin'
      and ativo = true;

    if not found then
      raise exception 'Administrador responsavel invalido ou inativo';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists pecas_preparar_admin_responsavel_trg on public.pecas;
create trigger pecas_preparar_admin_responsavel_trg
  before insert or update on public.pecas
  for each row execute function public.validar_escopo_peca();

create or replace function public.validar_escopo_consumo_peca()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_veiculo_id uuid;
begin
  if tg_table_name = 'manutencao_pecas' then
    select m.veiculo_id into v_veiculo_id
    from public.manutencoes m
    where m.id = new.manutencao_id;
  elsif tg_table_name = 'despesa_pecas' then
    select d.veiculo_id into v_veiculo_id
    from public.despesas_viagem d
    where d.id = new.despesa_id;
  end if;

  if v_veiculo_id is null then
    raise exception 'Veículo da movimentação de peça não encontrado';
  end if;

  if not public.peca_compativel_com_veiculo(new.peca_id, v_veiculo_id) then
    raise exception 'Peça fora da responsabilidade do veículo';
  end if;

  return new;
end;
$$;

drop trigger if exists manutencao_pecas_validar_escopo_trg on public.manutencao_pecas;
create trigger manutencao_pecas_validar_escopo_trg
  before insert or update of manutencao_id, peca_id on public.manutencao_pecas
  for each row execute function public.validar_escopo_consumo_peca();

drop trigger if exists despesa_pecas_validar_escopo_trg on public.despesa_pecas;
create trigger despesa_pecas_validar_escopo_trg
  before insert or update of despesa_id, peca_id on public.despesa_pecas
  for each row execute function public.validar_escopo_consumo_peca();

alter table public.pecas enable row level security;
alter table public.estoque_movimentacoes enable row level security;

drop policy if exists pecas_select_admin_mecanico on public.pecas;
drop policy if exists pecas_admin_write on public.pecas;
drop policy if exists pecas_select_contexto on public.pecas;
drop policy if exists pecas_admin_write_contexto on public.pecas;

create policy pecas_select_contexto on public.pecas
  for select to authenticated
  using (
    public.eh_mecanico()
    or public.admin_pode_acessar_responsavel(admin_responsavel_id)
  );

create policy pecas_admin_write_contexto on public.pecas
  for all to authenticated
  using (public.admin_pode_acessar_responsavel(admin_responsavel_id))
  with check (public.admin_pode_acessar_responsavel(admin_responsavel_id));

drop policy if exists estoque_movimentacoes_select_admin_mecanico on public.estoque_movimentacoes;
drop policy if exists estoque_movimentacoes_select_contexto on public.estoque_movimentacoes;

create policy estoque_movimentacoes_select_contexto on public.estoque_movimentacoes
  for select to authenticated
  using (
    public.eh_mecanico()
    or exists (
      select 1
      from public.pecas p
      where p.id = estoque_movimentacoes.peca_id
        and public.admin_pode_acessar_peca(p.id)
    )
  );

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
  v_inicio timestamptz := coalesce(
    p_inicio::timestamptz,
    date_trunc('month', now())
  );
  v_fim timestamptz := coalesce(
    p_fim::timestamptz + interval '1 day',
    now() + interval '1 day'
  );
  result jsonb;
begin
  if not public.eh_admin() then
    raise exception 'Somente admin pode consultar dashboard administrativo';
  end if;

  with veiculos_permitidos as (
    select v.id
    from public.veiculos v
    where v.excluido_em is null
      and (
        public.eh_admin_global()
        or v.admin_responsavel_id = auth.uid()
      )
  ), motoristas_permitidos as (
    select m.id
    from public.motoristas m
    where m.excluido_em is null
      and (
        public.eh_admin_global()
        or m.admin_responsavel_id = auth.uid()
      )
  ), viagens_filtradas as (
    select v.*
    from public.viagens v
    join veiculos_permitidos vp on vp.id = v.veiculo_id
    where v.saiu_em >= v_inicio
      and v.saiu_em < v_fim
      and (p_veiculo_id is null or v.veiculo_id = p_veiculo_id)
      and (p_motorista_id is null or v.motorista_id = p_motorista_id)
  ), abastecimentos_filtrados as (
    select a.*
    from public.abastecimentos a
    join veiculos_permitidos vp on vp.id = a.veiculo_id
    where a.registrado_em >= v_inicio
      and a.registrado_em < v_fim
      and a.cancelado_em is null
      and (p_veiculo_id is null or a.veiculo_id = p_veiculo_id)
      and (p_motorista_id is null or a.motorista_id = p_motorista_id)
  ), despesas_filtradas as (
    select d.*
    from public.despesas_viagem d
    join veiculos_permitidos vp on vp.id = d.veiculo_id
    where d.registrado_em >= v_inicio
      and d.registrado_em < v_fim
      and d.cancelado_em is null
      and (p_veiculo_id is null or d.veiculo_id = p_veiculo_id)
      and (p_motorista_id is null or d.motorista_id = p_motorista_id)
  ), manutencoes_filtradas as (
    select
      m.*,
      coalesce(servicos.valor_servicos, 0)
      + coalesce(itens.valor_pecas, 0) as valor_realizado
    from public.manutencoes m
    join veiculos_permitidos vp on vp.id = m.veiculo_id
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
    where m.aberto_em >= v_inicio
      and m.aberto_em < v_fim
      and m.status <> 'cancelada'
      and (p_veiculo_id is null or m.veiculo_id = p_veiculo_id)
  ), pendencias_criticas as (
    select count(*) as total
    from public.vw_pendencias_operacionais p
    where p.severidade = 'critica'
      and p.status = 'aberta'
      and (
        public.eh_admin_global()
        or p.veiculo_id in (select id from veiculos_permitidos)
        or p.motorista_id in (select id from motoristas_permitidos)
        or p.chave in (
          select 'manual:' || pm.id::text
          from public.pendencias_manuais pm
          where pm.admin_responsavel_id = auth.uid()
        )
      )
  )
  select jsonb_build_object(
    'total_veiculos', (select count(*) from veiculos_permitidos),
    'veiculos_em_manutencao', (
      select count(*)
      from public.veiculos v
      join veiculos_permitidos vp on vp.id = v.id
      where v.status_operacional = 'em_manutencao'
    ),
    'viagens_em_andamento', (
      select count(*)
      from public.viagens v
      join veiculos_permitidos vp on vp.id = v.veiculo_id
      where v.status = 'em_andamento'
    ),
    'pendencias_criticas', (select total from pendencias_criticas),
    'km_rodados', coalesce((
      select sum(km_final - km_inicial)
      from viagens_filtradas
      where status = 'concluida'
    ), 0),
    'litros_abastecidos', coalesce((
      select sum(litros)
      from abastecimentos_filtrados
      where tipo_combustivel <> 'ARLA'
    ), 0),
    'consumo_medio', case
      when coalesce((
        select sum(litros)
        from abastecimentos_filtrados
        where tipo_combustivel <> 'ARLA'
      ), 0) > 0
      then round(((
        select coalesce(sum(km_final - km_inicial), 0)
        from viagens_filtradas
        where status = 'concluida'
      ) / nullif((
        select coalesce(sum(litros), 0)
        from abastecimentos_filtrados
        where tipo_combustivel <> 'ARLA'
      ), 0))::numeric, 2)
      else null
    end,
    'gasto_abastecimento', coalesce((
      select sum(coalesce(valor_total, 0))
      from abastecimentos_filtrados
    ), 0),
    'gasto_manutencao', coalesce((
      select sum(valor_realizado)
      from manutencoes_filtradas
    ), 0),
    'gasto_despesas', coalesce((
      select sum(valor)
      from despesas_filtradas
    ), 0),
    'gasto_total',
      coalesce((
        select sum(coalesce(valor_total, 0))
        from abastecimentos_filtrados
      ), 0)
      + coalesce((
        select sum(valor_realizado)
        from manutencoes_filtradas
      ), 0)
      + coalesce((
        select sum(valor)
        from despesas_filtradas
      ), 0),
    'pecas_estoque_baixo', (
      select count(*)
      from public.pecas
      where ativo
        and excluido_em is null
        and quantidade_estoque <= estoque_minimo
        and public.admin_pode_acessar_peca(id)
    ),
    'valor_estoque_pecas', (
      select coalesce(sum(quantidade_estoque * valor_unitario), 0)
      from public.pecas
      where ativo
        and excluido_em is null
        and public.admin_pode_acessar_peca(id)
    )
  ) into result;

  return result;
end;
$$;

create or replace function public.fn_transferir_responsabilidade_admin(
  p_tipo text,
  p_recurso_id uuid,
  p_admin_responsavel_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_veiculo_ids uuid[] := '{}'::uuid[];
  v_motorista_ids uuid[] := '{}'::uuid[];
  v_peca_ids uuid[] := '{}'::uuid[];
begin
  if not public.eh_admin_global() then
    raise exception 'Somente administradores globais podem transferir responsabilidades';
  end if;

  if p_tipo not in ('vehicle', 'driver', 'part') then
    raise exception 'Tipo de recurso invalido';
  end if;

  if p_recurso_id is null then
    raise exception 'Recurso invalido';
  end if;

  if p_admin_responsavel_id is not null
    and not exists (
      select 1
      from public.perfis p
      where p.id = p_admin_responsavel_id
        and p.papel = 'admin'
        and p.ativo = true
    )
  then
    raise exception 'O administrador responsavel precisa estar ativo';
  end if;

  if p_tipo = 'vehicle'
    and not exists (
      select 1
      from public.veiculos v
      where v.id = p_recurso_id
        and v.excluido_em is null
    )
  then
    raise exception 'Veiculo nao encontrado';
  end if;

  if p_tipo = 'driver'
    and not exists (
      select 1
      from public.motoristas m
      where m.id = p_recurso_id
        and m.excluido_em is null
    )
  then
    raise exception 'Motorista nao encontrado';
  end if;

  if p_tipo = 'part'
    and not exists (
      select 1
      from public.pecas p
      where p.id = p_recurso_id
        and p.excluido_em is null
    )
  then
    raise exception 'Peca nao encontrada';
  end if;

  with recursive componentes(tipo, id) as (
    select p_tipo, p_recurso_id

    union

    select proximo.tipo, proximo.id
    from componentes atual
    cross join lateral (
      select 'driver'::text as tipo, vm.motorista_id as id
      from public.veiculo_motoristas vm
      where atual.tipo = 'vehicle'
        and vm.veiculo_id = atual.id
        and vm.ativo = true
        and vm.fim_em is null

      union

      select 'vehicle'::text as tipo, vm.veiculo_id as id
      from public.veiculo_motoristas vm
      where atual.tipo = 'driver'
        and vm.motorista_id = atual.id
        and vm.ativo = true
        and vm.fim_em is null
    ) proximo
  )
  select
    coalesce(
      array_agg(id) filter (where tipo = 'vehicle'),
      '{}'::uuid[]
    ),
    coalesce(
      array_agg(id) filter (where tipo = 'driver'),
      '{}'::uuid[]
    )
  into v_veiculo_ids, v_motorista_ids
  from componentes;

  if p_tipo = 'part' then
    v_peca_ids := array[p_recurso_id];
  end if;

  update public.veiculos
  set
    admin_responsavel_id = p_admin_responsavel_id,
    atualizado_por = auth.uid()
  where id = any(v_veiculo_ids)
    and excluido_em is null;

  update public.motoristas
  set
    admin_responsavel_id = p_admin_responsavel_id,
    atualizado_por = auth.uid()
  where id = any(v_motorista_ids)
    and excluido_em is null;

  update public.pecas
  set
    admin_responsavel_id = p_admin_responsavel_id,
    atualizado_por = auth.uid()
  where id = any(v_peca_ids)
    and excluido_em is null;

  update public.pendencias_manuais pm
  set
    admin_responsavel_id = p_admin_responsavel_id,
    atualizado_por = auth.uid()
  where
    pm.veiculo_id = any(v_veiculo_ids)
    or pm.motorista_id = any(v_motorista_ids)
    or exists (
      select 1
      from public.manutencoes m
      where m.id = pm.manutencao_id
        and m.veiculo_id = any(v_veiculo_ids)
    );

  return jsonb_build_object(
    'vehicles', cardinality(v_veiculo_ids),
    'drivers', cardinality(v_motorista_ids),
    'parts', cardinality(v_peca_ids)
  );
end;
$$;

revoke execute on function public.admin_pode_acessar_peca(uuid) from public, anon;
revoke execute on function public.peca_compativel_com_veiculo(uuid, uuid) from public, anon;
revoke execute on function public.fn_dashboard_admin(date, date, uuid, uuid) from public, anon;
revoke execute on function public.fn_transferir_responsabilidade_admin(text, uuid, uuid) from public, anon;

grant execute on function public.admin_pode_acessar_peca(uuid) to authenticated;
grant execute on function public.peca_compativel_com_veiculo(uuid, uuid) to authenticated;
grant execute on function public.fn_dashboard_admin(date, date, uuid, uuid) to authenticated;
grant execute on function public.fn_transferir_responsabilidade_admin(text, uuid, uuid) to authenticated;
