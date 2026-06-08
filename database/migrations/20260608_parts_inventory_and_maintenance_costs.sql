-- Catálogo de peças, estoque e custo de manutenção por consumo real.

alter table public.despesas_viagem
  drop constraint if exists despesas_viagem_categoria_check;
alter table public.despesas_viagem
  add constraint despesas_viagem_categoria_check
  check (categoria in ('Pedágio','Alimentação','Hospedagem','Descarga','Peças','Outros'));

create table if not exists public.pecas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  codigo_normalizado text generated always as (public.normalizar_texto(codigo)) stored,
  nome text not null,
  categoria text not null,
  unidade_medida text not null default 'unidade',
  quantidade_estoque numeric(14,3) not null default 0,
  estoque_minimo numeric(14,3) not null default 0,
  valor_unitario numeric(12,2) not null default 0,
  descricao text,
  ativo boolean not null default true,
  excluido_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references public.perfis(id) on delete set null,
  atualizado_por uuid references public.perfis(id) on delete set null,
  constraint pecas_categoria_check check (
    categoria in ('Motor','Freios','Suspensão','Elétrica','Transmissão','Pneus','Filtros','Lubrificantes','Outros')
  ),
  constraint pecas_unidade_check check (
    unidade_medida in ('unidade','litro','kit','metro','par')
  ),
  constraint pecas_quantidade_check check (quantidade_estoque >= 0 and estoque_minimo >= 0),
  constraint pecas_valor_check check (valor_unitario >= 0)
);

create unique index if not exists pecas_codigo_normalizado_uniq
  on public.pecas(codigo_normalizado)
  where excluido_em is null;

create table if not exists public.manutencao_pecas (
  id uuid primary key default gen_random_uuid(),
  manutencao_id uuid not null references public.manutencoes(id) on delete cascade,
  peca_id uuid not null references public.pecas(id) on delete restrict,
  codigo_snapshot text not null,
  nome_snapshot text not null,
  unidade_snapshot text not null,
  quantidade numeric(14,3) not null,
  valor_unitario numeric(12,2) not null,
  valor_total numeric(14,2) generated always as (round(quantidade * valor_unitario, 2)) stored,
  estoque_devolvido_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references public.perfis(id) on delete set null,
  atualizado_por uuid references public.perfis(id) on delete set null,
  constraint manutencao_pecas_quantidade_check check (quantidade > 0),
  constraint manutencao_pecas_valor_check check (valor_unitario >= 0),
  constraint manutencao_pecas_unica unique (manutencao_id, peca_id)
);

create table if not exists public.despesa_pecas (
  id uuid primary key default gen_random_uuid(),
  despesa_id uuid not null references public.despesas_viagem(id) on delete cascade,
  peca_id uuid not null references public.pecas(id) on delete restrict,
  codigo_snapshot text not null,
  nome_snapshot text not null,
  unidade_snapshot text not null,
  quantidade numeric(14,3) not null,
  valor_unitario numeric(12,2) not null,
  valor_total numeric(14,2) generated always as (round(quantidade * valor_unitario, 2)) stored,
  estoque_devolvido_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references public.perfis(id) on delete set null,
  atualizado_por uuid references public.perfis(id) on delete set null,
  constraint despesa_pecas_quantidade_check check (quantidade > 0),
  constraint despesa_pecas_valor_check check (valor_unitario >= 0),
  constraint despesa_pecas_unica unique (despesa_id, peca_id)
);

create table if not exists public.estoque_movimentacoes (
  id uuid primary key default gen_random_uuid(),
  peca_id uuid not null references public.pecas(id) on delete restrict,
  manutencao_id uuid references public.manutencoes(id) on delete set null,
  despesa_id uuid references public.despesas_viagem(id) on delete set null,
  tipo text not null,
  quantidade numeric(14,3) not null,
  valor_unitario_snapshot numeric(12,2) not null,
  saldo_anterior numeric(14,3) not null,
  saldo_posterior numeric(14,3) not null,
  observacoes text,
  criado_em timestamptz not null default now(),
  criado_por uuid references public.perfis(id) on delete set null,
  constraint estoque_movimentacoes_tipo_check check (
    tipo in (
      'entrada_inicial','ajuste_entrada','ajuste_saida',
      'consumo_manutencao','devolucao_edicao','devolucao_cancelamento',
      'consumo_despesa','devolucao_edicao_despesa','devolucao_cancelamento_despesa'
    )
  ),
  constraint estoque_movimentacoes_quantidade_check check (quantidade > 0),
  constraint estoque_movimentacoes_saldos_check check (saldo_anterior >= 0 and saldo_posterior >= 0)
);

alter table public.estoque_movimentacoes
  add column if not exists despesa_id uuid references public.despesas_viagem(id) on delete set null;
alter table public.estoque_movimentacoes
  drop constraint if exists estoque_movimentacoes_tipo_check;
alter table public.estoque_movimentacoes
  add constraint estoque_movimentacoes_tipo_check check (
    tipo in (
      'entrada_inicial','ajuste_entrada','ajuste_saida',
      'consumo_manutencao','devolucao_edicao','devolucao_cancelamento',
      'consumo_despesa','devolucao_edicao_despesa','devolucao_cancelamento_despesa'
    )
  );

create index if not exists manutencao_pecas_manutencao_idx on public.manutencao_pecas(manutencao_id);
create index if not exists manutencao_pecas_peca_idx on public.manutencao_pecas(peca_id);
create index if not exists despesa_pecas_despesa_idx on public.despesa_pecas(despesa_id);
create index if not exists despesa_pecas_peca_idx on public.despesa_pecas(peca_id);
create index if not exists estoque_movimentacoes_peca_data_idx on public.estoque_movimentacoes(peca_id, criado_em desc);
create index if not exists estoque_movimentacoes_manutencao_idx on public.estoque_movimentacoes(manutencao_id);
create index if not exists estoque_movimentacoes_despesa_idx on public.estoque_movimentacoes(despesa_id);

drop trigger if exists set_pecas_atualizado_em on public.pecas;
create trigger set_pecas_atualizado_em
  before update on public.pecas
  for each row execute function public.set_atualizado_em();

drop trigger if exists set_manutencao_pecas_atualizado_em on public.manutencao_pecas;
create trigger set_manutencao_pecas_atualizado_em
  before update on public.manutencao_pecas
  for each row execute function public.set_atualizado_em();

drop trigger if exists set_despesa_pecas_atualizado_em on public.despesa_pecas;
create trigger set_despesa_pecas_atualizado_em
  before update on public.despesa_pecas
  for each row execute function public.set_atualizado_em();

create or replace function public.fn_salvar_peca(
  p_peca_id uuid,
  p_codigo text,
  p_nome text,
  p_categoria text,
  p_unidade_medida text,
  p_quantidade_estoque numeric,
  p_estoque_minimo numeric,
  p_valor_unitario numeric,
  p_descricao text,
  p_ativo boolean
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_peca public.pecas%rowtype;
  v_id uuid;
  v_diferenca numeric;
begin
  if not public.eh_admin() then
    raise exception 'Somente administradores podem alterar o catálogo de peças';
  end if;
  if nullif(trim(p_codigo), '') is null or nullif(trim(p_nome), '') is null then
    raise exception 'Código e nome da peça são obrigatórios';
  end if;
  if p_quantidade_estoque < 0 or p_estoque_minimo < 0 or p_valor_unitario < 0 then
    raise exception 'Quantidade, estoque mínimo e valor não podem ser negativos';
  end if;
  if p_unidade_medida not in ('litro', 'metro')
    and (p_quantidade_estoque <> trunc(p_quantidade_estoque) or p_estoque_minimo <> trunc(p_estoque_minimo))
  then
    raise exception 'Estoque de unidade, kit e par deve ser informado em números inteiros';
  end if;

  if p_peca_id is null then
    insert into public.pecas (
      codigo, nome, categoria, unidade_medida, quantidade_estoque,
      estoque_minimo, valor_unitario, descricao, ativo, criado_por, atualizado_por
    ) values (
      upper(trim(p_codigo)), trim(p_nome), p_categoria, p_unidade_medida,
      p_quantidade_estoque, p_estoque_minimo, p_valor_unitario,
      nullif(trim(p_descricao), ''), p_ativo, auth.uid(), auth.uid()
    ) returning id into v_id;

    if p_quantidade_estoque > 0 then
      insert into public.estoque_movimentacoes (
        peca_id, tipo, quantidade, valor_unitario_snapshot,
        saldo_anterior, saldo_posterior, observacoes, criado_por
      ) values (
        v_id, 'entrada_inicial', p_quantidade_estoque, p_valor_unitario,
        0, p_quantidade_estoque, 'Saldo inicial do cadastro', auth.uid()
      );
    end if;
    return v_id;
  end if;

  select * into v_peca
  from public.pecas
  where id = p_peca_id and excluido_em is null
  for update;
  if not found then raise exception 'Peça não encontrada'; end if;

  v_diferenca := p_quantidade_estoque - v_peca.quantidade_estoque;

  update public.pecas
  set codigo = upper(trim(p_codigo)),
      nome = trim(p_nome),
      categoria = p_categoria,
      unidade_medida = p_unidade_medida,
      quantidade_estoque = p_quantidade_estoque,
      estoque_minimo = p_estoque_minimo,
      valor_unitario = p_valor_unitario,
      descricao = nullif(trim(p_descricao), ''),
      ativo = p_ativo,
      atualizado_por = auth.uid()
  where id = p_peca_id;

  if v_diferenca <> 0 then
    insert into public.estoque_movimentacoes (
      peca_id, tipo, quantidade, valor_unitario_snapshot,
      saldo_anterior, saldo_posterior, observacoes, criado_por
    ) values (
      p_peca_id,
      case when v_diferenca > 0 then 'ajuste_entrada' else 'ajuste_saida' end,
      abs(v_diferenca),
      p_valor_unitario,
      v_peca.quantidade_estoque,
      p_quantidade_estoque,
      'Ajuste manual pelo cadastro de peças',
      auth.uid()
    );
  end if;

  return p_peca_id;
end;
$$;

create or replace function public.fn_registrar_despesa_viagem(
  p_viagem_id uuid,
  p_categoria text,
  p_valor numeric,
  p_observacoes text default null,
  p_comprovante_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_viagem public.viagens%rowtype;
  v_id uuid;
begin
  if not public.perfil_ativo() then raise exception 'Perfil inativo ou não autenticado'; end if;
  if p_categoria not in ('Pedágio','Alimentação','Hospedagem','Descarga','Outros') then
    raise exception 'Categoria de despesa inválida para registro pelo motorista';
  end if;
  if p_valor is null or p_valor <= 0 then
    raise exception 'O valor da despesa deve ser maior que zero';
  end if;
  select * into v_viagem from public.viagens where id = p_viagem_id;
  if not found then raise exception 'Viagem não encontrada'; end if;
  if not public.eh_admin() and v_viagem.motorista_id <> public.motorista_atual_id() then
    raise exception 'Sem permissão para registrar despesa nesta viagem';
  end if;
  if v_viagem.status <> 'em_andamento' then
    raise exception 'Despesa operacional só pode ser registrada em viagem em andamento';
  end if;

  insert into public.despesas_viagem (
    viagem_id, motorista_id, veiculo_id, categoria, valor,
    observacoes, comprovante_path, criado_por
  ) values (
    p_viagem_id, v_viagem.motorista_id, v_viagem.veiculo_id, p_categoria,
    p_valor, p_observacoes, p_comprovante_path, auth.uid()
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.fn_salvar_despesa(
  p_despesa_id uuid,
  p_viagem_id uuid,
  p_veiculo_id uuid,
  p_motorista_id uuid,
  p_categoria text,
  p_valor numeric,
  p_registrado_em timestamptz,
  p_observacoes text,
  p_comprovante_path text,
  p_pecas jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_despesa public.despesas_viagem%rowtype;
  v_viagem public.viagens%rowtype;
  v_id uuid;
  v_veiculo_id uuid := p_veiculo_id;
  v_motorista_id uuid := p_motorista_id;
  v_valor numeric := p_valor;
  v_item jsonb;
  v_peca public.pecas%rowtype;
  v_peca_id uuid;
  v_quantidade numeric;
  v_valor_unitario numeric;
  v_saldo_anterior numeric;
begin
  if not public.eh_admin() then
    raise exception 'Somente administradores podem salvar despesas administrativas';
  end if;
  if p_categoria not in ('Pedágio','Alimentação','Hospedagem','Descarga','Peças','Outros') then
    raise exception 'Categoria de despesa inválida';
  end if;
  if p_registrado_em is null then raise exception 'Data da despesa é obrigatória'; end if;
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
  if p_categoria = 'Peças' and jsonb_array_length(coalesce(p_pecas, '[]'::jsonb)) = 0 then
    raise exception 'Adicione pelo menos uma peça à despesa';
  end if;
  if p_categoria <> 'Peças' and jsonb_array_length(coalesce(p_pecas, '[]'::jsonb)) > 0 then
    raise exception 'Peças só podem ser informadas na categoria Peças';
  end if;

  if p_viagem_id is not null then
    select * into v_viagem from public.viagens where id = p_viagem_id;
    if not found then raise exception 'Viagem não encontrada'; end if;
    v_veiculo_id := v_viagem.veiculo_id;
    v_motorista_id := v_viagem.motorista_id;
  end if;
  if v_veiculo_id is null or not exists (
    select 1 from public.veiculos where id = v_veiculo_id and excluido_em is null
  ) then
    raise exception 'Veículo não encontrado';
  end if;
  if v_motorista_id is not null and not exists (
    select 1 from public.motoristas where id = v_motorista_id and excluido_em is null
  ) then
    raise exception 'Motorista não encontrado';
  end if;

  if p_despesa_id is null then
    insert into public.despesas_viagem (
      viagem_id, motorista_id, veiculo_id, categoria, valor, registrado_em,
      observacoes, comprovante_path, criado_por, atualizado_por
    ) values (
      p_viagem_id, v_motorista_id, v_veiculo_id, p_categoria,
      case when p_categoria = 'Peças' then 0.01 else p_valor end,
      p_registrado_em, nullif(trim(p_observacoes), ''),
      nullif(trim(p_comprovante_path), ''), auth.uid(), auth.uid()
    ) returning id into v_id;
  else
    select * into v_despesa
    from public.despesas_viagem
    where id = p_despesa_id and cancelado_em is null
    for update;
    if not found then raise exception 'Despesa não encontrada'; end if;
    v_id := p_despesa_id;

    for v_item in
      select to_jsonb(dp)
      from public.despesa_pecas dp
      where dp.despesa_id = v_id and dp.estoque_devolvido_em is null
      for update
    loop
      select * into v_peca
      from public.pecas
      where id = (v_item->>'peca_id')::uuid
      for update;
      v_saldo_anterior := v_peca.quantidade_estoque;
      update public.pecas
      set quantidade_estoque = quantidade_estoque + (v_item->>'quantidade')::numeric,
          atualizado_por = auth.uid()
      where id = v_peca.id;
      insert into public.estoque_movimentacoes (
        peca_id, despesa_id, tipo, quantidade, valor_unitario_snapshot,
        saldo_anterior, saldo_posterior, observacoes, criado_por
      ) values (
        v_peca.id, v_id, 'devolucao_edicao_despesa',
        (v_item->>'quantidade')::numeric, (v_item->>'valor_unitario')::numeric,
        v_saldo_anterior, v_saldo_anterior + (v_item->>'quantidade')::numeric,
        'Devolução para atualização da despesa', auth.uid()
      );
    end loop;

    delete from public.despesa_pecas where despesa_id = v_id;
    update public.despesas_viagem
    set viagem_id = p_viagem_id,
        motorista_id = v_motorista_id,
        veiculo_id = v_veiculo_id,
        categoria = p_categoria,
        valor = case when p_categoria = 'Peças' then 0.01 else p_valor end,
        registrado_em = p_registrado_em,
        observacoes = nullif(trim(p_observacoes), ''),
        comprovante_path = nullif(trim(p_comprovante_path), ''),
        atualizado_por = auth.uid()
    where id = v_id;
  end if;

  if p_categoria <> 'Peças' then
    if p_valor is null or p_valor <= 0 then
      raise exception 'O valor da despesa deve ser maior que zero';
    end if;
    return v_id;
  end if;

  v_valor := 0;
  for v_item in select value from jsonb_array_elements(coalesce(p_pecas, '[]'::jsonb))
  loop
    begin
      v_peca_id := (v_item->>'partId')::uuid;
      v_quantidade := (v_item->>'quantity')::numeric;
      v_valor_unitario := (v_item->>'unitValue')::numeric;
    exception when others then
      raise exception 'Dados de peça inválidos';
    end;
    if v_quantidade <= 0 or v_valor_unitario < 0 then
      raise exception 'Quantidade e valor da peça são inválidos';
    end if;

    select * into v_peca
    from public.pecas
    where id = v_peca_id and ativo = true and excluido_em is null
    for update;
    if not found then raise exception 'Peça não encontrada ou inativa'; end if;
    if v_peca.unidade_medida not in ('litro', 'metro') and v_quantidade <> trunc(v_quantidade) then
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

    insert into public.despesa_pecas (
      despesa_id, peca_id, codigo_snapshot, nome_snapshot, unidade_snapshot,
      quantidade, valor_unitario, criado_por, atualizado_por
    ) values (
      v_id, v_peca.id, v_peca.codigo, v_peca.nome, v_peca.unidade_medida,
      v_quantidade, v_valor_unitario, auth.uid(), auth.uid()
    );

    insert into public.estoque_movimentacoes (
      peca_id, despesa_id, tipo, quantidade, valor_unitario_snapshot,
      saldo_anterior, saldo_posterior, observacoes, criado_por
    ) values (
      v_peca.id, v_id, 'consumo_despesa', v_quantidade, v_valor_unitario,
      v_saldo_anterior, v_saldo_anterior - v_quantidade,
      'Consumo registrado em despesa avulsa do veículo', auth.uid()
    );
    v_valor := v_valor + round(v_quantidade * v_valor_unitario, 2);
  end loop;

  if v_valor <= 0 then raise exception 'O valor total das peças deve ser maior que zero'; end if;
  update public.despesas_viagem
  set valor = v_valor, atualizado_por = auth.uid()
  where id = v_id;

  return v_id;
end;
$$;

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
  v_veiculo public.veiculos%rowtype;
  v_id uuid;
  v_mecanico_id uuid;
  v_veiculo_anterior uuid;
  v_item jsonb;
  v_peca public.pecas%rowtype;
  v_peca_id uuid;
  v_quantidade numeric;
  v_valor_unitario numeric;
  v_saldo_anterior numeric;
begin
  if not (public.eh_admin() or public.eh_mecanico()) then
    raise exception 'Sem permissão para salvar manutenção';
  end if;
  if p_tipo_manutencao not in ('preventiva', 'corretiva') then
    raise exception 'Tipo de manutenção inválido';
  end if;
  if p_status not in ('aberta', 'em_andamento') then
    raise exception 'Status de manutenção inválido';
  end if;
  if nullif(trim(p_causa), '') is null then raise exception 'Informe a causa da manutenção'; end if;
  if p_km_veiculo < 0 then raise exception 'KM da manutenção inválido'; end if;
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

  select * into v_veiculo
  from public.veiculos
  where id = p_veiculo_id and excluido_em is null
  for update;
  if not found then raise exception 'Veículo não encontrado'; end if;
  if p_km_veiculo < v_veiculo.km_atual then
    raise exception 'O KM da manutenção não pode ser menor que o KM atual do veículo';
  end if;
  if exists (
    select 1 from public.viagens
    where veiculo_id = p_veiculo_id and status = 'em_andamento'
  ) then
    raise exception 'O veículo possui uma viagem em andamento';
  end if;

  v_mecanico_id := case
    when public.eh_mecanico() then public.mecanico_atual_id()
    else p_mecanico_responsavel_id
  end;
  if v_mecanico_id is null or not exists (
    select 1 from public.mecanicos
    where id = v_mecanico_id and status_profissional = 'ativo' and excluido_em is null
  ) then
    raise exception 'Mecânico responsável inválido';
  end if;
  if (
    select count(*) from public.servicos
    where id = any(p_servico_ids) and ativo = true and excluido_em is null
  ) <> cardinality(p_servico_ids) then
    raise exception 'Um ou mais serviços não estão disponíveis';
  end if;

  if p_manutencao_id is null then
    insert into public.manutencoes (
      veiculo_id, tipo_manutencao, causa, aberto_em, iniciado_em,
      km_veiculo, mecanico_responsavel_id, status, valor_total_informado,
      observacoes, criado_por, atualizado_por
    ) values (
      p_veiculo_id, p_tipo_manutencao, trim(p_causa), p_aberto_em,
      case when p_status = 'em_andamento' then now() else null end,
      p_km_veiculo, v_mecanico_id, p_status, null,
      nullif(trim(p_observacoes), ''), auth.uid(), auth.uid()
    ) returning id into v_id;
  else
    select * into v_manutencao
    from public.manutencoes
    where id = p_manutencao_id
    for update;
    if not found then raise exception 'Manutenção não encontrada'; end if;
    if v_manutencao.status not in ('aberta', 'em_andamento') then
      raise exception 'Somente manutenções abertas ou em andamento podem ser editadas';
    end if;
    v_id := p_manutencao_id;
    v_veiculo_anterior := v_manutencao.veiculo_id;

    for v_item in
      select to_jsonb(mp)
      from public.manutencao_pecas mp
      where mp.manutencao_id = v_id and mp.estoque_devolvido_em is null
      for update
    loop
      select * into v_peca
      from public.pecas
      where id = (v_item->>'peca_id')::uuid
      for update;
      v_saldo_anterior := v_peca.quantidade_estoque;
      update public.pecas
      set quantidade_estoque = quantidade_estoque + (v_item->>'quantidade')::numeric,
          atualizado_por = auth.uid()
      where id = v_peca.id;
      insert into public.estoque_movimentacoes (
        peca_id, manutencao_id, tipo, quantidade, valor_unitario_snapshot,
        saldo_anterior, saldo_posterior, observacoes, criado_por
      ) values (
        v_peca.id, v_id, 'devolucao_edicao', (v_item->>'quantidade')::numeric,
        (v_item->>'valor_unitario')::numeric, v_saldo_anterior,
        v_saldo_anterior + (v_item->>'quantidade')::numeric,
        'Devolução para atualização da manutenção', auth.uid()
      );
    end loop;

    delete from public.manutencao_pecas where manutencao_id = v_id;

    update public.manutencoes
    set veiculo_id = p_veiculo_id,
        tipo_manutencao = p_tipo_manutencao,
        causa = trim(p_causa),
        aberto_em = p_aberto_em,
        iniciado_em = case
          when p_status = 'em_andamento' then coalesce(iniciado_em, now())
          else null
        end,
        km_veiculo = p_km_veiculo,
        mecanico_responsavel_id = v_mecanico_id,
        status = p_status,
        valor_total_informado = null,
        observacoes = nullif(trim(p_observacoes), ''),
        atualizado_por = auth.uid()
    where id = v_id;
  end if;

  delete from public.manutencao_servicos where manutencao_id = v_id;
  insert into public.manutencao_servicos (
    manutencao_id, servico_id, nome_servico_snapshot, categoria_snapshot,
    criado_por, atualizado_por
  )
  select v_id, s.id, s.nome, s.categoria, auth.uid(), auth.uid()
  from public.servicos s
  where s.id = any(p_servico_ids);

  delete from public.manutencao_mecanicos
  where manutencao_id = v_id and papel = 'responsavel';
  insert into public.manutencao_mecanicos (
    manutencao_id, mecanico_id, papel, criado_por
  ) values (v_id, v_mecanico_id, 'responsavel', auth.uid());

  for v_item in select value from jsonb_array_elements(coalesce(p_pecas, '[]'::jsonb))
  loop
    begin
      v_peca_id := (v_item->>'partId')::uuid;
      v_quantidade := (v_item->>'quantity')::numeric;
      v_valor_unitario := (v_item->>'unitValue')::numeric;
    exception when others then
      raise exception 'Dados de peça inválidos';
    end;
    if v_quantidade <= 0 or v_valor_unitario < 0 then
      raise exception 'Quantidade e valor da peça são inválidos';
    end if;

    select * into v_peca
    from public.pecas
    where id = v_peca_id and ativo = true and excluido_em is null
    for update;
    if not found then raise exception 'Peça não encontrada ou inativa'; end if;
    if v_peca.unidade_medida not in ('litro', 'metro') and v_quantidade <> trunc(v_quantidade) then
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
      v_id, v_peca.id, v_peca.codigo, v_peca.nome, v_peca.unidade_medida,
      v_quantidade, v_valor_unitario, auth.uid(), auth.uid()
    );

    insert into public.estoque_movimentacoes (
      peca_id, manutencao_id, tipo, quantidade, valor_unitario_snapshot,
      saldo_anterior, saldo_posterior, observacoes, criado_por
    ) values (
      v_peca.id, v_id, 'consumo_manutencao', v_quantidade, v_valor_unitario,
      v_saldo_anterior, v_saldo_anterior - v_quantidade,
      'Consumo registrado na manutenção', auth.uid()
    );
  end loop;

  update public.veiculos
  set status_operacional = 'em_manutencao',
      km_atual = greatest(km_atual, p_km_veiculo),
      atualizado_por = auth.uid()
  where id = p_veiculo_id;

  if v_veiculo_anterior is not null and v_veiculo_anterior <> p_veiculo_id
    and not exists (
      select 1 from public.manutencoes
      where veiculo_id = v_veiculo_anterior
        and status in ('aberta', 'em_andamento')
        and id <> v_id
    )
  then
    update public.veiculos
    set status_operacional = 'ativo', atualizado_por = auth.uid()
    where id = v_veiculo_anterior and status_operacional = 'em_manutencao';
  end if;

  return v_id;
end;
$$;

create or replace function public.fn_cancelar_manutencao(
  p_manutencao_id uuid,
  p_motivo text
)
returns public.manutencoes
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_manutencao public.manutencoes%rowtype;
  v_item public.manutencao_pecas%rowtype;
  v_peca public.pecas%rowtype;
begin
  if not (public.eh_admin() or public.eh_mecanico()) then
    raise exception 'Sem permissão para cancelar manutenção';
  end if;
  if nullif(trim(p_motivo), '') is null then
    raise exception 'Informe o motivo do cancelamento';
  end if;

  select * into v_manutencao
  from public.manutencoes
  where id = p_manutencao_id
  for update;
  if not found then raise exception 'Manutenção não encontrada'; end if;
  if v_manutencao.status not in ('aberta', 'em_andamento') then
    raise exception 'Esta manutenção não pode mais ser cancelada';
  end if;

  for v_item in
    select * from public.manutencao_pecas
    where manutencao_id = p_manutencao_id and estoque_devolvido_em is null
    for update
  loop
    select * into v_peca from public.pecas where id = v_item.peca_id for update;
    update public.pecas
    set quantidade_estoque = quantidade_estoque + v_item.quantidade,
        atualizado_por = auth.uid()
    where id = v_item.peca_id;
    update public.manutencao_pecas
    set estoque_devolvido_em = now(), atualizado_por = auth.uid()
    where id = v_item.id;
    insert into public.estoque_movimentacoes (
      peca_id, manutencao_id, tipo, quantidade, valor_unitario_snapshot,
      saldo_anterior, saldo_posterior, observacoes, criado_por
    ) values (
      v_item.peca_id, p_manutencao_id, 'devolucao_cancelamento',
      v_item.quantidade, v_item.valor_unitario, v_peca.quantidade_estoque,
      v_peca.quantidade_estoque + v_item.quantidade,
      'Devolução por cancelamento da manutenção', auth.uid()
    );
  end loop;

  update public.manutencoes
  set status = 'cancelada',
      cancelado_em = now(),
      motivo_cancelamento = trim(p_motivo),
      atualizado_por = auth.uid()
  where id = p_manutencao_id
  returning * into v_manutencao;

  if not exists (
    select 1 from public.manutencoes
    where veiculo_id = v_manutencao.veiculo_id
      and status in ('aberta', 'em_andamento')
      and id <> p_manutencao_id
  ) then
    update public.veiculos
    set status_operacional = 'ativo', atualizado_por = auth.uid()
    where id = v_manutencao.veiculo_id and status_operacional = 'em_manutencao';
  end if;

  return v_manutencao;
end;
$$;

create or replace view public.vw_manutencoes_detalhadas
with (security_invoker = true)
as
select
  m.*,
  v.placa as veiculo_placa,
  v.marca as veiculo_marca,
  v.modelo as veiculo_modelo,
  pm.nome as mecanico_responsavel_nome,
  coalesce(pecas.valor_pecas, m.valor_total_informado, 0) as valor_total_realizado,
  servicos.servicos,
  pecas.pecas
from public.manutencoes m
join public.veiculos v on v.id = m.veiculo_id
left join public.mecanicos mec on mec.id = m.mecanico_responsavel_id
left join public.perfis pm on pm.id = mec.perfil_id
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'id', ms.servico_id,
      'nome', ms.nome_servico_snapshot,
      'categoria', ms.categoria_snapshot,
      'valor', null
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

create or replace view public.vw_veiculos_resumo
with (security_invoker = true)
as
select
  v.id, v.tipo, v.marca, v.modelo, v.placa, v.placa_normalizada, v.ano,
  v.status_operacional, v.km_atual, v.capacidade, v.rota_fixa_id,
  r.nome as rota_nome, r.origem as rota_origem, r.destino as rota_destino,
  p_motorista.nome as motorista_principal_nome,
  vm.motorista_id as motorista_principal_id,
  coalesce(viag.km_rodados_total, 0) as km_rodados_total,
  coalesce(abast.litros_combustivel_total, 0) as litros_combustivel_total,
  case when coalesce(abast.litros_combustivel_total, 0) > 0
    then round((coalesce(viag.km_rodados_total, 0) / nullif(abast.litros_combustivel_total, 0))::numeric, 2)
    else null end as consumo_medio_km_l,
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
  select sum(coalesce(itens.valor_pecas, m.valor_total_informado, 0)) as custo_manutencao_total
  from public.manutencoes m
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
  if not public.eh_admin() then raise exception 'Somente admin pode consultar dashboard administrativo'; end if;

  with viagens_filtradas as (
    select * from public.viagens v
    where v.saiu_em >= v_inicio and v.saiu_em < v_fim
      and (p_veiculo_id is null or v.veiculo_id = p_veiculo_id)
      and (p_motorista_id is null or v.motorista_id = p_motorista_id)
  ), abastecimentos_filtrados as (
    select a.* from public.abastecimentos a
    where a.registrado_em >= v_inicio and a.registrado_em < v_fim and a.cancelado_em is null
      and (p_veiculo_id is null or a.veiculo_id = p_veiculo_id)
      and (p_motorista_id is null or a.motorista_id = p_motorista_id)
  ), despesas_filtradas as (
    select d.* from public.despesas_viagem d
    where d.registrado_em >= v_inicio and d.registrado_em < v_fim and d.cancelado_em is null
      and (p_veiculo_id is null or d.veiculo_id = p_veiculo_id)
      and (p_motorista_id is null or d.motorista_id = p_motorista_id)
  ), manutencoes_filtradas as (
    select m.*, coalesce(itens.valor_pecas, m.valor_total_informado, 0) as valor_realizado
    from public.manutencoes m
    left join lateral (
      select sum(mp.valor_total) as valor_pecas
      from public.manutencao_pecas mp
      where mp.manutencao_id = m.id
    ) itens on true
    where m.aberto_em >= v_inicio and m.aberto_em < v_fim and m.status <> 'cancelada'
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

alter table public.pecas enable row level security;
alter table public.manutencao_pecas enable row level security;
alter table public.despesa_pecas enable row level security;
alter table public.estoque_movimentacoes enable row level security;

drop policy if exists pecas_select_admin_mecanico on public.pecas;
create policy pecas_select_admin_mecanico on public.pecas
  for select to authenticated using (public.eh_admin() or public.eh_mecanico());
drop policy if exists pecas_admin_write on public.pecas;
create policy pecas_admin_write on public.pecas
  for all to authenticated using (public.eh_admin()) with check (public.eh_admin());

drop policy if exists manutencao_pecas_select_admin_mecanico on public.manutencao_pecas;
create policy manutencao_pecas_select_admin_mecanico on public.manutencao_pecas
  for select to authenticated using (public.eh_admin() or public.eh_mecanico());

drop policy if exists despesa_pecas_select_admin_mecanico on public.despesa_pecas;
create policy despesa_pecas_select_admin_mecanico on public.despesa_pecas
  for select to authenticated using (public.eh_admin() or public.eh_mecanico());

drop policy if exists estoque_movimentacoes_select_admin_mecanico on public.estoque_movimentacoes;
create policy estoque_movimentacoes_select_admin_mecanico on public.estoque_movimentacoes
  for select to authenticated using (public.eh_admin() or public.eh_mecanico());

grant select, insert, update on public.pecas, public.manutencao_pecas, public.despesa_pecas, public.estoque_movimentacoes to authenticated;

revoke execute on function public.fn_salvar_peca(uuid,text,text,text,text,numeric,numeric,numeric,text,boolean) from public, anon;
revoke execute on function public.fn_salvar_despesa(uuid,uuid,uuid,uuid,text,numeric,timestamptz,text,text,jsonb) from public, anon;
revoke execute on function public.fn_salvar_manutencao(uuid,uuid,text,text,timestamptz,numeric,uuid,text,text,uuid[],jsonb) from public, anon;
revoke execute on function public.fn_cancelar_manutencao(uuid,text) from public, anon;
grant execute on function public.fn_salvar_peca(uuid,text,text,text,text,numeric,numeric,numeric,text,boolean) to authenticated;
grant execute on function public.fn_salvar_despesa(uuid,uuid,uuid,uuid,text,numeric,timestamptz,text,text,jsonb) to authenticated;
grant execute on function public.fn_salvar_manutencao(uuid,uuid,text,text,timestamptz,numeric,uuid,text,text,uuid[],jsonb) to authenticated;
grant execute on function public.fn_cancelar_manutencao(uuid,text) to authenticated;
