begin;

create or replace function public.fn_criar_manutencao_concluida(
  p_veiculo_id uuid,
  p_tipo_manutencao text,
  p_causa text,
  p_aberto_em timestamptz,
  p_concluido_em timestamptz,
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
  v_veiculo public.veiculos%rowtype;
  v_id uuid;
  v_item jsonb;
  v_peca public.pecas%rowtype;
  v_peca_id uuid;
  v_quantidade numeric;
  v_valor_unitario numeric;
  v_saldo_anterior numeric;
  v_servico_item jsonb;
  v_servico_id uuid;
  v_servico_valor numeric;
  v_servico public.servicos%rowtype;
  v_ultima_manutencao public.manutencoes%rowtype;
begin
  if not public.eh_admin() then
    raise exception 'Somente administradores podem cadastrar uma manutenção concluída';
  end if;
  if p_status <> 'concluida' then
    raise exception 'A manutenção histórica deve ser cadastrada como concluída';
  end if;
  if p_tipo_manutencao not in ('preventiva', 'corretiva') then
    raise exception 'Tipo de manutenção inválido';
  end if;
  if nullif(trim(p_causa), '') is null then
    raise exception 'Informe a causa da manutenção';
  end if;
  if p_aberto_em is null then
    raise exception 'Informe a data de abertura';
  end if;
  if p_concluido_em is null then
    raise exception 'Informe a data de conclusão';
  end if;
  if p_concluido_em < p_aberto_em then
    raise exception 'A conclusão não pode ser anterior à abertura da manutenção';
  end if;
  if p_concluido_em > now() then
    raise exception 'A data de conclusão não pode estar no futuro';
  end if;
  if p_km_veiculo < 0 then
    raise exception 'KM da manutenção inválido';
  end if;
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
  into v_veiculo
  from public.veiculos
  where id = p_veiculo_id
    and excluido_em is null
  for update;

  if not found then
    raise exception 'Veículo não encontrado';
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
    where id in (
      select (item->>'serviceId')::uuid
      from jsonb_array_elements(p_servicos) item
    )
      and ativo = true
      and excluido_em is null
  ) <> jsonb_array_length(p_servicos) then
    raise exception 'Um ou mais serviços não estão disponíveis';
  end if;

  insert into public.manutencoes (
    veiculo_id, tipo_manutencao, causa, aberto_em, concluido_em,
    km_veiculo, mecanico_responsavel_id, status, valor_total_informado,
    observacoes, criado_por, atualizado_por
  ) values (
    p_veiculo_id, p_tipo_manutencao, trim(p_causa), p_aberto_em,
    p_concluido_em, p_km_veiculo, p_mecanico_responsavel_id,
    'concluida', null, nullif(trim(p_observacoes), ''),
    auth.uid(), auth.uid()
  )
  returning id into v_id;

  for v_servico_item in
    select value
    from jsonb_array_elements(p_servicos)
  loop
    begin
      v_servico_id := (v_servico_item->>'serviceId')::uuid;
      v_servico_valor := (v_servico_item->>'appliedValue')::numeric;
    exception when others then
      raise exception 'Dados de serviço inválidos';
    end;

    if v_servico_id is null or v_servico_valor is null or v_servico_valor < 0 then
      raise exception 'Valor do serviço inválido';
    end if;

    insert into public.manutencao_servicos (
      manutencao_id, servico_id, nome_servico_snapshot,
      categoria_snapshot, valor_aplicado, criado_por, atualizado_por
    )
    select
      v_id, s.id, s.nome, s.categoria, v_servico_valor,
      auth.uid(), auth.uid()
    from public.servicos s
    where s.id = v_servico_id;
  end loop;

  insert into public.manutencao_mecanicos (
    manutencao_id, mecanico_id, papel, criado_por
  ) values (
    v_id, p_mecanico_responsavel_id, 'responsavel', auth.uid()
  );

  for v_item in
    select value
    from jsonb_array_elements(coalesce(p_pecas, '[]'::jsonb))
  loop
    begin
      v_peca_id := (v_item->>'partId')::uuid;
      v_quantidade := (v_item->>'quantity')::numeric;
      v_valor_unitario := (v_item->>'unitValue')::numeric;
    exception when others then
      raise exception 'Dados de peça inválidos';
    end;

    if v_peca_id is null
      or v_quantidade is null
      or v_valor_unitario is null
      or v_quantidade <= 0
      or v_valor_unitario < 0 then
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
      manutencao_id, peca_id, codigo_snapshot, nome_snapshot,
      unidade_snapshot, quantidade, valor_unitario,
      criado_por, atualizado_por
    ) values (
      v_id, v_peca.id, v_peca.codigo, v_peca.nome,
      v_peca.unidade_medida, v_quantidade, v_valor_unitario,
      auth.uid(), auth.uid()
    );

    insert into public.estoque_movimentacoes (
      peca_id, manutencao_id, tipo, quantidade,
      valor_unitario_snapshot, saldo_anterior, saldo_posterior,
      observacoes, criado_por
    ) values (
      v_peca.id, v_id, 'consumo_manutencao', v_quantidade,
      v_valor_unitario, v_saldo_anterior,
      v_saldo_anterior - v_quantidade,
      'Consumo registrado em manutenção histórica', auth.uid()
    );
  end loop;

  update public.veiculos
  set km_atual = greatest(km_atual, p_km_veiculo),
      atualizado_por = auth.uid()
  where id = p_veiculo_id;

  for v_servico_id in
    select ms.servico_id
    from public.manutencao_servicos ms
    where ms.manutencao_id = v_id
  loop
    select m.*
    into v_ultima_manutencao
    from public.manutencoes m
    join public.manutencao_servicos ms
      on ms.manutencao_id = m.id
    where m.veiculo_id = p_veiculo_id
      and m.status = 'concluida'
      and ms.servico_id = v_servico_id
    order by m.concluido_em desc, m.id desc
    limit 1;

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

  return v_id;
end;
$$;

revoke execute on function public.fn_criar_manutencao_concluida(
  uuid, text, text, timestamptz, timestamptz, numeric,
  uuid, text, text, jsonb, jsonb
) from public, anon;

grant execute on function public.fn_criar_manutencao_concluida(
  uuid, text, text, timestamptz, timestamptz, numeric,
  uuid, text, text, jsonb, jsonb
) to authenticated;

commit;
