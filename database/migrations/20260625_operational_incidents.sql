-- Modulo de sinistros/avarias operacionais vinculados a veiculos.

create table if not exists public.sinistros_operacionais (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid not null references public.veiculos(id) on delete restrict,
  motorista_id uuid references public.motoristas(id) on delete set null,
  data_ocorrencia timestamptz not null default now(),
  tipo text not null default 'avaria',
  severidade text not null default 'atencao',
  status text not null default 'aberto',
  local_ocorrencia text,
  descricao text not null,
  observacoes text,
  boletim_ocorrencia text,
  terceiros_envolvidos boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references public.perfis(id) on delete set null,
  atualizado_por uuid references public.perfis(id) on delete set null,
  constraint sinistros_operacionais_tipo_check check (tipo in ('avaria', 'colisao', 'acidente', 'incidente', 'outros')),
  constraint sinistros_operacionais_severidade_check check (severidade in ('baixa', 'atencao', 'critica')),
  constraint sinistros_operacionais_status_check check (status in ('aberto', 'em_analise', 'resolvido', 'cancelado')),
  constraint sinistros_operacionais_descricao_check check (length(btrim(descricao)) > 0)
);

create table if not exists public.sinistro_custos (
  id uuid primary key default gen_random_uuid(),
  sinistro_id uuid not null references public.sinistros_operacionais(id) on delete cascade,
  categoria text not null default 'outros',
  descricao text not null,
  quantidade numeric(14,3) not null default 1,
  valor_unitario numeric(12,2) not null default 0,
  valor_total numeric(14,2) generated always as (round(quantidade * valor_unitario, 2)) stored,
  comprovante_path text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references public.perfis(id) on delete set null,
  atualizado_por uuid references public.perfis(id) on delete set null,
  constraint sinistro_custos_categoria_check check (categoria in ('funilaria', 'pecas', 'mao_de_obra', 'guincho', 'seguro', 'terceiros', 'outros')),
  constraint sinistro_custos_descricao_check check (length(btrim(descricao)) > 0),
  constraint sinistro_custos_quantidade_check check (quantidade > 0),
  constraint sinistro_custos_valor_check check (valor_unitario >= 0)
);

create index if not exists sinistros_operacionais_veiculo_idx
  on public.sinistros_operacionais(veiculo_id, data_ocorrencia desc);
create index if not exists sinistros_operacionais_motorista_idx
  on public.sinistros_operacionais(motorista_id)
  where motorista_id is not null;
create index if not exists sinistros_operacionais_status_idx
  on public.sinistros_operacionais(status);
create index if not exists sinistros_operacionais_severidade_idx
  on public.sinistros_operacionais(severidade);
create index if not exists sinistro_custos_sinistro_idx
  on public.sinistro_custos(sinistro_id);

drop trigger if exists set_sinistros_operacionais_atualizado_em on public.sinistros_operacionais;
create trigger set_sinistros_operacionais_atualizado_em
  before update on public.sinistros_operacionais
  for each row execute function public.set_atualizado_em();

drop trigger if exists set_sinistro_custos_atualizado_em on public.sinistro_custos;
create trigger set_sinistro_custos_atualizado_em
  before update on public.sinistro_custos
  for each row execute function public.set_atualizado_em();

drop trigger if exists sinistros_validar_escopo_trg on public.sinistros_operacionais;
create trigger sinistros_validar_escopo_trg
  before insert or update of veiculo_id, motorista_id on public.sinistros_operacionais
  for each row execute function public.validar_escopo_operacao_veiculo();

create or replace function public.fn_salvar_sinistro(
  p_sinistro_id uuid,
  p_veiculo_id uuid,
  p_motorista_id uuid,
  p_data_ocorrencia timestamptz,
  p_tipo text,
  p_severidade text,
  p_status text,
  p_local_ocorrencia text,
  p_descricao text,
  p_observacoes text,
  p_boletim_ocorrencia text,
  p_terceiros_envolvidos boolean,
  p_custos jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sinistro public.sinistros_operacionais%rowtype;
  v_id uuid;
  v_antes jsonb;
  v_item jsonb;
  v_categoria text;
  v_descricao text;
  v_quantidade numeric;
  v_valor_unitario numeric;
  v_comprovante text;
begin
  if not public.eh_admin() then
    raise exception 'Somente administradores podem salvar sinistros';
  end if;
  if p_veiculo_id is null or not public.admin_pode_acessar_veiculo(p_veiculo_id) then
    raise exception 'Veiculo fora da responsabilidade do administrador';
  end if;
  if not exists (
    select 1 from public.veiculos v
    where v.id = p_veiculo_id and v.excluido_em is null
  ) then
    raise exception 'Veiculo nao encontrado';
  end if;
  if p_motorista_id is not null then
    if not public.admin_pode_acessar_motorista(p_motorista_id) then
      raise exception 'Motorista fora da responsabilidade do administrador';
    end if;
    if not exists (
      select 1 from public.motoristas m
      where m.id = p_motorista_id and m.excluido_em is null
    ) then
      raise exception 'Motorista nao encontrado';
    end if;
  end if;
  if p_data_ocorrencia is null then
    raise exception 'Data do sinistro e obrigatoria';
  end if;
  if p_tipo not in ('avaria', 'colisao', 'acidente', 'incidente', 'outros') then
    raise exception 'Tipo de sinistro invalido';
  end if;
  if p_severidade not in ('baixa', 'atencao', 'critica') then
    raise exception 'Severidade do sinistro invalida';
  end if;
  if p_status not in ('aberto', 'em_analise', 'resolvido', 'cancelado') then
    raise exception 'Status do sinistro invalido';
  end if;
  if nullif(btrim(p_descricao), '') is null then
    raise exception 'Descricao do sinistro e obrigatoria';
  end if;
  if jsonb_typeof(coalesce(p_custos, '[]'::jsonb)) <> 'array' then
    raise exception 'Lista de custos do sinistro invalida';
  end if;

  if p_sinistro_id is null then
    insert into public.sinistros_operacionais (
      veiculo_id, motorista_id, data_ocorrencia, tipo, severidade, status,
      local_ocorrencia, descricao, observacoes, boletim_ocorrencia,
      terceiros_envolvidos, criado_por, atualizado_por
    ) values (
      p_veiculo_id, p_motorista_id, p_data_ocorrencia, p_tipo, p_severidade, p_status,
      nullif(btrim(p_local_ocorrencia), ''), btrim(p_descricao),
      nullif(btrim(p_observacoes), ''), nullif(btrim(p_boletim_ocorrencia), ''),
      coalesce(p_terceiros_envolvidos, false), auth.uid(), auth.uid()
    ) returning id into v_id;
  else
    select * into v_sinistro
    from public.sinistros_operacionais
    where id = p_sinistro_id
    for update;
    if not found then
      raise exception 'Sinistro nao encontrado';
    end if;
    if not public.admin_pode_acessar_veiculo(v_sinistro.veiculo_id) then
      raise exception 'Sinistro fora da responsabilidade do administrador';
    end if;

    v_antes := to_jsonb(v_sinistro);
    v_id := p_sinistro_id;

    update public.sinistros_operacionais
    set veiculo_id = p_veiculo_id,
        motorista_id = p_motorista_id,
        data_ocorrencia = p_data_ocorrencia,
        tipo = p_tipo,
        severidade = p_severidade,
        status = p_status,
        local_ocorrencia = nullif(btrim(p_local_ocorrencia), ''),
        descricao = btrim(p_descricao),
        observacoes = nullif(btrim(p_observacoes), ''),
        boletim_ocorrencia = nullif(btrim(p_boletim_ocorrencia), ''),
        terceiros_envolvidos = coalesce(p_terceiros_envolvidos, false),
        atualizado_por = auth.uid()
    where id = v_id;

    delete from public.sinistro_custos where sinistro_id = v_id;
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_custos, '[]'::jsonb))
  loop
    v_categoria := coalesce(nullif(btrim(v_item->>'category'), ''), 'outros');
    v_descricao := nullif(btrim(v_item->>'description'), '');
    v_comprovante := nullif(btrim(v_item->>'receiptPath'), '');
    begin
      v_quantidade := (v_item->>'quantity')::numeric;
      v_valor_unitario := (v_item->>'unitValue')::numeric;
    exception when others then
      raise exception 'Dados de custo do sinistro invalidos';
    end;

    if v_categoria not in ('funilaria', 'pecas', 'mao_de_obra', 'guincho', 'seguro', 'terceiros', 'outros') then
      raise exception 'Categoria de custo do sinistro invalida';
    end if;
    if v_descricao is null then
      raise exception 'Descricao do custo do sinistro e obrigatoria';
    end if;
    if v_quantidade <= 0 or v_valor_unitario < 0 then
      raise exception 'Quantidade e valor do custo do sinistro sao invalidos';
    end if;

    insert into public.sinistro_custos (
      sinistro_id, categoria, descricao, quantidade, valor_unitario,
      comprovante_path, criado_por, atualizado_por
    ) values (
      v_id, v_categoria, v_descricao, v_quantidade, v_valor_unitario,
      v_comprovante, auth.uid(), auth.uid()
    );
  end loop;

  select * into v_sinistro
  from public.sinistros_operacionais
  where id = v_id;

  insert into public.auditoria_eventos (
    tabela, registro_id, acao, dados_antes, dados_depois, criado_por
  ) values (
    'sinistros_operacionais',
    v_id,
    case when p_sinistro_id is null then 'criar' else 'atualizar' end,
    v_antes,
    to_jsonb(v_sinistro),
    auth.uid()
  );

  return v_id;
end;
$$;

alter table public.sinistros_operacionais enable row level security;
alter table public.sinistro_custos enable row level security;

drop policy if exists sinistros_select_contexto on public.sinistros_operacionais;
create policy sinistros_select_contexto on public.sinistros_operacionais
  for select to authenticated
  using (public.admin_pode_acessar_veiculo(veiculo_id));

drop policy if exists sinistros_insert_contexto on public.sinistros_operacionais;
create policy sinistros_insert_contexto on public.sinistros_operacionais
  for insert to authenticated
  with check (
    public.admin_pode_acessar_veiculo(veiculo_id)
    and (
      motorista_id is null
      or public.admin_pode_acessar_motorista(motorista_id)
    )
  );

drop policy if exists sinistros_update_contexto on public.sinistros_operacionais;
create policy sinistros_update_contexto on public.sinistros_operacionais
  for update to authenticated
  using (public.admin_pode_acessar_veiculo(veiculo_id))
  with check (
    public.admin_pode_acessar_veiculo(veiculo_id)
    and (
      motorista_id is null
      or public.admin_pode_acessar_motorista(motorista_id)
    )
  );

drop policy if exists sinistro_custos_select_contexto on public.sinistro_custos;
create policy sinistro_custos_select_contexto on public.sinistro_custos
  for select to authenticated
  using (
    exists (
      select 1
      from public.sinistros_operacionais s
      where s.id = sinistro_id
        and public.admin_pode_acessar_veiculo(s.veiculo_id)
    )
  );

drop policy if exists sinistro_custos_write_contexto on public.sinistro_custos;
create policy sinistro_custos_write_contexto on public.sinistro_custos
  for all to authenticated
  using (
    exists (
      select 1
      from public.sinistros_operacionais s
      where s.id = sinistro_id
        and public.admin_pode_acessar_veiculo(s.veiculo_id)
    )
  )
  with check (
    exists (
      select 1
      from public.sinistros_operacionais s
      where s.id = sinistro_id
        and public.admin_pode_acessar_veiculo(s.veiculo_id)
    )
  );

grant select, insert, update on public.sinistros_operacionais, public.sinistro_custos to authenticated;
revoke execute on function public.fn_salvar_sinistro(
  uuid, uuid, uuid, timestamptz, text, text, text, text, text, text, text, boolean, jsonb
) from public, anon;
grant execute on function public.fn_salvar_sinistro(
  uuid, uuid, uuid, timestamptz, text, text, text, text, text, text, text, boolean, jsonb
) to authenticated;
