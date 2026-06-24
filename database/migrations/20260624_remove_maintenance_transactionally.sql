-- Remove uma manutencao e recompõe os efeitos operacionais em uma unica transacao.
-- A funcao devolve estoque, recalcula programacoes recorrentes e registra auditoria.

create or replace function public.fn_recalcular_programacao_servico_veiculo(
  p_veiculo_id uuid,
  p_servico_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_servico public.servicos%rowtype;
  v_ultima_manutencao public.manutencoes%rowtype;
begin
  if p_veiculo_id is null or p_servico_id is null then
    return;
  end if;

  select *
    into v_servico
    from public.servicos
    where id = p_servico_id;

  if not found then
    delete from public.veiculo_servico_programacoes
      where veiculo_id = p_veiculo_id
        and servico_id = p_servico_id;
    return;
  end if;

  select m.*
    into v_ultima_manutencao
    from public.manutencoes m
    join public.manutencao_servicos ms on ms.manutencao_id = m.id
    where m.veiculo_id = p_veiculo_id
      and m.status = 'concluida'
      and m.concluido_em is not null
      and ms.servico_id = p_servico_id
    order by m.concluido_em desc, m.criado_em desc, m.id desc
    limit 1;

  if not found then
    delete from public.veiculo_servico_programacoes
      where veiculo_id = p_veiculo_id
        and servico_id = p_servico_id;
    return;
  end if;

  insert into public.veiculo_servico_programacoes (
    veiculo_id,
    servico_id,
    periodicidade_tipo_snapshot,
    periodicidade_km_snapshot,
    periodicidade_dias_snapshot,
    ultimo_realizado_manutencao_id,
    ultimo_realizado_em,
    ultimo_realizado_km,
    proximo_vencimento_em,
    proximo_vencimento_km,
    criado_por,
    atualizado_por
  ) values (
    p_veiculo_id,
    p_servico_id,
    v_servico.tipo_periodicidade,
    v_servico.periodicidade_km,
    v_servico.periodicidade_dias,
    v_ultima_manutencao.id,
    v_ultima_manutencao.concluido_em::date,
    v_ultima_manutencao.km_veiculo,
    case
      when v_servico.tipo_periodicidade = 'tempo'
      then v_ultima_manutencao.concluido_em::date + v_servico.periodicidade_dias
      else null
    end,
    case
      when v_servico.tipo_periodicidade = 'km'
      then v_ultima_manutencao.km_veiculo + v_servico.periodicidade_km
      else null
    end,
    auth.uid(),
    auth.uid()
  )
  on conflict (veiculo_id, servico_id) where excluido_em is null do update set
    periodicidade_tipo_snapshot = excluded.periodicidade_tipo_snapshot,
    periodicidade_km_snapshot = excluded.periodicidade_km_snapshot,
    periodicidade_dias_snapshot = excluded.periodicidade_dias_snapshot,
    ultimo_realizado_manutencao_id = excluded.ultimo_realizado_manutencao_id,
    ultimo_realizado_em = excluded.ultimo_realizado_em,
    ultimo_realizado_km = excluded.ultimo_realizado_km,
    proximo_vencimento_em = excluded.proximo_vencimento_em,
    proximo_vencimento_km = excluded.proximo_vencimento_km,
    atualizado_por = auth.uid(),
    atualizado_em = now();
end;
$$;

create or replace function public.fn_remover_manutencao(
  p_manutencao_id uuid,
  p_motivo text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_manutencao public.manutencoes%rowtype;
  v_peca public.pecas%rowtype;
  v_item public.manutencao_pecas%rowtype;
  v_servico_id uuid;
  v_servicos_afetados uuid[];
  v_servicos_removidos integer := 0;
  v_pecas_removidas integer := 0;
  v_pendencias_canceladas integer := 0;
  v_itens_estoque_devolvidos integer := 0;
  v_quantidade_estoque_devolvida numeric := 0;
  v_valor_servicos numeric := 0;
  v_valor_pecas numeric := 0;
  v_saldo_anterior numeric;
begin
  if not public.perfil_ativo() then
    raise exception 'Perfil inativo ou nao autenticado';
  end if;

  if not public.eh_admin() then
    raise exception 'Somente administradores podem remover manutencoes';
  end if;

  if nullif(btrim(coalesce(p_motivo, '')), '') is null
    or length(btrim(p_motivo)) < 5
  then
    raise exception 'Informe um motivo com pelo menos 5 caracteres para remover a manutencao';
  end if;

  select *
    into v_manutencao
    from public.manutencoes
    where id = p_manutencao_id
    for update;

  if not found then
    raise exception 'Manutencao nao encontrada';
  end if;

  if not public.admin_pode_acessar_veiculo(v_manutencao.veiculo_id) then
    raise exception 'Sem permissao para remover esta manutencao';
  end if;

  select
    coalesce(array_agg(distinct servico_id), '{}'::uuid[]),
    count(*)::integer,
    coalesce(sum(valor_aplicado), 0)
    into v_servicos_afetados, v_servicos_removidos, v_valor_servicos
    from public.manutencao_servicos
    where manutencao_id = p_manutencao_id;

  select count(*)::integer, coalesce(sum(valor_total), 0)
    into v_pecas_removidas, v_valor_pecas
    from public.manutencao_pecas
    where manutencao_id = p_manutencao_id;

  for v_item in
    select *
      from public.manutencao_pecas
      where manutencao_id = p_manutencao_id
        and estoque_devolvido_em is null
      order by id
      for update
  loop
    select *
      into v_peca
      from public.pecas
      where id = v_item.peca_id
      for update;

    if not found then
      raise exception 'Peca vinculada a manutencao nao encontrada';
    end if;

    v_saldo_anterior := v_peca.quantidade_estoque;

    update public.pecas
      set quantidade_estoque = quantidade_estoque + v_item.quantidade,
          atualizado_por = auth.uid()
      where id = v_item.peca_id;

    insert into public.estoque_movimentacoes (
      peca_id,
      manutencao_id,
      tipo,
      quantidade,
      valor_unitario_snapshot,
      saldo_anterior,
      saldo_posterior,
      observacoes,
      criado_por
    ) values (
      v_item.peca_id,
      p_manutencao_id,
      'devolucao_cancelamento',
      v_item.quantidade,
      v_item.valor_unitario,
      v_saldo_anterior,
      v_saldo_anterior + v_item.quantidade,
      'Devolucao automatica por remocao da manutencao',
      auth.uid()
    );

    v_itens_estoque_devolvidos := v_itens_estoque_devolvidos + 1;
    v_quantidade_estoque_devolvida := v_quantidade_estoque_devolvida + v_item.quantidade;
  end loop;

  update public.pendencias_manuais
    set status = 'cancelada',
        manutencao_id = null,
        observacoes_resolucao = trim(
          both E'\n' from concat_ws(
            E'\n',
            observacoes_resolucao,
            'Cancelada automaticamente por remocao da manutencao.'
          )
        ),
        atualizado_por = auth.uid()
    where manutencao_id = p_manutencao_id
      and status = 'aberta';

  get diagnostics v_pendencias_canceladas = row_count;

  update public.pendencias_manuais
    set manutencao_id = null,
        atualizado_por = auth.uid()
    where manutencao_id = p_manutencao_id;

  delete from public.manutencao_pecas
    where manutencao_id = p_manutencao_id;

  delete from public.manutencao_servicos
    where manutencao_id = p_manutencao_id;

  delete from public.manutencao_mecanicos
    where manutencao_id = p_manutencao_id;

  delete from public.manutencoes
    where id = p_manutencao_id;

  foreach v_servico_id in array coalesce(v_servicos_afetados, '{}'::uuid[])
  loop
    perform public.fn_recalcular_programacao_servico_veiculo(
      v_manutencao.veiculo_id,
      v_servico_id
    );
  end loop;

  if not exists (
    select 1
      from public.manutencoes
      where veiculo_id = v_manutencao.veiculo_id
        and status in ('aberta', 'em_andamento')
  ) then
    update public.veiculos
      set status_operacional = 'ativo',
          atualizado_por = auth.uid()
      where id = v_manutencao.veiculo_id
        and status_operacional = 'em_manutencao';
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
    'manutencoes',
    p_manutencao_id,
    'remover_manutencao',
    to_jsonb(v_manutencao),
    jsonb_build_object(
      'servicos_removidos', v_servicos_removidos,
      'pecas_removidas', v_pecas_removidas,
      'pendencias_canceladas', v_pendencias_canceladas,
      'itens_estoque_devolvidos', v_itens_estoque_devolvidos,
      'quantidade_estoque_devolvida', v_quantidade_estoque_devolvida,
      'valor_servicos', v_valor_servicos,
      'valor_pecas', v_valor_pecas,
      'programacoes_recalculadas', coalesce(array_length(v_servicos_afetados, 1), 0)
    ),
    btrim(p_motivo),
    auth.uid()
  );

  return jsonb_build_object(
    'manutencao_id', p_manutencao_id,
    'servicos_removidos', v_servicos_removidos,
    'pecas_removidas', v_pecas_removidas,
    'pendencias_canceladas', v_pendencias_canceladas,
    'itens_estoque_devolvidos', v_itens_estoque_devolvidos,
    'quantidade_estoque_devolvida', v_quantidade_estoque_devolvida,
    'programacoes_recalculadas', coalesce(array_length(v_servicos_afetados, 1), 0)
  );
end;
$$;

revoke execute on function public.fn_recalcular_programacao_servico_veiculo(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.fn_remover_manutencao(uuid, text) from public, anon;
grant execute on function public.fn_remover_manutencao(uuid, text) to authenticated;
