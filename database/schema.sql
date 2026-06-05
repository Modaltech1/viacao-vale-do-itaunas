-- Frota ERP — Schema planejado Supabase/PostgreSQL
-- Projeto inicial mockado, mas modelagem pensada para evolução real.
-- Convenção: campos de status são text para manter flexibilidade e evitar ENUM/CHECK no início.

create extension if not exists pgcrypto;

create table if not exists public.perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text,
  papel text not null default 'motorista', -- admin | motorista | mecanico
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.rotas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  origem text not null,
  destino text not null,
  km_estimado numeric(12,2) not null default 0,
  observacoes text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.motoristas (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid references public.perfis(id) on delete set null,
  nome text not null,
  endereco text,
  telefone text,
  cpf text,
  numero_habilitacao text,
  validade_habilitacao date,
  status_habilitacao text not null default 'em_dia', -- em_dia | proximo | vencido
  status text not null default 'ativo', -- ativo | inativo | afastado
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.mecanicos (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid references public.perfis(id) on delete set null,
  nome text not null,
  telefone text,
  especialidade text,
  status text not null default 'ativo',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.veiculos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  marca text not null,
  modelo text not null,
  placa text not null unique,
  ano integer,
  status text not null default 'ativo', -- ativo | em_manutencao | inativo | reservado | indisponivel
  km_atual numeric(14,2) not null default 0,
  capacidade text,
  motorista_principal_id uuid references public.motoristas(id) on delete set null,
  rota_id uuid references public.rotas(id) on delete set null,
  vencimento_documentacao date,
  vencimento_tacografo date,
  vencimento_ceturb date,
  status_documentacao text not null default 'em_dia',
  status_tacografo text not null default 'em_dia',
  status_ceturb text not null default 'em_dia',
  consumo_medio numeric(12,2) not null default 0,
  observacoes text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.servicos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  categoria text not null, -- Óleo | Pneus | Freios | Motor | Câmbio | Elétrica | Suspensão | Documentação | Revisão geral | Outros
  tipo_manutencao_sugerido text not null default 'preventiva', -- preventiva | corretiva
  tipo_periodicidade text not null default 'none', -- km | time | none
  periodicidade_km numeric(14,2),
  periodicidade_dias integer,
  descricao text,
  status text not null default 'ativo',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Tabela que materializa a agenda/controle de serviços por veículo.
-- Óleo e pneus entram aqui como serviços de categoria Óleo/Pneus.
create table if not exists public.veiculo_servico_programacoes (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid not null references public.veiculos(id) on delete cascade,
  servico_id uuid not null references public.servicos(id) on delete cascade,
  ultimo_realizado_em date,
  ultimo_realizado_km numeric(14,2),
  proximo_vencimento_em date,
  proximo_vencimento_km numeric(14,2),
  status text not null default 'em_dia', -- em_dia | proximo | vencido
  observacoes text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (veiculo_id, servico_id)
);

create table if not exists public.viagens (
  id uuid primary key default gen_random_uuid(),
  motorista_id uuid not null references public.motoristas(id) on delete restrict,
  veiculo_id uuid not null references public.veiculos(id) on delete restrict,
  rota_id uuid references public.rotas(id) on delete set null,
  origem text not null,
  destino text not null,
  saiu_em timestamptz not null,
  chegou_em timestamptz,
  status text not null default 'em_andamento', -- em_andamento | concluida | cancelada
  km_inicial numeric(14,2) not null default 0,
  km_final numeric(14,2),
  observacoes text,
  veiculo_temporario boolean not null default false,
  criado_por uuid references public.perfis(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.abastecimentos (
  id uuid primary key default gen_random_uuid(),
  viagem_id uuid references public.viagens(id) on delete set null,
  motorista_id uuid references public.motoristas(id) on delete set null,
  veiculo_id uuid not null references public.veiculos(id) on delete restrict,
  registrado_em timestamptz not null default now(),
  km_atual numeric(14,2) not null default 0,
  tipo_combustivel text not null,
  litros numeric(12,3) not null default 0,
  valor_unitario numeric(12,2),
  valor_total numeric(12,2),
  observacoes text,
  criado_por uuid references public.perfis(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.despesas_viagem (
  id uuid primary key default gen_random_uuid(),
  viagem_id uuid references public.viagens(id) on delete cascade,
  motorista_id uuid references public.motoristas(id) on delete set null,
  veiculo_id uuid references public.veiculos(id) on delete set null,
  tipo text not null, -- Pedágio | Alimentação | Hospedagem | Descarga | Outros
  valor numeric(12,2) not null default 0,
  registrado_em timestamptz not null default now(),
  observacoes text,
  criado_por uuid references public.perfis(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.manutencoes (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid not null references public.veiculos(id) on delete restrict,
  tipo_manutencao text not null default 'preventiva', -- preventiva | corretiva
  causa text,
  realizado_em date not null default current_date,
  km_atual numeric(14,2),
  valor numeric(12,2) not null default 0,
  mecanico_id uuid references public.mecanicos(id) on delete set null,
  status text not null default 'aberta', -- aberta | em_andamento | concluida | cancelada
  observacoes text,
  criado_por uuid references public.perfis(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.manutencao_servicos (
  id uuid primary key default gen_random_uuid(),
  manutencao_id uuid not null references public.manutencoes(id) on delete cascade,
  servico_id uuid not null references public.servicos(id) on delete restrict,
  valor numeric(12,2),
  observacoes text,
  criado_em timestamptz not null default now(),
  unique (manutencao_id, servico_id)
);

create table if not exists public.pendencias (
  id uuid primary key default gen_random_uuid(),
  tipo text not null, -- servico_km | servico_tempo | manutencao_aberta | veiculo_status | cnh | documentacao | tacografo | ceturb
  severidade text not null default 'atencao', -- baixa | atencao | critica
  veiculo_id uuid references public.veiculos(id) on delete cascade,
  motorista_id uuid references public.motoristas(id) on delete cascade,
  servico_id uuid references public.servicos(id) on delete set null,
  manutencao_id uuid references public.manutencoes(id) on delete set null,
  titulo text not null,
  descricao text,
  vencimento_km numeric(14,2),
  vencimento_em date,
  km_atual numeric(14,2),
  status text not null default 'aberta', -- aberta | resolvida
  acao_label text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_veiculos_motorista on public.veiculos(motorista_principal_id);
create index if not exists idx_veiculos_rota on public.veiculos(rota_id);
create index if not exists idx_viagens_motorista on public.viagens(motorista_id);
create index if not exists idx_viagens_veiculo on public.viagens(veiculo_id);
create index if not exists idx_viagens_status on public.viagens(status);
create index if not exists idx_abastecimentos_veiculo on public.abastecimentos(veiculo_id);
create index if not exists idx_abastecimentos_viagem on public.abastecimentos(viagem_id);
create index if not exists idx_despesas_viagem on public.despesas_viagem(viagem_id);
create index if not exists idx_manutencoes_veiculo on public.manutencoes(veiculo_id);
create index if not exists idx_manutencoes_status on public.manutencoes(status);
create index if not exists idx_pendencias_status on public.pendencias(status);
create index if not exists idx_pendencias_veiculo on public.pendencias(veiculo_id);

create or replace function public.set_atualizado_em()
returns trigger as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$ language plpgsql;

do $$
declare
  t text;
begin
  foreach t in array array[
    'perfis','rotas','motoristas','mecanicos','veiculos','servicos','veiculo_servico_programacoes',
    'viagens','abastecimentos','despesas_viagem','manutencoes','pendencias'
  ]
  loop
    execute format('drop trigger if exists set_%s_atualizado_em on public.%I', t, t);
    execute format('create trigger set_%s_atualizado_em before update on public.%I for each row execute function public.set_atualizado_em()', t, t);
  end loop;
end $$;

-- RLS inicial sugerida. Ajustar antes de produção real.
alter table public.perfis enable row level security;
alter table public.rotas enable row level security;
alter table public.motoristas enable row level security;
alter table public.mecanicos enable row level security;
alter table public.veiculos enable row level security;
alter table public.servicos enable row level security;
alter table public.veiculo_servico_programacoes enable row level security;
alter table public.viagens enable row level security;
alter table public.abastecimentos enable row level security;
alter table public.despesas_viagem enable row level security;
alter table public.manutencoes enable row level security;
alter table public.manutencao_servicos enable row level security;
alter table public.pendencias enable row level security;

-- Policies serão refinadas no projeto real conforme auth, sublogins e papéis.
-- Regra prevista:
-- admin: acesso total;
-- motorista: lê próprio perfil/motorista, próprio veículo, próprias viagens, registra abastecimento/despesa da viagem em andamento;
-- mecanico: lê veículos/serviços/pendências/manutenções, cria/atualiza manutenções.
