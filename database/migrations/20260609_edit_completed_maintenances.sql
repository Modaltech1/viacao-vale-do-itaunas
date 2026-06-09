begin;

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
  p_servico_ids uuid[],
  p_pecas jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_manutencao public.manutencoes%rowtype;
  v_item public.manutencao_pecas%rowtype;
  v_peca public.pecas%rowtype;
  v_servico public.servicos%rowtype;
  v_ultima_manutencao public.manutencoes%rowtype;
  v_peca_json jsonb;
  v_peca_id uuid;
  v_servico_id uuid;
  v_quantidade numeric;
  v_valor_unitario numeric;
  v_saldo_anterior numeric;
  v_servicos_anteriores uuid[];
  v_servicos_afetados uuid[];
begin
  if not public.eh_admin() then
    raise exception 'Somente administradores podem editar uma manutenção concluída';
  end if;
  if p_manutencao_id is null then
    raise exception 'Manutenção inválida';
  end if;
  if p_status <> 'concluida' then
    raise exception 'O status da manutenção concluída não pode ser alterado';
  end if;
  if p_tipo_manutencao not in ('preventiva', 'corretiva') then
    raise exception 'Tipo de manutenção inválido';
  end if;
  if nullif(trim(p_causa), '') is null then
    raise exception 'Informe a causa da manutenção';
  end if;
  if p_km_veiculo < 0 then
    raise exception 'KM da manutenção inválido';
  end if;
  if coalesce(array_length(p_servico_ids, 1), 0) = 0 then
    raise exception 'Selecione pelo menos um serviço';
  end if;
  if jsonb_typeof(coalesce(p_pecas, '[]'::jsonb)) <> 'array' then
    raise exception 'Lista de peças inválida';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_pecas, '[]'::jsonb)) item
    group by item->>'partId'
    having count(*) > 1
  ) then
    raise exception 'A mesma peça não pode ser informada mais de uma vez';
  end if;

  select *
  into v_manutencao
  from public.manutencoes
  where id = p_manutencao_id
  for update;

  if not found then
    raise exception 'Manutenção não encontrada';
  end if;
  if v_manutencao.status <> 'concluida' then
    raise exception 'Esta rotina edita somente manutenções concluídas';
  end if;
  if v_manutencao.veiculo_id <> p_veiculo_id then
    raise exception 'O veículo de uma manutenção concluída não pode ser alterado';
  end if;
  if not exists (
    select 1
    from public.mecanicos
    where id = p_mecanico_responsavel_id
      and status_profissional = 'ativo'
      and excluido_em is null
  ) then
    raise exception 'Mecânico responsável inválido';
  end if;
  if (
    select count(*)
    from public.servicos
    where id = any(p_servico_ids)
      and ativo = true
      and excluido_em is null
  ) <> cardinality(p_servico_ids) then
    raise exception 'Um ou mais serviços não estão disponíveis';
  end if;

  select coalesce(array_agg(servico_id), '{}'::uuid[])
  into v_servicos_anteriores
  from public.manutencao_servicos
  where manutencao_id = p_manutencao_id;

  for v_item in
    select *
    from public.manutencao_pecas
    where manutencao_id = p_manutencao_id
      and estoque_devolvido_em is null
    for update
  loop
    select *
    into v_peca
    from public.pecas
    where id = v_item.peca_id
    for update;

    v_saldo_anterior := v_peca.quantidade_estoque;

    update public.pecas
    set quantidade_estoque = quantidade_estoque + v_item.quantidade,
        atualizado_por = auth.uid()
    where id = v_item.peca_id;

    insert into public.estoque_movimentacoes (
      peca_id, manutencao_id, tipo, quantidade, valor_unitario_snapshot,
      saldo_anterior, saldo_posterior, observacoes, criado_por
    ) values (
      v_item.peca_id, p_manutencao_id, 'devolucao_edicao',
      v_item.quantidade, v_item.valor_unitario, v_saldo_anterior,
      v_saldo_anterior + v_item.quantidade,
      'Devolução para correção de manutenção concluída', auth.uid()
    );
  end loop;

  delete from public.manutencao_pecas
  where manutencao_id = p_manutencao_id;

  update public.manutencoes
  set tipo_manutencao = p_tipo_manutencao,
      causa = trim(p_causa),
      aberto_em = p_aberto_em,
      km_veiculo = p_km_veiculo,
      mecanico_responsavel_id = p_mecanico_responsavel_id,
      observacoes = nullif(trim(p_observacoes), ''),
      valor_total_informado = null,
      atualizado_por = auth.uid()
  where id = p_manutencao_id;

  delete from public.manutencao_servicos
  where manutencao_id = p_manutencao_id;

  insert into public.manutencao_servicos (
    manutencao_id, servico_id, nome_servico_snapshot, categoria_snapshot,
    criado_por, atualizado_por
  )
  select p_manutencao_id, s.id, s.nome, s.categoria, auth.uid(), auth.uid()
  from public.servicos s
  where s.id = any(p_servico_ids);

  delete from public.manutencao_mecanicos
  where manutencao_id = p_manutencao_id
    and papel = 'responsavel';

  insert into public.manutencao_mecanicos (
    manutencao_id, mecanico_id, papel, criado_por
  ) values (
    p_manutencao_id, p_mecanico_responsavel_id, 'responsavel', auth.uid()
  );

  for v_peca_json in
    select value
    from jsonb_array_elements(coalesce(p_pecas, '[]'::jsonb))
  loop
    begin
      v_peca_id := (v_peca_json->>'partId')::uuid;
      v_quantidade := (v_peca_json->>'quantity')::numeric;
      v_valor_unitario := (v_peca_json->>'unitValue')::numeric;
    exception when others then
      raise exception 'Dados de peça inválidos';
    end;

    if v_quantidade <= 0 or v_valor_unitario < 0 then
      raise exception 'Quantidade e valor da peça são inválidos';
    end if;

    select *
    into v_peca
    from public.pecas
    where id = v_peca_id
      and ativo = true
      and excluido_em is null
    for update;

    if not found then
      raise exception 'Peça não encontrada ou inativa';
    end if;
    if v_peca.unidade_medida not in ('litro', 'metro')
      and v_quantidade <> trunc(v_quantidade) then
      raise exception 'A quantidade da peça % deve ser um número inteiro', v_peca.nome;
    end if;
    if v_peca.quantidade_estoque < v_quantidade then
      raise exception 'Estoque insuficiente para a peça %', v_peca.nome;
    end if;

    v_saldo_anterior := v_peca.quantidade_estoque;

    update public.pecas
    set quantidade_estoque = quantidade_estoque - v_quantidade,
        atualizado_por = auth.uid()
    where id = v_peca.id;

    insert into public.manutencao_pecas (
      manutencao_id, peca_id, codigo_snapshot, nome_snapshot, unidade_snapshot,
      quantidade, valor_unitario, criado_por, atualizado_por
    ) values (
      p_manutencao_id, v_peca.id, v_peca.codigo, v_peca.nome,
      v_peca.unidade_medida, v_quantidade, v_valor_unitario,
      auth.uid(), auth.uid()
    );

    insert into public.estoque_movimentacoes (
      peca_id, manutencao_id, tipo, quantidade, valor_unitario_snapshot,
      saldo_anterior, saldo_posterior, observacoes, criado_por
    ) values (
      v_peca.id, p_manutencao_id, 'consumo_manutencao',
      v_quantidade, v_valor_unitario, v_saldo_anterior,
      v_saldo_anterior - v_quantidade,
      'Consumo corrigido na manutenção concluída', auth.uid()
    );
  end loop;

  update public.veiculos
  set km_atual = greatest(km_atual, p_km_veiculo),
      atualizado_por = auth.uid()
  where id = p_veiculo_id;

  select array_agg(distinct servico_id)
  into v_servicos_afetados
  from unnest(v_servicos_anteriores || p_servico_ids) as servico_id;

  foreach v_servico_id in array coalesce(v_servicos_afetados, '{}'::uuid[])
  loop
    select m.*
    into v_ultima_manutencao
    from public.manutencoes m
    join public.manutencao_servicos ms on ms.manutencao_id = m.id
    where m.veiculo_id = p_veiculo_id
      and m.status = 'concluida'
      and ms.servico_id = v_servico_id
    order by m.concluido_em desc, m.id desc
    limit 1;

    if not found then
      delete from public.veiculo_servico_programacoes
      where veiculo_id = p_veiculo_id
        and servico_id = v_servico_id;
      continue;
    end if;

    select *
    into v_servico
    from public.servicos
    where id = v_servico_id;

    insert into public.veiculo_servico_programacoes (
      veiculo_id, servico_id, periodicidade_tipo_snapshot,
      periodicidade_km_snapshot, periodicidade_dias_snapshot,
      ultimo_realizado_manutencao_id, ultimo_realizado_em,
      ultimo_realizado_km, proximo_vencimento_em, proximo_vencimento_km,
      criado_por
    ) values (
      p_veiculo_id, v_servico_id, v_servico.tipo_periodicidade,
      v_servico.periodicidade_km, v_servico.periodicidade_dias,
      v_ultima_manutencao.id, v_ultima_manutencao.concluido_em::date,
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
      auth.uid()
    )
    on conflict (veiculo_id, servico_id) where excluido_em is null
    do update set
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
  end loop;

  return p_manutencao_id;
end;
$$;

revoke execute on function public.fn_editar_manutencao_concluida(
  uuid, uuid, text, text, timestamptz, numeric, uuid, text, text, uuid[], jsonb
) from public, anon;

grant execute on function public.fn_editar_manutencao_concluida(
  uuid, uuid, text, text, timestamptz, numeric, uuid, text, text, uuid[], jsonb
) to authenticated;

commit;
