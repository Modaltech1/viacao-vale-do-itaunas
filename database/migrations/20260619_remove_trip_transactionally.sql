-- Remove uma viagem e seus registros operacionais dependentes em uma unica transacao.
-- O historico de estoque e a auditoria sao preservados como trilha contabil.

create or replace function public.fn_remover_viagem(
  p_viagem_id uuid,
  p_motivo text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_viagem public.viagens%rowtype;
  v_veiculo public.veiculos%rowtype;
  v_peca public.pecas%rowtype;
  v_item record;
  v_abastecimentos_removidos integer;
  v_despesas_removidas integer;
  v_itens_estoque_devolvidos integer := 0;
  v_quantidade_estoque_devolvida numeric := 0;
  v_saldo_anterior numeric;
  v_km_referencia_antes numeric;
  v_km_atual_depois numeric;
  v_recalcular_km boolean;
begin
  if not public.perfil_ativo() then
    raise exception 'Perfil inativo ou nao autenticado';
  end if;

  if not public.eh_admin() then
    raise exception 'Somente administradores podem remover viagens';
  end if;

  if nullif(btrim(coalesce(p_motivo, '')), '') is null
    or length(btrim(p_motivo)) < 5
  then
    raise exception 'Informe um motivo com pelo menos 5 caracteres para remover a viagem';
  end if;

  select *
    into v_viagem
    from public.viagens
    where id = p_viagem_id
    for update;

  if not found then
    raise exception 'Viagem nao encontrada';
  end if;

  if not public.admin_pode_acessar_veiculo(v_viagem.veiculo_id) then
    raise exception 'Sem permissao para remover esta viagem';
  end if;

  select *
    into v_veiculo
    from public.veiculos
    where id = v_viagem.veiculo_id
    for update;

  if not found then
    raise exception 'Veiculo da viagem nao encontrado';
  end if;

  select count(*)
    into v_abastecimentos_removidos
    from public.abastecimentos
    where viagem_id = p_viagem_id;

  select count(*)
    into v_despesas_removidas
    from public.despesas_viagem
    where viagem_id = p_viagem_id;

  v_km_referencia_antes := public.fn_km_referencia_atual_veiculo(v_viagem.veiculo_id);
  v_recalcular_km := v_veiculo.km_atual = v_km_referencia_antes;

  for v_item in
    select
      dp.id,
      dp.despesa_id,
      dp.peca_id,
      dp.quantidade,
      dp.valor_unitario
    from public.despesa_pecas dp
    join public.despesas_viagem d on d.id = dp.despesa_id
    where d.viagem_id = p_viagem_id
      and dp.estoque_devolvido_em is null
    order by dp.id
    for update of dp
  loop
    select *
      into v_peca
      from public.pecas
      where id = v_item.peca_id
      for update;

    if not found then
      raise exception 'Peca vinculada a despesa da viagem nao encontrada';
    end if;

    v_saldo_anterior := v_peca.quantidade_estoque;

    update public.pecas
      set quantidade_estoque = quantidade_estoque + v_item.quantidade,
          atualizado_por = auth.uid()
      where id = v_item.peca_id;

    insert into public.estoque_movimentacoes (
      peca_id,
      despesa_id,
      tipo,
      quantidade,
      valor_unitario_snapshot,
      saldo_anterior,
      saldo_posterior,
      observacoes,
      criado_por
    ) values (
      v_item.peca_id,
      v_item.despesa_id,
      'devolucao_cancelamento_despesa',
      v_item.quantidade,
      v_item.valor_unitario,
      v_saldo_anterior,
      v_saldo_anterior + v_item.quantidade,
      'Devolucao automatica por remocao da viagem',
      auth.uid()
    );

    v_itens_estoque_devolvidos := v_itens_estoque_devolvidos + 1;
    v_quantidade_estoque_devolvida := v_quantidade_estoque_devolvida + v_item.quantidade;
  end loop;

  delete from public.abastecimentos
    where viagem_id = p_viagem_id;

  delete from public.despesas_viagem
    where viagem_id = p_viagem_id;

  delete from public.viagens
    where id = p_viagem_id;

  if v_recalcular_km then
    v_km_atual_depois := greatest(
      public.fn_km_referencia_atual_veiculo(v_viagem.veiculo_id),
      v_viagem.km_inicial
    );

    perform set_config('app.permitir_correcao_km_veiculo', 'on', true);

    update public.veiculos
      set km_atual = v_km_atual_depois,
          atualizado_por = auth.uid()
      where id = v_viagem.veiculo_id;
  else
    v_km_atual_depois := v_veiculo.km_atual;
  end if;

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
    'remover_viagem',
    to_jsonb(v_viagem),
    jsonb_build_object(
      'abastecimentos_removidos', v_abastecimentos_removidos,
      'despesas_removidas', v_despesas_removidas,
      'itens_estoque_devolvidos', v_itens_estoque_devolvidos,
      'quantidade_estoque_devolvida', v_quantidade_estoque_devolvida,
      'km_veiculo_antes', v_veiculo.km_atual,
      'km_veiculo_depois', v_km_atual_depois
    ),
    btrim(p_motivo),
    auth.uid()
  );

  return jsonb_build_object(
    'viagem_id', p_viagem_id,
    'abastecimentos_removidos', v_abastecimentos_removidos,
    'despesas_removidas', v_despesas_removidas,
    'itens_estoque_devolvidos', v_itens_estoque_devolvidos,
    'quantidade_estoque_devolvida', v_quantidade_estoque_devolvida,
    'km_veiculo', v_km_atual_depois
  );
end;
$$;

revoke execute on function public.fn_remover_viagem(uuid, text) from public, anon;
grant execute on function public.fn_remover_viagem(uuid, text) to authenticated;
