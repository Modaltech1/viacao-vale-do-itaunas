-- =========================================================
-- TRANSFERENCIA TRANSACIONAL DE RESPONSABILIDADE
-- =========================================================

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
begin
  if not public.eh_admin_global() then
    raise exception 'Somente administradores globais podem transferir responsabilidades';
  end if;

  if p_tipo not in ('vehicle', 'driver') then
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
    'drivers', cardinality(v_motorista_ids)
  );
end;
$$;

revoke execute on function public.fn_transferir_responsabilidade_admin(
  text,
  uuid,
  uuid
) from public, anon;

grant execute on function public.fn_transferir_responsabilidade_admin(
  text,
  uuid,
  uuid
) to authenticated;
