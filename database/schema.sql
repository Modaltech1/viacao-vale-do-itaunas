
-- Vale do Itaúnas — Schema Supabase/PostgreSQL
-- Sistema ERP de gestão de frota
-- Esquema principal do sistema em produção.
-- Convenções:
-- - UUID como PK.
-- - snake_case em português.
-- - auth.users é identidade; public.perfis é autorização.
-- - dados calculáveis ficam em views/funções, não em colunas de fonte primária.
-- - exclusão destrutiva é evitada em registros históricos.

-- =========================================================
-- 01. EXTENSÕES
-- =========================================================
create extension if not exists pgcrypto;
create extension if not exists unaccent;

-- =========================================================
-- 02. FUNÇÕES UTILITÁRIAS GERAIS
-- =========================================================
create or replace function public.normalizar_texto(valor text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(upper(unaccent(coalesce(valor, ''))), '[^A-Z0-9]', '', 'g'), '')
$$;

create or replace function public.set_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

create or replace function public.impedir_regressao_km_veiculo()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.km_atual < old.km_atual then
    raise exception 'km_atual do veículo não pode regredir sem correção auditada. Valor antigo: %, novo: %', old.km_atual, new.km_atual;
  end if;
  return new;
end;
$$;

create or replace function public.calcular_status_vencimento(vencimento date, dias_alerta integer default 30)
returns text
language sql
stable
as $$
  select case
    when vencimento is null then 'sem_data'
    when vencimento < current_date then 'vencido'
    when vencimento <= current_date + make_interval(days => coalesce(dias_alerta, 30)) then 'proximo'
    else 'em_dia'
  end
$$;

create or replace function public.calcular_severidade_vencimento(vencimento date, dias_alerta integer default 30)
returns text
language sql
stable
as $$
  select case
    when vencimento is null then 'baixa'
    when vencimento < current_date then 'critica'
    when vencimento <= current_date + make_interval(days => coalesce(dias_alerta, 30)) then 'atencao'
    else 'baixa'
  end
$$;

-- =========================================================
-- 03. PERFIS E AUTENTICAÇÃO PÚBLICA
-- =========================================================
create table if not exists public.perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text,
  telefone text,
  papel text not null default 'motorista',
  ativo boolean not null default true,
  avatar_url text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references public.perfis(id) on delete set null,
  atualizado_por uuid references public.perfis(id) on delete set null,
  constraint perfis_papel_check check (papel in ('admin', 'motorista', 'mecanico'))
);

comment on table public.perfis is 'Autorização e dados comuns dos usuários autenticados. A identidade real fica em auth.users.';
comment on column public.perfis.papel is 'Fonte de verdade do papel do usuário: admin, motorista ou mecanico.';
comment on column public.perfis.ativo is 'Fonte de verdade do bloqueio operacional de acesso.';

create or replace function public.handle_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  insert into public.perfis (id, nome, email, papel, ativo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1), 'Usuário'),
    new.email,
    case
      when new.raw_app_meta_data ->> 'papel' in ('admin', 'motorista', 'mecanico')
        then new.raw_app_meta_data ->> 'papel'
      else 'motorista'
    end,
    true
  )
  on conflict (id) do update set
    email = excluded.email,
    nome = coalesce(public.perfis.nome, excluded.nome),
    atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_novo_usuario();

create or replace function public.perfil_ativo()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.perfis p
    where p.id = auth.uid() and p.ativo = true
  )
$$;

create or replace function public.papel_atual()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.papel from public.perfis p where p.id = auth.uid() and p.ativo = true
$$;

create or replace function public.eh_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.perfis p
    where p.id = auth.uid() and p.ativo = true and p.papel = 'admin'
  )
$$;

create or replace function public.eh_motorista()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.perfis p
    where p.id = auth.uid() and p.ativo = true and p.papel = 'motorista'
  )
$$;

create or replace function public.eh_mecanico()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.perfis p
    where p.id = auth.uid() and p.ativo = true and p.papel = 'mecanico'
  )
$$;

-- =========================================================
-- 04. PROFISSIONAIS
-- =========================================================
create table if not exists public.motoristas (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid unique references public.perfis(id) on delete set null,
  cpf text,
  cpf_normalizado text generated always as (public.normalizar_texto(cpf)) stored,
  endereco text,
  numero_habilitacao text,
  categoria_habilitacao text,
  validade_habilitacao date,
  status_profissional text not null default 'ativo',
  observacoes text,
  excluido_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references public.perfis(id) on delete set null,
  atualizado_por uuid references public.perfis(id) on delete set null,
  constraint motoristas_status_profissional_check check (status_profissional in ('ativo', 'inativo', 'afastado'))
);

create unique index if not exists motoristas_cpf_normalizado_uniq
  on public.motoristas(cpf_normalizado)
  where cpf_normalizado is not null and excluido_em is null;

create table if not exists public.mecanicos (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid unique references public.perfis(id) on delete set null,
  especialidade text,
  status_profissional text not null default 'ativo',
  observacoes text,
  excluido_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references public.perfis(id) on delete set null,
  atualizado_por uuid references public.perfis(id) on delete set null,
  constraint mecanicos_status_profissional_check check (status_profissional in ('ativo', 'inativo'))
);

create or replace function public.motorista_atual_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.id
  from public.motoristas m
  join public.perfis p on p.id = m.perfil_id
  where p.id = auth.uid()
    and p.ativo = true
    and p.papel = 'motorista'
    and m.status_profissional = 'ativo'
    and m.excluido_em is null
  limit 1
$$;

create or replace function public.mecanico_atual_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.id
  from public.mecanicos m
  join public.perfis p on p.id = m.perfil_id
  where p.id = auth.uid()
    and p.ativo = true
    and p.papel = 'mecanico'
    and m.status_profissional = 'ativo'
    and m.excluido_em is null
  limit 1
$$;

-- =========================================================
-- 05. ROTAS E VEÍCULOS
-- =========================================================
create table if not exists public.rotas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  origem text not null,
  destino text not null,
  km_estimado numeric(12,2),
  observacoes text,
  ativo boolean not null default true,
  excluido_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references public.perfis(id) on delete set null,
  atualizado_por uuid references public.perfis(id) on delete set null,
  constraint rotas_km_estimado_check check (km_estimado is null or km_estimado >= 0)
);

create table if not exists public.veiculos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  marca text not null,
  modelo text not null,
  placa text not null,
  placa_normalizada text generated always as (public.normalizar_texto(placa)) stored,
  ano integer,
  status_operacional text not null default 'ativo',
  km_atual numeric(14,2) not null default 0,
  capacidade text,
  rota_fixa_id uuid references public.rotas(id) on delete set null,
  observacoes text,
  excluido_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references public.perfis(id) on delete set null,
  atualizado_por uuid references public.perfis(id) on delete set null,
  constraint veiculos_status_operacional_check check (status_operacional in ('ativo', 'em_manutencao', 'inativo', 'reservado', 'indisponivel')),
  constraint veiculos_km_atual_check check (km_atual >= 0),
  constraint veiculos_ano_check check (ano is null or ano between 1950 and 2100)
);

create unique index if not exists veiculos_placa_normalizada_uniq
  on public.veiculos(placa_normalizada)
  where placa_normalizada is not null and excluido_em is null;

create table if not exists public.veiculo_motoristas (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid not null references public.veiculos(id) on delete restrict,
  motorista_id uuid not null references public.motoristas(id) on delete restrict,
  inicio_em timestamptz not null default now(),
  fim_em timestamptz,
  ativo boolean not null default true,
  principal boolean not null default false,
  tipo_vinculo text not null default 'regular',
  observacoes text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references public.perfis(id) on delete set null,
  atualizado_por uuid references public.perfis(id) on delete set null,
  constraint veiculo_motoristas_tipo_vinculo_check check (tipo_vinculo in ('regular', 'reserva', 'temporario')),
  constraint veiculo_motoristas_periodo_check check (fim_em is null or fim_em > inicio_em),
  constraint veiculo_motoristas_ativo_periodo_check check (
    (ativo = true and fim_em is null) or
    (ativo = false and fim_em is not null)
  )
);

create unique index if not exists veiculo_motoristas_motorista_principal_ativo_uniq
  on public.veiculo_motoristas(motorista_id)
  where ativo = true and principal = true and fim_em is null;

create unique index if not exists veiculo_motoristas_veiculo_principal_ativo_uniq
  on public.veiculo_motoristas(veiculo_id)
  where ativo = true and principal = true and fim_em is null;

create unique index if not exists veiculo_motoristas_vinculo_ativo_uniq
  on public.veiculo_motoristas(veiculo_id, motorista_id)
  where ativo = true and fim_em is null;

-- =========================================================
-- 06. DOCUMENTOS DE VEÍCULO
-- =========================================================
create table if not exists public.tipos_documento_veiculo (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  dias_alerta integer not null default 30,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint tipos_documento_dias_alerta_check check (dias_alerta >= 0)
);

create table if not exists public.veiculo_documentos (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid not null references public.veiculos(id) on delete restrict,
  tipo_documento_id uuid not null references public.tipos_documento_veiculo(id) on delete restrict,
  numero text,
  emitido_em date,
  vencimento_em date not null,
  arquivo_path text,
  status_operacional text not null default 'ativo',
  observacoes text,
  substituido_por_id uuid references public.veiculo_documentos(id) on delete set null,
  excluido_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references public.perfis(id) on delete set null,
  atualizado_por uuid references public.perfis(id) on delete set null,
  constraint veiculo_documentos_status_check check (status_operacional in ('ativo', 'substituido', 'cancelado')),
  constraint veiculo_documentos_datas_check check (emitido_em is null or vencimento_em >= emitido_em)
);

create unique index if not exists veiculo_documentos_tipo_ativo_uniq
  on public.veiculo_documentos(veiculo_id, tipo_documento_id)
  where status_operacional = 'ativo' and excluido_em is null;

-- =========================================================
-- 07. SERVIÇOS E PROGRAMAÇÃO POR VEÍCULO
-- =========================================================
create table if not exists public.servicos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  categoria text not null,
  tipo_manutencao_sugerido text not null default 'preventiva',
  tipo_periodicidade text not null default 'nenhuma',
  periodicidade_km numeric(14,2),
  periodicidade_dias integer,
  descricao text,
  ativo boolean not null default true,
  excluido_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references public.perfis(id) on delete set null,
  atualizado_por uuid references public.perfis(id) on delete set null,
  constraint servicos_categoria_check check (categoria in ('Óleo', 'Pneus', 'Freios', 'Motor', 'Câmbio', 'Elétrica', 'Suspensão', 'Documentação', 'Revisão geral', 'Outros')),
  constraint servicos_tipo_manutencao_sugerido_check check (tipo_manutencao_sugerido in ('preventiva', 'corretiva')),
  constraint servicos_tipo_periodicidade_check check (tipo_periodicidade in ('km', 'tempo', 'nenhuma')),
  constraint servicos_periodicidade_check check (
    (tipo_periodicidade = 'km' and periodicidade_km is not null and periodicidade_km > 0 and periodicidade_dias is null) or
    (tipo_periodicidade = 'tempo' and periodicidade_dias is not null and periodicidade_dias > 0 and periodicidade_km is null) or
    (tipo_periodicidade = 'nenhuma' and periodicidade_km is null and periodicidade_dias is null)
  )
);

create table if not exists public.veiculo_servico_programacoes (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid not null references public.veiculos(id) on delete restrict,
  servico_id uuid not null references public.servicos(id) on delete restrict,
  periodicidade_tipo_snapshot text not null,
  periodicidade_km_snapshot numeric(14,2),
  periodicidade_dias_snapshot integer,
  ultimo_realizado_manutencao_id uuid,
  ultimo_realizado_em date,
  ultimo_realizado_km numeric(14,2),
  proximo_vencimento_em date,
  proximo_vencimento_km numeric(14,2),
  dias_alerta integer not null default 30,
  km_alerta numeric(14,2) not null default 1000,
  observacoes text,
  ativo boolean not null default true,
  excluido_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references public.perfis(id) on delete set null,
  atualizado_por uuid references public.perfis(id) on delete set null,
  constraint veiculo_servico_programacoes_periodicidade_tipo_check check (periodicidade_tipo_snapshot in ('km', 'tempo', 'nenhuma')),
  constraint veiculo_servico_programacoes_periodicidade_check check (
    (periodicidade_tipo_snapshot = 'km' and periodicidade_km_snapshot is not null and periodicidade_km_snapshot > 0 and periodicidade_dias_snapshot is null) or
    (periodicidade_tipo_snapshot = 'tempo' and periodicidade_dias_snapshot is not null and periodicidade_dias_snapshot > 0 and periodicidade_km_snapshot is null) or
    (periodicidade_tipo_snapshot = 'nenhuma' and periodicidade_km_snapshot is null and periodicidade_dias_snapshot is null)
  ),
  constraint veiculo_servico_programacoes_ultimo_km_check check (ultimo_realizado_km is null or ultimo_realizado_km >= 0),
  constraint veiculo_servico_programacoes_proximo_km_check check (proximo_vencimento_km is null or proximo_vencimento_km >= 0)
);

create unique index if not exists veiculo_servico_programacoes_uniq
  on public.veiculo_servico_programacoes(veiculo_id, servico_id)
  where excluido_em is null;

-- FK circular adicionada depois da tabela manutencoes.

-- =========================================================
-- 08. VIAGENS, ABASTECIMENTOS E DESPESAS
-- =========================================================
create table if not exists public.viagens (
  id uuid primary key default gen_random_uuid(),
  motorista_id uuid not null references public.motoristas(id) on delete restrict,
  veiculo_id uuid not null references public.veiculos(id) on delete restrict,
  rota_id uuid references public.rotas(id) on delete set null,
  rota_nome_snapshot text,
  origem_snapshot text not null,
  destino_snapshot text not null,
  km_estimado_snapshot numeric(12,2),
  saiu_em timestamptz not null default now(),
  chegou_em timestamptz,
  status text not null default 'em_andamento',
  km_inicial numeric(14,2) not null,
  km_final numeric(14,2),
  veiculo_temporario boolean not null default false,
  observacoes text,
  cancelado_em timestamptz,
  motivo_cancelamento text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references public.perfis(id) on delete set null,
  atualizado_por uuid references public.perfis(id) on delete set null,
  constraint viagens_status_check check (status in ('em_andamento', 'concluida', 'cancelada')),
  constraint viagens_km_inicial_check check (km_inicial >= 0),
  constraint viagens_km_final_check check (km_final is null or km_final >= km_inicial),
  constraint viagens_datas_check check (chegou_em is null or chegou_em >= saiu_em),
  constraint viagens_concluida_check check ((status <> 'concluida') or (chegou_em is not null and km_final is not null)),
  constraint viagens_em_andamento_check check ((status <> 'em_andamento') or (chegou_em is null and km_final is null and cancelado_em is null)),
  constraint viagens_cancelada_check check ((status <> 'cancelada') or (cancelado_em is not null))
);

create unique index if not exists viagens_motorista_em_andamento_uniq
  on public.viagens(motorista_id)
  where status = 'em_andamento';

create unique index if not exists viagens_veiculo_em_andamento_uniq
  on public.viagens(veiculo_id)
  where status = 'em_andamento';

create table if not exists public.abastecimentos (
  id uuid primary key default gen_random_uuid(),
  viagem_id uuid references public.viagens(id) on delete set null,
  motorista_id uuid references public.motoristas(id) on delete restrict,
  veiculo_id uuid not null references public.veiculos(id) on delete restrict,
  registrado_em timestamptz not null default now(),
  km_registrado numeric(14,2) not null,
  tipo_combustivel text not null,
  litros numeric(12,3) not null,
  valor_unitario numeric(12,4),
  valor_total numeric(12,2),
  observacoes text,
  cancelado_em timestamptz,
  motivo_cancelamento text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references public.perfis(id) on delete set null,
  atualizado_por uuid references public.perfis(id) on delete set null,
  constraint abastecimentos_combustivel_check check (tipo_combustivel in ('Diesel S10', 'Diesel S500', 'ARLA', 'Gasolina', 'Etanol')),
  constraint abastecimentos_litros_check check (litros > 0),
  constraint abastecimentos_km_check check (km_registrado >= 0),
  constraint abastecimentos_valores_check check ((valor_unitario is null or valor_unitario >= 0) and (valor_total is null or valor_total >= 0))
);

create table if not exists public.despesas_viagem (
  id uuid primary key default gen_random_uuid(),
  viagem_id uuid references public.viagens(id) on delete set null,
  motorista_id uuid references public.motoristas(id) on delete restrict,
  veiculo_id uuid not null references public.veiculos(id) on delete restrict,
  categoria text not null,
  valor numeric(12,2) not null,
  registrado_em timestamptz not null default now(),
  observacoes text,
  comprovante_path text,
  cancelado_em timestamptz,
  motivo_cancelamento text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references public.perfis(id) on delete set null,
  atualizado_por uuid references public.perfis(id) on delete set null,
  constraint despesas_viagem_categoria_check check (categoria in ('Pedágio', 'Alimentação', 'Hospedagem', 'Descarga', 'Peças', 'Outros')),
  constraint despesas_viagem_valor_check check (valor > 0)
);

create or replace function public.sincronizar_abastecimento()
returns trigger
language plpgsql
as $$
declare
  v_viagem public.viagens%rowtype;
begin
  if new.valor_total is null and new.valor_unitario is not null then
    new.valor_total = round((new.litros * new.valor_unitario)::numeric, 2);
  end if;

  if new.viagem_id is not null then
    select * into v_viagem from public.viagens where id = new.viagem_id;
    if not found then
      raise exception 'Viagem % não encontrada', new.viagem_id;
    end if;
    if new.motorista_id is null then
      new.motorista_id = v_viagem.motorista_id;
    end if;
    if new.veiculo_id is null then
      new.veiculo_id = v_viagem.veiculo_id;
    end if;
    if new.motorista_id <> v_viagem.motorista_id or new.veiculo_id <> v_viagem.veiculo_id then
      raise exception 'Abastecimento incompatível com motorista/veículo da viagem';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.sincronizar_despesa_viagem()
returns trigger
language plpgsql
as $$
declare
  v_viagem public.viagens%rowtype;
begin
  if new.viagem_id is not null then
    select * into v_viagem from public.viagens where id = new.viagem_id;
    if not found then
      raise exception 'Viagem % não encontrada', new.viagem_id;
    end if;
    if new.motorista_id is null then
      new.motorista_id = v_viagem.motorista_id;
    end if;
    if new.veiculo_id is null then
      new.veiculo_id = v_viagem.veiculo_id;
    end if;
    if new.motorista_id <> v_viagem.motorista_id or new.veiculo_id <> v_viagem.veiculo_id then
      raise exception 'Despesa incompatível com motorista/veículo da viagem';
    end if;
  end if;

  return new;
end;
$$;

-- =========================================================
-- 09. MANUTENÇÕES
-- =========================================================
create table if not exists public.manutencoes (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid not null references public.veiculos(id) on delete restrict,
  tipo_manutencao text not null default 'preventiva',
  causa text,
  aberto_em timestamptz not null default now(),
  iniciado_em timestamptz,
  concluido_em timestamptz,
  km_veiculo numeric(14,2),
  mecanico_responsavel_id uuid references public.mecanicos(id) on delete set null,
  status text not null default 'aberta',
  valor_total_informado numeric(12,2),
  observacoes text,
  cancelado_em timestamptz,
  motivo_cancelamento text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references public.perfis(id) on delete set null,
  atualizado_por uuid references public.perfis(id) on delete set null,
  constraint manutencoes_tipo_check check (tipo_manutencao in ('preventiva', 'corretiva')),
  constraint manutencoes_status_check check (status in ('aberta', 'em_andamento', 'concluida', 'cancelada')),
  constraint manutencoes_km_check check (km_veiculo is null or km_veiculo >= 0),
  constraint manutencoes_valor_check check (valor_total_informado is null or valor_total_informado >= 0),
  constraint manutencoes_datas_check check (
    (iniciado_em is null or iniciado_em >= aberto_em) and
    (concluido_em is null or concluido_em >= coalesce(iniciado_em, aberto_em))
  ),
  constraint manutencoes_concluida_check check ((status <> 'concluida') or concluido_em is not null),
  constraint manutencoes_cancelada_check check ((status <> 'cancelada') or cancelado_em is not null)
);

create table if not exists public.manutencao_mecanicos (
  id uuid primary key default gen_random_uuid(),
  manutencao_id uuid not null references public.manutencoes(id) on delete cascade,
  mecanico_id uuid not null references public.mecanicos(id) on delete restrict,
  papel text not null default 'apoio',
  criado_em timestamptz not null default now(),
  criado_por uuid references public.perfis(id) on delete set null,
  constraint manutencao_mecanicos_papel_check check (papel in ('responsavel', 'apoio'))
);

create unique index if not exists manutencao_mecanicos_responsavel_uniq
  on public.manutencao_mecanicos(manutencao_id)
  where papel = 'responsavel';

create table if not exists public.manutencao_servicos (
  id uuid primary key default gen_random_uuid(),
  manutencao_id uuid not null references public.manutencoes(id) on delete cascade,
  servico_id uuid not null references public.servicos(id) on delete restrict,
  nome_servico_snapshot text not null,
  categoria_snapshot text not null,
  valor_aplicado numeric(12,2),
  observacoes text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references public.perfis(id) on delete set null,
  atualizado_por uuid references public.perfis(id) on delete set null,
  constraint manutencao_servicos_valor_check check (valor_aplicado is null or valor_aplicado >= 0)
);

create index if not exists manutencao_servicos_manutencao_idx on public.manutencao_servicos(manutencao_id);
create index if not exists manutencao_servicos_servico_idx on public.manutencao_servicos(servico_id);

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
  constraint pecas_unidade_check check (unidade_medida in ('unidade','litro','kit','metro','par')),
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

create index if not exists manutencao_pecas_manutencao_idx on public.manutencao_pecas(manutencao_id);
create index if not exists manutencao_pecas_peca_idx on public.manutencao_pecas(peca_id);
create index if not exists despesa_pecas_despesa_idx on public.despesa_pecas(despesa_id);
create index if not exists despesa_pecas_peca_idx on public.despesa_pecas(peca_id);
create index if not exists estoque_movimentacoes_peca_data_idx on public.estoque_movimentacoes(peca_id, criado_em desc);
create index if not exists estoque_movimentacoes_manutencao_idx on public.estoque_movimentacoes(manutencao_id);
create index if not exists estoque_movimentacoes_despesa_idx on public.estoque_movimentacoes(despesa_id);

create or replace function public.validar_quantidade_peca_discreta()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_unidade text;
begin
  if tg_table_name = 'pecas' then
    v_unidade := new.unidade_medida;
    if v_unidade not in ('litro', 'metro')
      and (
        new.quantidade_estoque <> trunc(new.quantidade_estoque)
        or new.estoque_minimo <> trunc(new.estoque_minimo)
      )
    then
      raise exception 'Estoque de unidade, kit e par deve ser informado em números inteiros';
    end if;
  else
    select unidade_medida into v_unidade
    from public.pecas
    where id = new.peca_id;

    if v_unidade not in ('litro', 'metro') and new.quantidade <> trunc(new.quantidade) then
      raise exception 'A quantidade de unidade, kit e par deve ser um número inteiro';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validar_quantidade_peca_discreta_trg on public.pecas;
create trigger validar_quantidade_peca_discreta_trg
  before insert or update of unidade_medida, quantidade_estoque, estoque_minimo on public.pecas
  for each row execute function public.validar_quantidade_peca_discreta();

drop trigger if exists validar_quantidade_manutencao_peca_discreta_trg on public.manutencao_pecas;
create trigger validar_quantidade_manutencao_peca_discreta_trg
  before insert or update of peca_id, quantidade on public.manutencao_pecas
  for each row execute function public.validar_quantidade_peca_discreta();

drop trigger if exists validar_quantidade_despesa_peca_discreta_trg on public.despesa_pecas;
create trigger validar_quantidade_despesa_peca_discreta_trg
  before insert or update of peca_id, quantidade on public.despesa_pecas
  for each row execute function public.validar_quantidade_peca_discreta();

alter table public.veiculo_servico_programacoes
  drop constraint if exists veiculo_servico_programacoes_ultimo_realizado_fk;
alter table public.veiculo_servico_programacoes
  add constraint veiculo_servico_programacoes_ultimo_realizado_fk
  foreign key (ultimo_realizado_manutencao_id) references public.manutencoes(id) on delete set null;

create or replace function public.sincronizar_manutencao_servico_snapshot()
returns trigger
language plpgsql
as $$
declare
  v_servico record;
begin
  select nome, categoria into v_servico from public.servicos where id = new.servico_id;
  if not found then
    raise exception 'Serviço % não encontrado', new.servico_id;
  end if;
  new.nome_servico_snapshot = coalesce(new.nome_servico_snapshot, v_servico.nome);
  new.categoria_snapshot = coalesce(new.categoria_snapshot, v_servico.categoria);
  return new;
end;
$$;

-- =========================================================
-- 10. PENDÊNCIAS HÍBRIDAS, INTERAÇÕES E AUDITORIA
-- =========================================================
create table if not exists public.pendencias_manuais (
  id uuid primary key default gen_random_uuid(),
  tipo text not null default 'manual',
  severidade text not null default 'atencao',
  titulo text not null,
  descricao text,
  veiculo_id uuid references public.veiculos(id) on delete set null,
  motorista_id uuid references public.motoristas(id) on delete set null,
  mecanico_id uuid references public.mecanicos(id) on delete set null,
  servico_id uuid references public.servicos(id) on delete set null,
  manutencao_id uuid references public.manutencoes(id) on delete set null,
  vencimento_em date,
  vencimento_km numeric(14,2),
  status text not null default 'aberta',
  resolvida_em timestamptz,
  resolvida_por uuid references public.perfis(id) on delete set null,
  observacoes_resolucao text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references public.perfis(id) on delete set null,
  atualizado_por uuid references public.perfis(id) on delete set null,
  constraint pendencias_manuais_severidade_check check (severidade in ('baixa', 'atencao', 'critica')),
  constraint pendencias_manuais_status_check check (status in ('aberta', 'resolvida', 'cancelada')),
  constraint pendencias_manuais_resolvida_check check ((status <> 'resolvida') or resolvida_em is not null)
);

create table if not exists public.pendencia_interacoes (
  id uuid primary key default gen_random_uuid(),
  pendencia_chave text not null,
  pendencia_origem text not null,
  acao text not null,
  observacao text,
  criado_em timestamptz not null default now(),
  criado_por uuid not null references public.perfis(id) on delete restrict,
  constraint pendencia_interacoes_origem_check check (pendencia_origem in ('calculada', 'manual')),
  constraint pendencia_interacoes_acao_check check (acao in ('visualizada', 'resolvida_manual', 'ignorada'))
);

create table if not exists public.auditoria_eventos (
  id uuid primary key default gen_random_uuid(),
  tabela text not null,
  registro_id uuid,
  acao text not null,
  dados_antes jsonb,
  dados_depois jsonb,
  motivo text,
  criado_em timestamptz not null default now(),
  criado_por uuid references public.perfis(id) on delete set null
);

-- =========================================================
-- 11. TRIGGERS
-- =========================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'perfis','motoristas','mecanicos','rotas','veiculos','veiculo_motoristas','tipos_documento_veiculo',
    'veiculo_documentos','servicos','veiculo_servico_programacoes','viagens','abastecimentos',
    'despesas_viagem','manutencoes','manutencao_servicos','pecas','manutencao_pecas','despesa_pecas','pendencias_manuais'
  ] loop
    execute format('drop trigger if exists set_%s_atualizado_em on public.%I', t, t);
    execute format('create trigger set_%s_atualizado_em before update on public.%I for each row execute function public.set_atualizado_em()', t, t);
  end loop;
end $$;

drop trigger if exists impedir_regressao_km_veiculo_trg on public.veiculos;
create trigger impedir_regressao_km_veiculo_trg
  before update of km_atual on public.veiculos
  for each row execute function public.impedir_regressao_km_veiculo();

drop trigger if exists sincronizar_abastecimento_trg on public.abastecimentos;
create trigger sincronizar_abastecimento_trg
  before insert or update on public.abastecimentos
  for each row execute function public.sincronizar_abastecimento();

drop trigger if exists sincronizar_despesa_viagem_trg on public.despesas_viagem;
create trigger sincronizar_despesa_viagem_trg
  before insert or update on public.despesas_viagem
  for each row execute function public.sincronizar_despesa_viagem();

drop trigger if exists manutencao_servicos_snapshot_trg on public.manutencao_servicos;
create trigger manutencao_servicos_snapshot_trg
  before insert or update on public.manutencao_servicos
  for each row execute function public.sincronizar_manutencao_servico_snapshot();

-- =========================================================
-- 12. VIEWS OPERACIONAIS
-- =========================================================
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
  coalesce(abast.custo_abastecimento_total, 0) + coalesce(manut.custo_manutencao_total, 0) + coalesce(desp.custo_despesas_total, 0) as custo_total_operacional
from public.veiculos v
left join public.rotas r on r.id = v.rota_fixa_id
left join public.veiculo_motoristas vm on vm.veiculo_id = v.id and vm.ativo = true and vm.principal = true and vm.fim_em is null
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

create or replace view public.vw_viagens_detalhadas
with (security_invoker = true)
as
select
  vi.*,
  p.nome as motorista_nome,
  v.placa as veiculo_placa,
  v.marca as veiculo_marca,
  v.modelo as veiculo_modelo,
  case when vi.status = 'concluida' then vi.km_final - vi.km_inicial else null end as km_total,
  coalesce((select sum(a.litros) from public.abastecimentos a where a.viagem_id = vi.id and a.cancelado_em is null and a.tipo_combustivel <> 'ARLA'),0) as litros_combustivel,
  coalesce((select sum(coalesce(a.valor_total,0)) from public.abastecimentos a where a.viagem_id = vi.id and a.cancelado_em is null),0) as valor_abastecimento,
  coalesce((select sum(d.valor) from public.despesas_viagem d where d.viagem_id = vi.id and d.cancelado_em is null),0) as valor_despesas
from public.viagens vi
join public.motoristas m on m.id = vi.motorista_id
left join public.perfis p on p.id = m.perfil_id
join public.veiculos v on v.id = vi.veiculo_id;

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

create or replace view public.vw_servicos_programados_status
with (security_invoker = true)
as
select
  p.*,
  v.placa as veiculo_placa,
  v.km_atual,
  s.nome as servico_nome,
  s.categoria as servico_categoria,
  case
    when not p.ativo or p.excluido_em is not null then 'inativo'
    when p.periodicidade_tipo_snapshot = 'km' and p.proximo_vencimento_km is not null and v.km_atual >= p.proximo_vencimento_km then 'vencido'
    when p.periodicidade_tipo_snapshot = 'km' and p.proximo_vencimento_km is not null and (p.proximo_vencimento_km - v.km_atual) <= p.km_alerta then 'proximo'
    when p.periodicidade_tipo_snapshot = 'tempo' and p.proximo_vencimento_em is not null and p.proximo_vencimento_em < current_date then 'vencido'
    when p.periodicidade_tipo_snapshot = 'tempo' and p.proximo_vencimento_em is not null and p.proximo_vencimento_em <= current_date + make_interval(days => p.dias_alerta) then 'proximo'
    else 'em_dia'
  end as status_calculado,
  case
    when p.periodicidade_tipo_snapshot = 'km' and p.proximo_vencimento_km is not null then p.proximo_vencimento_km - v.km_atual
    else null
  end as km_restante
from public.veiculo_servico_programacoes p
join public.veiculos v on v.id = p.veiculo_id
join public.servicos s on s.id = p.servico_id;

create or replace view public.vw_documentos_veiculo_status
with (security_invoker = true)
as
select
  d.*,
  v.placa as veiculo_placa,
  t.codigo as tipo_codigo,
  t.nome as tipo_nome,
  public.calcular_status_vencimento(d.vencimento_em, t.dias_alerta) as status_calculado,
  public.calcular_severidade_vencimento(d.vencimento_em, t.dias_alerta) as severidade_calculada
from public.veiculo_documentos d
join public.tipos_documento_veiculo t on t.id = d.tipo_documento_id
join public.veiculos v on v.id = d.veiculo_id
where d.status_operacional = 'ativo' and d.excluido_em is null;

create or replace view public.vw_pendencias_calculadas
with (security_invoker = true)
as
select
  'servico:' || p.id::text as chave,
  'calculada'::text as origem,
  case when p.status_calculado = 'vencido' then 'critica' else 'atencao' end as severidade,
  case when p.periodicidade_tipo_snapshot = 'km' then 'servico_km' else 'servico_tempo' end as tipo,
  p.veiculo_id,
  null::uuid as motorista_id,
  null::uuid as mecanico_id,
  p.servico_id,
  null::uuid as manutencao_id,
  (p.servico_nome || case when p.status_calculado = 'vencido' then ' vencido' else ' próximo' end) as titulo,
  (p.veiculo_placa || ' · ' || p.servico_nome || ' · status: ' || p.status_calculado) as descricao,
  p.proximo_vencimento_em as vencimento_em,
  p.proximo_vencimento_km as vencimento_km,
  p.km_atual,
  'aberta'::text as status,
  'Registrar manutenção'::text as acao_label
from public.vw_servicos_programados_status p
where p.status_calculado in ('proximo','vencido')
union all
select
  'documento:' || d.id::text,
  'calculada',
  d.severidade_calculada,
  d.tipo_codigo,
  d.veiculo_id,
  null::uuid,
  null::uuid,
  null::uuid,
  null::uuid,
  d.tipo_nome || ' ' || case when d.status_calculado = 'vencido' then 'vencido' else 'próximo' end,
  d.veiculo_placa || ' · vencimento em ' || d.vencimento_em::text,
  d.vencimento_em,
  null::numeric,
  null::numeric,
  'aberta',
  'Abrir veículo'
from public.vw_documentos_veiculo_status d
where d.status_calculado in ('proximo','vencido')
union all
select
  'cnh:' || m.id::text,
  'calculada',
  public.calcular_severidade_vencimento(m.validade_habilitacao, 30),
  'cnh',
  null::uuid,
  m.id,
  null::uuid,
  null::uuid,
  null::uuid,
  'CNH ' || case when public.calcular_status_vencimento(m.validade_habilitacao, 30) = 'vencido' then 'vencida' else 'próxima do vencimento' end,
  p.nome || ' · vencimento em ' || m.validade_habilitacao::text,
  m.validade_habilitacao,
  null::numeric,
  null::numeric,
  'aberta',
  'Abrir motorista'
from public.motoristas m
join public.perfis p on p.id = m.perfil_id
where m.excluido_em is null
  and public.calcular_status_vencimento(m.validade_habilitacao, 30) in ('proximo','vencido')
union all
select
  'manutencao:' || mn.id::text,
  'calculada',
  case when mn.status = 'aberta' then 'critica' else 'atencao' end,
  'manutencao_aberta',
  mn.veiculo_id,
  null::uuid,
  mn.mecanico_responsavel_id,
  null::uuid,
  mn.id,
  'Manutenção ' || mn.status,
  v.placa || ' · ' || coalesce(mn.causa, 'sem descrição'),
  mn.concluido_em::date,
  null::numeric,
  mn.km_veiculo,
  'aberta',
  'Abrir manutenção'
from public.manutencoes mn
join public.veiculos v on v.id = mn.veiculo_id
where mn.status in ('aberta','em_andamento')
union all
select
  'veiculo_status:' || v.id::text,
  'calculada',
  case when v.status_operacional in ('indisponivel','em_manutencao') then 'critica' else 'atencao' end,
  'veiculo_status',
  v.id,
  null::uuid,
  null::uuid,
  null::uuid,
  null::uuid,
  'Veículo ' || v.status_operacional,
  v.placa || ' · ' || v.marca || ' ' || v.modelo,
  null::date,
  null::numeric,
  v.km_atual,
  'aberta',
  'Abrir veículo'
from public.veiculos v
where v.status_operacional in ('em_manutencao','indisponivel') and v.excluido_em is null;

create or replace view public.vw_pendencias_operacionais
with (security_invoker = true)
as
select * from public.vw_pendencias_calculadas
union all
select
  'manual:' || pm.id::text as chave,
  'manual'::text as origem,
  pm.severidade,
  pm.tipo,
  pm.veiculo_id,
  pm.motorista_id,
  pm.mecanico_id,
  pm.servico_id,
  pm.manutencao_id,
  pm.titulo,
  pm.descricao,
  pm.vencimento_em,
  pm.vencimento_km,
  null::numeric as km_atual,
  pm.status,
  'Abrir pendência'::text as acao_label
from public.pendencias_manuais pm
where pm.status = 'aberta';

-- =========================================================
-- 13. RPCs TRANSACIONAIS
-- =========================================================
create or replace function public.fn_iniciar_viagem(
  p_veiculo_id uuid,
  p_motorista_id uuid default null,
  p_rota_id uuid default null,
  p_origem text default null,
  p_destino text default null,
  p_saiu_em timestamptz default now(),
  p_km_inicial numeric default null,
  p_observacoes text default null,
  p_veiculo_temporario boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_motorista_id uuid;
  v_veiculo public.veiculos%rowtype;
  v_rota public.rotas%rowtype;
  v_id uuid;
begin
  if not public.perfil_ativo() then
    raise exception 'Perfil inativo ou não autenticado';
  end if;

  if public.eh_admin() then
    v_motorista_id := p_motorista_id;
  else
    v_motorista_id := public.motorista_atual_id();
  end if;

  if v_motorista_id is null then
    raise exception 'Motorista não identificado';
  end if;

  select * into v_veiculo from public.veiculos where id = p_veiculo_id and excluido_em is null for update;
  if not found then
    raise exception 'Veículo não encontrado';
  end if;

  if v_veiculo.status_operacional in ('em_manutencao','inativo','indisponivel') and not public.eh_admin() then
    raise exception 'Veículo indisponível para início de viagem';
  end if;

  if not public.eh_admin() then
    if not exists (
      select 1 from public.veiculo_motoristas vm
      where vm.veiculo_id = p_veiculo_id
        and vm.motorista_id = v_motorista_id
        and vm.ativo = true
        and vm.fim_em is null
    ) then
      raise exception 'Motorista não possui vínculo ativo com este veículo';
    end if;
  end if;

  if exists (select 1 from public.viagens where motorista_id = v_motorista_id and status = 'em_andamento') then
    raise exception 'Motorista já possui viagem em andamento';
  end if;
  if exists (select 1 from public.viagens where veiculo_id = p_veiculo_id and status = 'em_andamento') then
    raise exception 'Veículo já possui viagem em andamento';
  end if;

  if p_rota_id is not null then
    select * into v_rota from public.rotas where id = p_rota_id;
    if not found then
      raise exception 'Rota não encontrada';
    end if;
  elsif v_veiculo.rota_fixa_id is not null then
    select * into v_rota from public.rotas where id = v_veiculo.rota_fixa_id;
  end if;

  if coalesce(p_origem, v_rota.origem) is null or coalesce(p_destino, v_rota.destino) is null then
    raise exception 'Origem e destino são obrigatórios quando não há rota válida';
  end if;

  if coalesce(p_km_inicial, v_veiculo.km_atual) < v_veiculo.km_atual then
    raise exception 'KM inicial não pode ser menor que o KM atual do veículo';
  end if;

  insert into public.viagens (
    motorista_id, veiculo_id, rota_id, rota_nome_snapshot, origem_snapshot, destino_snapshot, km_estimado_snapshot,
    saiu_em, status, km_inicial, veiculo_temporario, observacoes, criado_por
  ) values (
    v_motorista_id,
    p_veiculo_id,
    coalesce(p_rota_id, v_veiculo.rota_fixa_id),
    v_rota.nome,
    coalesce(p_origem, v_rota.origem),
    coalesce(p_destino, v_rota.destino),
    v_rota.km_estimado,
    coalesce(p_saiu_em, now()),
    'em_andamento',
    coalesce(p_km_inicial, v_veiculo.km_atual),
    p_veiculo_temporario,
    p_observacoes,
    auth.uid()
  ) returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.fn_concluir_viagem(
  p_viagem_id uuid,
  p_km_final numeric,
  p_chegou_em timestamptz default now(),
  p_observacoes text default null
)
returns public.viagens
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_viagem public.viagens%rowtype;
  v_motorista uuid;
  v_ultimo_km_abastecimento numeric;
  v_chegou_em timestamptz;
begin
  if not public.perfil_ativo() then
    raise exception 'Perfil inativo ou não autenticado';
  end if;

  select * into v_viagem from public.viagens where id = p_viagem_id for update;
  if not found then raise exception 'Viagem não encontrada'; end if;

  v_motorista := public.motorista_atual_id();
  if not public.eh_admin() and v_viagem.motorista_id <> v_motorista then
    raise exception 'Sem permissão para concluir esta viagem';
  end if;
  if v_viagem.status <> 'em_andamento' then
    raise exception 'Somente viagem em andamento pode ser concluída';
  end if;
  select max(km_registrado)
    into v_ultimo_km_abastecimento
    from public.abastecimentos
    where viagem_id = p_viagem_id
      and cancelado_em is null;

  if p_km_final < greatest(v_viagem.km_inicial, coalesce(v_ultimo_km_abastecimento, v_viagem.km_inicial)) then
    raise exception 'KM final não pode ser menor que o último KM registrado na viagem';
  end if;

  v_chegou_em := coalesce(p_chegou_em, now());
  if v_chegou_em < v_viagem.saiu_em then
    raise exception 'Data de chegada não pode ser anterior à data de saída';
  end if;

  update public.viagens
    set status = 'concluida',
        km_final = p_km_final,
        chegou_em = v_chegou_em,
        observacoes = coalesce(p_observacoes, observacoes),
        atualizado_por = auth.uid()
    where id = p_viagem_id
    returning * into v_viagem;

  update public.veiculos
    set km_atual = greatest(km_atual, p_km_final),
        atualizado_por = auth.uid()
    where id = v_viagem.veiculo_id;

  return v_viagem;
end;
$$;

create or replace function public.fn_registrar_abastecimento(
  p_viagem_id uuid,
  p_km_registrado numeric,
  p_tipo_combustivel text,
  p_litros numeric,
  p_observacoes text default null
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
  select * into v_viagem from public.viagens where id = p_viagem_id;
  if not found then raise exception 'Viagem não encontrada'; end if;
  if not public.eh_admin() and v_viagem.motorista_id <> public.motorista_atual_id() then
    raise exception 'Sem permissão para registrar abastecimento nesta viagem';
  end if;
  if v_viagem.status <> 'em_andamento' then raise exception 'Abastecimento operacional só pode ser registrado em viagem em andamento'; end if;
  if p_km_registrado < v_viagem.km_inicial then raise exception 'KM do abastecimento não pode ser menor que o KM inicial da viagem'; end if;

  insert into public.abastecimentos (viagem_id, motorista_id, veiculo_id, km_registrado, tipo_combustivel, litros, observacoes, criado_por)
  values (p_viagem_id, v_viagem.motorista_id, v_viagem.veiculo_id, p_km_registrado, p_tipo_combustivel, p_litros, p_observacoes, auth.uid())
  returning id into v_id;
  return v_id;
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
  if v_viagem.status <> 'em_andamento' then raise exception 'Despesa operacional só pode ser registrada em viagem em andamento'; end if;

  insert into public.despesas_viagem (viagem_id, motorista_id, veiculo_id, categoria, valor, observacoes, comprovante_path, criado_por)
  values (p_viagem_id, v_viagem.motorista_id, v_viagem.veiculo_id, p_categoria, p_valor, p_observacoes, p_comprovante_path, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

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
      abs(v_diferenca), p_valor_unitario, v_peca.quantidade_estoque,
      p_quantidade_estoque, 'Ajuste manual pelo cadastro de peças', auth.uid()
    );
  end if;
  return p_peca_id;
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
      select * into v_peca from public.pecas
      where id = (v_item->>'peca_id')::uuid for update;
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
          else null end,
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

    select * into v_peca from public.pecas
    where id = v_peca_id and ativo = true and excluido_em is null for update;
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
  if p_manutencao_id is null or p_status <> 'concluida' then
    raise exception 'Manutenção concluída inválida';
  end if;
  if p_tipo_manutencao not in ('preventiva', 'corretiva') then
    raise exception 'Tipo de manutenção inválido';
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
    select 1 from jsonb_array_elements(coalesce(p_pecas, '[]'::jsonb)) item
    group by item->>'partId' having count(*) > 1
  ) then
    raise exception 'A mesma peça não pode ser informada mais de uma vez';
  end if;

  select * into v_manutencao
  from public.manutencoes
  where id = p_manutencao_id
  for update;
  if not found then raise exception 'Manutenção não encontrada'; end if;
  if v_manutencao.status <> 'concluida' then
    raise exception 'Esta rotina edita somente manutenções concluídas';
  end if;
  if v_manutencao.veiculo_id <> p_veiculo_id then
    raise exception 'O veículo de uma manutenção concluída não pode ser alterado';
  end if;
  if not exists (
    select 1 from public.mecanicos
    where id = p_mecanico_responsavel_id
      and status_profissional = 'ativo' and excluido_em is null
  ) then
    raise exception 'Mecânico responsável inválido';
  end if;
  if (
    select count(*) from public.servicos
    where id = any(p_servico_ids) and ativo = true and excluido_em is null
  ) <> cardinality(p_servico_ids) then
    raise exception 'Um ou mais serviços não estão disponíveis';
  end if;

  select coalesce(array_agg(servico_id), '{}'::uuid[])
  into v_servicos_anteriores
  from public.manutencao_servicos
  where manutencao_id = p_manutencao_id;

  for v_item in
    select * from public.manutencao_pecas
    where manutencao_id = p_manutencao_id and estoque_devolvido_em is null
    for update
  loop
    select * into v_peca from public.pecas where id = v_item.peca_id for update;
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

  delete from public.manutencao_pecas where manutencao_id = p_manutencao_id;
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

  delete from public.manutencao_servicos where manutencao_id = p_manutencao_id;
  insert into public.manutencao_servicos (
    manutencao_id, servico_id, nome_servico_snapshot, categoria_snapshot,
    criado_por, atualizado_por
  )
  select p_manutencao_id, s.id, s.nome, s.categoria, auth.uid(), auth.uid()
  from public.servicos s where s.id = any(p_servico_ids);

  delete from public.manutencao_mecanicos
  where manutencao_id = p_manutencao_id and papel = 'responsavel';
  insert into public.manutencao_mecanicos (
    manutencao_id, mecanico_id, papel, criado_por
  ) values (
    p_manutencao_id, p_mecanico_responsavel_id, 'responsavel', auth.uid()
  );

  for v_peca_json in
    select value from jsonb_array_elements(coalesce(p_pecas, '[]'::jsonb))
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
    select * into v_peca from public.pecas
    where id = v_peca_id and ativo = true and excluido_em is null
    for update;
    if not found then raise exception 'Peça não encontrada ou inativa'; end if;
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
  set km_atual = greatest(km_atual, p_km_veiculo), atualizado_por = auth.uid()
  where id = p_veiculo_id;

  select array_agg(distinct servico_id)
  into v_servicos_afetados
  from unnest(v_servicos_anteriores || p_servico_ids) as servico_id;

  foreach v_servico_id in array coalesce(v_servicos_afetados, '{}'::uuid[])
  loop
    select m.* into v_ultima_manutencao
    from public.manutencoes m
    join public.manutencao_servicos ms on ms.manutencao_id = m.id
    where m.veiculo_id = p_veiculo_id
      and m.status = 'concluida'
      and ms.servico_id = v_servico_id
    order by m.concluido_em desc, m.id desc
    limit 1;
    if not found then
      delete from public.veiculo_servico_programacoes
      where veiculo_id = p_veiculo_id and servico_id = v_servico_id;
      continue;
    end if;
    select * into v_servico from public.servicos where id = v_servico_id;
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
      case when v_servico.tipo_periodicidade = 'tempo'
        then v_ultima_manutencao.concluido_em::date + v_servico.periodicidade_dias
        else null end,
      case when v_servico.tipo_periodicidade = 'km'
        then v_ultima_manutencao.km_veiculo + v_servico.periodicidade_km
        else null end,
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
  end loop;

  return p_manutencao_id;
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
  select * into v_manutencao from public.manutencoes
  where id = p_manutencao_id for update;
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
  set status = 'cancelada', cancelado_em = now(),
      motivo_cancelamento = trim(p_motivo), atualizado_por = auth.uid()
  where id = p_manutencao_id
  returning * into v_manutencao;

  if not exists (
    select 1 from public.manutencoes
    where veiculo_id = v_manutencao.veiculo_id
      and status in ('aberta', 'em_andamento') and id <> p_manutencao_id
  ) then
    update public.veiculos
    set status_operacional = 'ativo', atualizado_por = auth.uid()
    where id = v_manutencao.veiculo_id and status_operacional = 'em_manutencao';
  end if;
  return v_manutencao;
end;
$$;

create or replace function public.fn_concluir_manutencao(p_manutencao_id uuid)
returns public.manutencoes
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_manutencao public.manutencoes%rowtype;
  r record;
  v_servico public.servicos%rowtype;
  v_km_base numeric;
begin
  if not (public.eh_admin() or public.eh_mecanico()) then
    raise exception 'Sem permissão para concluir manutenção';
  end if;

  select * into v_manutencao from public.manutencoes where id = p_manutencao_id for update;
  if not found then raise exception 'Manutenção não encontrada'; end if;
  if v_manutencao.status = 'cancelada' then raise exception 'Manutenção cancelada não pode ser concluída'; end if;
  if v_manutencao.status = 'concluida' then raise exception 'Manutenção já está concluída'; end if;

  select km_atual into v_km_base
  from public.veiculos
  where id = v_manutencao.veiculo_id
  for update;

  update public.manutencoes
    set status = 'concluida', concluido_em = coalesce(concluido_em, now()), atualizado_por = auth.uid()
    where id = p_manutencao_id
    returning * into v_manutencao;

  for r in select * from public.manutencao_servicos where manutencao_id = p_manutencao_id loop
    select * into v_servico from public.servicos where id = r.servico_id;
    insert into public.veiculo_servico_programacoes (
      veiculo_id, servico_id, periodicidade_tipo_snapshot, periodicidade_km_snapshot, periodicidade_dias_snapshot,
      ultimo_realizado_manutencao_id, ultimo_realizado_em, ultimo_realizado_km,
      proximo_vencimento_em, proximo_vencimento_km, criado_por
    ) values (
      v_manutencao.veiculo_id,
      r.servico_id,
      v_servico.tipo_periodicidade,
      v_servico.periodicidade_km,
      v_servico.periodicidade_dias,
      v_manutencao.id,
      v_manutencao.concluido_em::date,
      coalesce(v_manutencao.km_veiculo, v_km_base),
      case when v_servico.tipo_periodicidade = 'tempo' then (v_manutencao.concluido_em::date + v_servico.periodicidade_dias) else null end,
      case when v_servico.tipo_periodicidade = 'km' then (coalesce(v_manutencao.km_veiculo, v_km_base) + v_servico.periodicidade_km) else null end,
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
  end loop;

  if not exists (select 1 from public.manutencoes where veiculo_id = v_manutencao.veiculo_id and status in ('aberta','em_andamento') and id <> p_manutencao_id) then
    update public.veiculos set status_operacional = 'ativo', atualizado_por = auth.uid() where id = v_manutencao.veiculo_id and status_operacional = 'em_manutencao';
  end if;

  return v_manutencao;
end;
$$;

create or replace function public.fn_renovar_documento_veiculo(
  p_documento_id uuid,
  p_numero text,
  p_emitido_em date,
  p_vencimento_em date,
  p_arquivo_path text default null,
  p_observacoes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_doc public.veiculo_documentos%rowtype;
  v_novo_id uuid;
begin
  if not public.eh_admin() then
    raise exception 'Somente admin pode renovar documento';
  end if;
  select * into v_doc from public.veiculo_documentos where id = p_documento_id for update;
  if not found then raise exception 'Documento não encontrado'; end if;
  if v_doc.status_operacional <> 'ativo' or v_doc.excluido_em is not null then
    raise exception 'Somente documento ativo pode ser renovado';
  end if;

  -- Libera a unicidade do documento ativo antes da nova inserção.
  -- Se qualquer etapa falhar, a transação reverte esta alteração.
  update public.veiculo_documentos
    set status_operacional = 'substituido',
        atualizado_por = auth.uid()
    where id = p_documento_id;

  insert into public.veiculo_documentos (veiculo_id, tipo_documento_id, numero, emitido_em, vencimento_em, arquivo_path, observacoes, criado_por)
  values (v_doc.veiculo_id, v_doc.tipo_documento_id, p_numero, p_emitido_em, p_vencimento_em, p_arquivo_path, p_observacoes, auth.uid())
  returning id into v_novo_id;

  update public.veiculo_documentos
    set substituido_por_id = v_novo_id,
        atualizado_por = auth.uid()
    where id = p_documento_id;

  return v_novo_id;
end;
$$;

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

-- =========================================================
-- 14. ÍNDICES
-- =========================================================
create index if not exists perfis_papel_ativo_idx on public.perfis(papel, ativo);
create index if not exists motoristas_perfil_idx on public.motoristas(perfil_id);
create index if not exists motoristas_status_idx on public.motoristas(status_profissional);
create index if not exists motoristas_validade_habilitacao_idx on public.motoristas(validade_habilitacao);
create index if not exists mecanicos_perfil_idx on public.mecanicos(perfil_id);
create index if not exists veiculos_status_idx on public.veiculos(status_operacional);
create index if not exists veiculos_rota_fixa_idx on public.veiculos(rota_fixa_id);
create index if not exists veiculo_motoristas_veiculo_idx on public.veiculo_motoristas(veiculo_id);
create index if not exists veiculo_motoristas_motorista_idx on public.veiculo_motoristas(motorista_id);
create index if not exists veiculo_documentos_veiculo_idx on public.veiculo_documentos(veiculo_id);
create index if not exists veiculo_documentos_vencimento_idx on public.veiculo_documentos(vencimento_em);
create index if not exists servicos_categoria_idx on public.servicos(categoria);
create index if not exists servicos_ativo_idx on public.servicos(ativo);
create index if not exists veiculo_servico_programacoes_veiculo_idx on public.veiculo_servico_programacoes(veiculo_id);
create index if not exists veiculo_servico_programacoes_servico_idx on public.veiculo_servico_programacoes(servico_id);
create index if not exists veiculo_servico_programacoes_km_idx on public.veiculo_servico_programacoes(proximo_vencimento_km);
create index if not exists veiculo_servico_programacoes_data_idx on public.veiculo_servico_programacoes(proximo_vencimento_em);
create index if not exists viagens_motorista_idx on public.viagens(motorista_id);
create index if not exists viagens_veiculo_idx on public.viagens(veiculo_id);
create index if not exists viagens_status_idx on public.viagens(status);
create index if not exists viagens_saida_idx on public.viagens(saiu_em);
create index if not exists viagens_periodo_veiculo_idx on public.viagens(veiculo_id, saiu_em);
create index if not exists viagens_periodo_motorista_idx on public.viagens(motorista_id, saiu_em);
create index if not exists abastecimentos_viagem_idx on public.abastecimentos(viagem_id);
create index if not exists abastecimentos_veiculo_periodo_idx on public.abastecimentos(veiculo_id, registrado_em);
create index if not exists abastecimentos_motorista_periodo_idx on public.abastecimentos(motorista_id, registrado_em);
create index if not exists abastecimentos_tipo_idx on public.abastecimentos(tipo_combustivel);
create index if not exists despesas_viagem_idx on public.despesas_viagem(viagem_id);
create index if not exists despesas_veiculo_periodo_idx on public.despesas_viagem(veiculo_id, registrado_em);
create index if not exists despesas_motorista_periodo_idx on public.despesas_viagem(motorista_id, registrado_em);
create index if not exists despesas_categoria_idx on public.despesas_viagem(categoria);
create index if not exists manutencoes_veiculo_idx on public.manutencoes(veiculo_id);
create index if not exists manutencoes_status_idx on public.manutencoes(status);
create index if not exists manutencoes_aberto_em_idx on public.manutencoes(aberto_em);
create index if not exists manutencoes_mecanico_idx on public.manutencoes(mecanico_responsavel_id);
create index if not exists pendencias_manuais_status_idx on public.pendencias_manuais(status);
create index if not exists pendencias_manuais_severidade_idx on public.pendencias_manuais(severidade);
create index if not exists pendencia_interacoes_chave_idx on public.pendencia_interacoes(pendencia_chave);
create index if not exists auditoria_eventos_tabela_registro_idx on public.auditoria_eventos(tabela, registro_id);

-- =========================================================
-- 15. RLS
-- =========================================================
alter table public.perfis enable row level security;
alter table public.motoristas enable row level security;
alter table public.mecanicos enable row level security;
alter table public.rotas enable row level security;
alter table public.veiculos enable row level security;
alter table public.veiculo_motoristas enable row level security;
alter table public.tipos_documento_veiculo enable row level security;
alter table public.veiculo_documentos enable row level security;
alter table public.servicos enable row level security;
alter table public.veiculo_servico_programacoes enable row level security;
alter table public.viagens enable row level security;
alter table public.abastecimentos enable row level security;
alter table public.despesas_viagem enable row level security;
alter table public.manutencoes enable row level security;
alter table public.manutencao_mecanicos enable row level security;
alter table public.manutencao_servicos enable row level security;
alter table public.pecas enable row level security;
alter table public.manutencao_pecas enable row level security;
alter table public.despesa_pecas enable row level security;
alter table public.estoque_movimentacoes enable row level security;
alter table public.pendencias_manuais enable row level security;
alter table public.pendencia_interacoes enable row level security;
alter table public.auditoria_eventos enable row level security;

-- Limpeza de policies para reexecução controlada.
do $$
declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'perfis','motoristas','mecanicos','rotas','veiculos','veiculo_motoristas','tipos_documento_veiculo',
        'veiculo_documentos','servicos','veiculo_servico_programacoes','viagens','abastecimentos','despesas_viagem',
        'manutencoes','manutencao_mecanicos','manutencao_servicos','pecas','manutencao_pecas','despesa_pecas',
        'estoque_movimentacoes','pendencias_manuais','pendencia_interacoes','auditoria_eventos'
      )
  loop
    execute format('drop policy if exists %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end $$;

-- PERFIS
create policy perfis_select_proprio_ou_admin on public.perfis
  for select to authenticated
  using (id = auth.uid() or public.eh_admin());

-- MOTORISTAS
create policy motoristas_select_por_papel on public.motoristas
  for select to authenticated
  using (public.eh_admin() or public.eh_mecanico() or perfil_id = auth.uid());

-- MECÂNICOS
create policy mecanicos_select_por_papel on public.mecanicos
  for select to authenticated
  using (public.eh_admin() or perfil_id = auth.uid());

-- ROTAS
create policy rotas_select_por_papel on public.rotas
  for select to authenticated
  using (
    public.eh_admin() or public.eh_mecanico() or exists (
      select 1 from public.veiculos v
      join public.veiculo_motoristas vm on vm.veiculo_id = v.id
      where v.rota_fixa_id = rotas.id
        and vm.motorista_id = public.motorista_atual_id()
        and vm.ativo = true and vm.fim_em is null
    )
  );
create policy rotas_admin_insert on public.rotas
  for insert to authenticated
  with check (public.eh_admin());
create policy rotas_admin_update on public.rotas
  for update to authenticated
  using (public.eh_admin())
  with check (public.eh_admin());

-- VEÍCULOS
create policy veiculos_select_por_papel on public.veiculos
  for select to authenticated
  using (
    public.eh_admin() or public.eh_mecanico() or exists (
      select 1 from public.veiculo_motoristas vm
      where vm.veiculo_id = veiculos.id and vm.motorista_id = public.motorista_atual_id() and vm.ativo = true and vm.fim_em is null
    ) or exists (
      select 1 from public.viagens vi
      where vi.veiculo_id = veiculos.id and vi.motorista_id = public.motorista_atual_id()
    )
  );
create policy veiculos_admin_insert on public.veiculos
  for insert to authenticated
  with check (public.eh_admin());
create policy veiculos_admin_update on public.veiculos
  for update to authenticated
  using (public.eh_admin())
  with check (public.eh_admin());

-- VÍNCULOS VEÍCULO/MOTORISTA
create policy veiculo_motoristas_select_por_papel on public.veiculo_motoristas
  for select to authenticated
  using (public.eh_admin() or public.eh_mecanico() or motorista_id = public.motorista_atual_id());
create policy veiculo_motoristas_admin_insert on public.veiculo_motoristas
  for insert to authenticated
  with check (public.eh_admin());
create policy veiculo_motoristas_admin_update on public.veiculo_motoristas
  for update to authenticated
  using (public.eh_admin())
  with check (public.eh_admin());

-- DOCUMENTOS
create policy tipos_documento_select_operacional on public.tipos_documento_veiculo
  for select to authenticated
  using (public.eh_admin() or public.eh_mecanico() or public.eh_motorista());
create policy tipos_documento_admin_insert on public.tipos_documento_veiculo
  for insert to authenticated
  with check (public.eh_admin());
create policy tipos_documento_admin_update on public.tipos_documento_veiculo
  for update to authenticated
  using (public.eh_admin())
  with check (public.eh_admin());

create policy veiculo_documentos_select_operacional on public.veiculo_documentos
  for select to authenticated
  using (
    public.eh_admin() or public.eh_mecanico() or exists (
      select 1 from public.veiculo_motoristas vm
      where vm.veiculo_id = veiculo_documentos.veiculo_id and vm.motorista_id = public.motorista_atual_id() and vm.ativo = true and vm.fim_em is null
    )
  );
create policy veiculo_documentos_admin_insert on public.veiculo_documentos
  for insert to authenticated
  with check (public.eh_admin());
create policy veiculo_documentos_admin_update on public.veiculo_documentos
  for update to authenticated
  using (public.eh_admin())
  with check (public.eh_admin());

-- SERVIÇOS E PROGRAMAÇÕES
create policy servicos_select_operacional on public.servicos
  for select to authenticated
  using (public.eh_admin() or public.eh_mecanico());
create policy servicos_admin_insert on public.servicos
  for insert to authenticated
  with check (public.eh_admin());
create policy servicos_admin_update on public.servicos
  for update to authenticated
  using (public.eh_admin())
  with check (public.eh_admin());

create policy programacoes_select_operacional on public.veiculo_servico_programacoes
  for select to authenticated
  using (
    public.eh_admin() or public.eh_mecanico() or exists (
      select 1 from public.veiculo_motoristas vm
      where vm.veiculo_id = veiculo_servico_programacoes.veiculo_id and vm.motorista_id = public.motorista_atual_id() and vm.ativo = true and vm.fim_em is null
    )
  );
create policy programacoes_admin_mecanico_insert on public.veiculo_servico_programacoes
  for insert to authenticated
  with check (public.eh_admin() or public.eh_mecanico());
create policy programacoes_admin_mecanico_update on public.veiculo_servico_programacoes
  for update to authenticated
  using (public.eh_admin() or public.eh_mecanico())
  with check (public.eh_admin() or public.eh_mecanico());

-- VIAGENS
create policy viagens_select_operacional on public.viagens
  for select to authenticated
  using (public.eh_admin() or motorista_id = public.motorista_atual_id());
create policy viagens_admin_insert on public.viagens
  for insert to authenticated
  with check (public.eh_admin());
create policy viagens_admin_update on public.viagens
  for update to authenticated
  using (public.eh_admin())
  with check (public.eh_admin());

-- ABASTECIMENTOS
create policy abastecimentos_select_operacional on public.abastecimentos
  for select to authenticated
  using (public.eh_admin() or motorista_id = public.motorista_atual_id());
create policy abastecimentos_admin_insert on public.abastecimentos
  for insert to authenticated
  with check (public.eh_admin());
create policy abastecimentos_update_admin on public.abastecimentos
  for update to authenticated
  using (public.eh_admin())
  with check (public.eh_admin());

-- DESPESAS
create policy despesas_select_operacional on public.despesas_viagem
  for select to authenticated
  using (public.eh_admin() or motorista_id = public.motorista_atual_id());
create policy despesas_admin_insert on public.despesas_viagem
  for insert to authenticated
  with check (public.eh_admin());
create policy despesas_update_admin on public.despesas_viagem
  for update to authenticated
  using (public.eh_admin())
  with check (public.eh_admin());

-- MANUTENÇÕES
create policy manutencoes_select_admin_mecanico on public.manutencoes
  for select to authenticated
  using (public.eh_admin() or public.eh_mecanico());
create policy manutencoes_insert_admin_mecanico on public.manutencoes
  for insert to authenticated
  with check (public.eh_admin() or public.eh_mecanico());
create policy manutencoes_update_admin_mecanico on public.manutencoes
  for update to authenticated
  using (public.eh_admin() or public.eh_mecanico())
  with check (public.eh_admin() or public.eh_mecanico());

create policy manutencao_mecanicos_select_admin_mecanico on public.manutencao_mecanicos
  for select to authenticated
  using (public.eh_admin() or public.eh_mecanico());
create policy manutencao_mecanicos_insert_admin_mecanico on public.manutencao_mecanicos
  for insert to authenticated
  with check (public.eh_admin() or public.eh_mecanico());
create policy manutencao_mecanicos_update_admin_mecanico on public.manutencao_mecanicos
  for update to authenticated
  using (public.eh_admin() or public.eh_mecanico())
  with check (public.eh_admin() or public.eh_mecanico());

create policy manutencao_servicos_select_admin_mecanico on public.manutencao_servicos
  for select to authenticated
  using (public.eh_admin() or public.eh_mecanico());
create policy manutencao_servicos_insert_admin_mecanico on public.manutencao_servicos
  for insert to authenticated
  with check (public.eh_admin() or public.eh_mecanico());
create policy manutencao_servicos_update_admin_mecanico on public.manutencao_servicos
  for update to authenticated
  using (public.eh_admin() or public.eh_mecanico())
  with check (public.eh_admin() or public.eh_mecanico());

create policy pecas_select_admin_mecanico on public.pecas
  for select to authenticated
  using (public.eh_admin() or public.eh_mecanico());
create policy pecas_admin_write on public.pecas
  for all to authenticated
  using (public.eh_admin())
  with check (public.eh_admin());

create policy manutencao_pecas_select_admin_mecanico on public.manutencao_pecas
  for select to authenticated
  using (public.eh_admin() or public.eh_mecanico());

create policy despesa_pecas_select_admin_mecanico on public.despesa_pecas
  for select to authenticated
  using (public.eh_admin() or public.eh_mecanico());

create policy estoque_movimentacoes_select_admin_mecanico on public.estoque_movimentacoes
  for select to authenticated
  using (public.eh_admin() or public.eh_mecanico());

-- PENDÊNCIAS E AUDITORIA
create policy pendencias_manuais_select_operacional on public.pendencias_manuais
  for select to authenticated
  using (
    public.eh_admin() or public.eh_mecanico() or motorista_id = public.motorista_atual_id() or exists (
      select 1 from public.veiculo_motoristas vm
      where vm.veiculo_id = pendencias_manuais.veiculo_id and vm.motorista_id = public.motorista_atual_id() and vm.ativo = true and vm.fim_em is null
    )
  );
create policy pendencias_manuais_insert_admin_mecanico on public.pendencias_manuais
  for insert to authenticated
  with check (public.eh_admin() or public.eh_mecanico());
create policy pendencias_manuais_update_admin_mecanico on public.pendencias_manuais
  for update to authenticated
  using (public.eh_admin() or public.eh_mecanico())
  with check (public.eh_admin() or public.eh_mecanico());

create policy pendencia_interacoes_select_relacionadas on public.pendencia_interacoes
  for select to authenticated
  using (public.eh_admin() or public.eh_mecanico() or criado_por = auth.uid());
create policy pendencia_interacoes_insert_autenticado_ativo on public.pendencia_interacoes
  for insert to authenticated
  with check (public.perfil_ativo() and criado_por = auth.uid());
create policy pendencia_interacoes_admin_update on public.pendencia_interacoes
  for update to authenticated
  using (public.eh_admin())
  with check (public.eh_admin());

create policy auditoria_select_admin on public.auditoria_eventos
  for select to authenticated
  using (public.eh_admin());
create policy auditoria_insert_admin on public.auditoria_eventos
  for insert to authenticated
  with check (public.eh_admin());

-- =========================================================
-- 16. GRANTS
-- =========================================================
grant usage on schema public to authenticated;
grant select, insert, update on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

revoke execute on function public.fn_iniciar_viagem(uuid, uuid, uuid, text, text, timestamptz, numeric, text, boolean) from public, anon;
revoke execute on function public.fn_concluir_viagem(uuid, numeric, timestamptz, text) from public, anon;
revoke execute on function public.fn_registrar_abastecimento(uuid, numeric, text, numeric, text) from public, anon;
revoke execute on function public.fn_registrar_despesa_viagem(uuid, text, numeric, text, text) from public, anon;
revoke execute on function public.fn_concluir_manutencao(uuid) from public, anon;
revoke execute on function public.fn_salvar_peca(uuid,text,text,text,text,numeric,numeric,numeric,text,boolean) from public, anon;
revoke execute on function public.fn_salvar_despesa(uuid,uuid,uuid,uuid,text,numeric,timestamptz,text,text,jsonb) from public, anon;
revoke execute on function public.fn_salvar_manutencao(uuid,uuid,text,text,timestamptz,numeric,uuid,text,text,uuid[],jsonb) from public, anon;
revoke execute on function public.fn_editar_manutencao_concluida(uuid,uuid,text,text,timestamptz,numeric,uuid,text,text,uuid[],jsonb) from public, anon;
revoke execute on function public.fn_cancelar_manutencao(uuid,text) from public, anon;
revoke execute on function public.fn_renovar_documento_veiculo(uuid, text, date, date, text, text) from public, anon;
revoke execute on function public.fn_dashboard_admin(date, date, uuid, uuid) from public, anon;

grant execute on function public.fn_iniciar_viagem(uuid, uuid, uuid, text, text, timestamptz, numeric, text, boolean) to authenticated;
grant execute on function public.fn_concluir_viagem(uuid, numeric, timestamptz, text) to authenticated;
grant execute on function public.fn_registrar_abastecimento(uuid, numeric, text, numeric, text) to authenticated;
grant execute on function public.fn_registrar_despesa_viagem(uuid, text, numeric, text, text) to authenticated;
grant execute on function public.fn_concluir_manutencao(uuid) to authenticated;
grant execute on function public.fn_salvar_peca(uuid,text,text,text,text,numeric,numeric,numeric,text,boolean) to authenticated;
grant execute on function public.fn_salvar_despesa(uuid,uuid,uuid,uuid,text,numeric,timestamptz,text,text,jsonb) to authenticated;
grant execute on function public.fn_salvar_manutencao(uuid,uuid,text,text,timestamptz,numeric,uuid,text,text,uuid[],jsonb) to authenticated;
grant execute on function public.fn_editar_manutencao_concluida(uuid,uuid,text,text,timestamptz,numeric,uuid,text,text,uuid[],jsonb) to authenticated;
grant execute on function public.fn_cancelar_manutencao(uuid,text) to authenticated;
grant execute on function public.fn_renovar_documento_veiculo(uuid, text, date, date, text, text) to authenticated;
grant execute on function public.fn_dashboard_admin(date, date, uuid, uuid) to authenticated;

-- =========================================================
-- 17. DADOS BASE
-- =========================================================
insert into public.tipos_documento_veiculo (codigo, nome, dias_alerta)
values
  ('documentacao', 'Documentação/CRLV', 30),
  ('tacografo', 'Tacógrafo', 30),
  ('ceturb', 'CETURB', 45)
on conflict (codigo) do update set
  nome = excluded.nome,
  dias_alerta = excluded.dias_alerta,
  atualizado_em = now();

-- Serviços base. Óleo e pneus são categorias de serviço, não módulos isolados.
with servicos_base (
  nome, categoria, tipo_manutencao_sugerido, tipo_periodicidade,
  periodicidade_km, periodicidade_dias, descricao, ativo
) as (
  values
    ('Troca de óleo do motor', 'Óleo', 'preventiva', 'km', 10000::numeric, null::integer, 'Troca periódica de óleo do motor.', true),
    ('Troca de filtro de óleo', 'Óleo', 'preventiva', 'km', 10000::numeric, null::integer, 'Troca do filtro junto à troca de óleo.', true),
    ('Troca de filtro de ar', 'Motor', 'preventiva', 'km', 15000::numeric, null::integer, 'Filtro de ar do motor.', true),
    ('Revisão de freios', 'Freios', 'preventiva', 'km', 15000::numeric, null::integer, 'Inspeção e ajuste do sistema de freios.', true),
    ('Alinhamento', 'Pneus', 'preventiva', 'km', 10000::numeric, null::integer, 'Alinhamento preventivo.', true),
    ('Balanceamento', 'Pneus', 'preventiva', 'km', 10000::numeric, null::integer, 'Balanceamento preventivo.', true),
    ('Rodízio de pneus', 'Pneus', 'preventiva', 'km', 20000::numeric, null::integer, 'Rodízio preventivo de pneus.', true),
    ('Troca de pneus', 'Pneus', 'preventiva', 'km', 80000::numeric, null::integer, 'Controle de troca de pneus por quilometragem.', true),
    ('Revisão geral', 'Revisão geral', 'preventiva', 'km', 30000::numeric, null::integer, 'Revisão geral periódica.', true),
    ('Inspeção CETURB', 'Documentação', 'preventiva', 'tempo', null::numeric, 365, 'Inspeção/documento CETURB anual.', true),
    ('Reparo elétrico', 'Elétrica', 'corretiva', 'nenhuma', null::numeric, null::integer, 'Correções elétricas sob demanda.', true),
    ('Reparo de motor', 'Motor', 'corretiva', 'nenhuma', null::numeric, null::integer, 'Correções de motor sob demanda.', true)
)
insert into public.servicos (
  nome, categoria, tipo_manutencao_sugerido, tipo_periodicidade,
  periodicidade_km, periodicidade_dias, descricao, ativo
)
select
  sb.nome, sb.categoria, sb.tipo_manutencao_sugerido, sb.tipo_periodicidade,
  sb.periodicidade_km, sb.periodicidade_dias, sb.descricao, sb.ativo
from servicos_base sb
where not exists (
  select 1
  from public.servicos s
  where public.normalizar_texto(s.nome) = public.normalizar_texto(sb.nome)
    and s.categoria = sb.categoria
    and s.excluido_em is null
);
