create or replace function public.impedir_regressao_km_veiculo()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
    and new.km_atual < old.km_atual
    and coalesce(current_setting('app.permitir_correcao_km_veiculo', true), '') <> 'on'
  then
    raise exception 'km_atual do veiculo nao pode regredir sem correcao auditada. Valor antigo: %, novo: %', old.km_atual, new.km_atual;
  end if;
  return new;
end;
$$;

create or replace function public.fn_corrigir_viagem_concluida(
  p_viagem_id uuid,
  p_km_final numeric,
  p_chegou_em timestamptz,
  p_origem text,
  p_destino text,
  p_observacoes text default null
)
returns public.viagens
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_viagem_antes public.viagens%rowtype;
  v_viagem_depois public.viagens%rowtype;
  v_ultimo_km_abastecimento numeric;
  v_ultimo_abastecimento_em timestamptz;
  v_km_atual_corrigido numeric;
  v_tem_viagem_posterior boolean;
begin
  if not public.perfil_ativo() then
    raise exception 'Perfil inativo ou nao autenticado';
  end if;

  if not public.eh_admin() then
    raise exception 'Somente administradores podem corrigir viagens concluidas';
  end if;

  select * into v_viagem_antes
    from public.viagens
    where id = p_viagem_id
    for update;

  if not found then
    raise exception 'Viagem nao encontrada';
  end if;

  if v_viagem_antes.status <> 'concluida' then
    raise exception 'Somente viagens concluidas podem ter KM final corrigido';
  end if;

  if not public.admin_pode_acessar_veiculo(v_viagem_antes.veiculo_id) then
    raise exception 'Sem permissao para corrigir esta viagem';
  end if;

  if p_km_final is null or p_km_final < 0 then
    raise exception 'KM final deve ser maior ou igual a zero';
  end if;

  if p_chegou_em is null then
    raise exception 'Data de chegada invalida';
  end if;

  if nullif(btrim(coalesce(p_origem, '')), '') is null
    or nullif(btrim(coalesce(p_destino, '')), '') is null
  then
    raise exception 'Origem e destino sao obrigatorios';
  end if;

  select max(km_registrado), max(registrado_em)
    into v_ultimo_km_abastecimento, v_ultimo_abastecimento_em
    from public.abastecimentos
    where viagem_id = p_viagem_id
      and cancelado_em is null;

  if p_km_final < greatest(v_viagem_antes.km_inicial, coalesce(v_ultimo_km_abastecimento, v_viagem_antes.km_inicial)) then
    raise exception 'KM final nao pode ser menor que o ultimo KM registrado na viagem';
  end if;

  if p_chegou_em < v_viagem_antes.saiu_em then
    raise exception 'Data de chegada nao pode ser anterior a data de saida';
  end if;

  if v_ultimo_abastecimento_em is not null and p_chegou_em < v_ultimo_abastecimento_em then
    raise exception 'Data de chegada nao pode ser anterior ao ultimo abastecimento da viagem';
  end if;

  select exists(
    select 1
      from public.viagens posterior
      where posterior.veiculo_id = v_viagem_antes.veiculo_id
        and posterior.id <> v_viagem_antes.id
        and posterior.status <> 'cancelada'
        and (
          posterior.saiu_em > v_viagem_antes.saiu_em
          or (
            posterior.saiu_em = v_viagem_antes.saiu_em
            and posterior.criado_em > v_viagem_antes.criado_em
          )
        )
  ) into v_tem_viagem_posterior;

  if v_tem_viagem_posterior then
    raise exception 'Somente a ultima viagem do veiculo pode ter KM final corrigido';
  end if;

  update public.viagens
    set origem_snapshot = btrim(p_origem),
        destino_snapshot = btrim(p_destino),
        km_final = p_km_final,
        chegou_em = p_chegou_em,
        observacoes = p_observacoes,
        atualizado_por = auth.uid()
    where id = p_viagem_id
    returning * into v_viagem_depois;

  select greatest(
    coalesce((
      select max(coalesce(vi.km_final, vi.km_inicial))
        from public.viagens vi
        where vi.veiculo_id = v_viagem_depois.veiculo_id
          and vi.status <> 'cancelada'
    ), 0),
    coalesce((
      select max(a.km_registrado)
        from public.abastecimentos a
        where a.veiculo_id = v_viagem_depois.veiculo_id
          and a.cancelado_em is null
    ), 0),
    coalesce((
      select max(m.km_veiculo)
        from public.manutencoes m
        where m.veiculo_id = v_viagem_depois.veiculo_id
          and m.status <> 'cancelada'
    ), 0)
  ) into v_km_atual_corrigido;

  perform set_config('app.permitir_correcao_km_veiculo', 'on', true);

  update public.veiculos
    set km_atual = v_km_atual_corrigido,
        atualizado_por = auth.uid()
    where id = v_viagem_depois.veiculo_id;

  insert into public.auditoria_eventos (
    tabela,
    registro_id,
    acao,
    dados_antes,
    dados_depois,
    motivo,
    criado_por
  ) values (
    'viagens',
    p_viagem_id,
    'corrigir_km_final',
    to_jsonb(v_viagem_antes),
    to_jsonb(v_viagem_depois),
    'Correcao administrativa de encerramento da ultima viagem do veiculo',
    auth.uid()
  );

  return v_viagem_depois;
end;
$$;

revoke execute on function public.fn_corrigir_viagem_concluida(uuid, numeric, timestamptz, text, text, text) from public, anon;
grant execute on function public.fn_corrigir_viagem_concluida(uuid, numeric, timestamptz, text, text, text) to authenticated;
