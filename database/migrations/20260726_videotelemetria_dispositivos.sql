-- Dispositivos de videotelemetria vinculados aos veículos.

create table if not exists public.dispositivos_videotelemetria (
  id uuid primary key default gen_random_uuid(),

  veiculo_id uuid not null
    references public.veiculos(id)
    on delete restrict,

  terminal_id text not null,
  imei text,
  modelo text not null,

  canais jsonb not null default '[]'::jsonb,

  ativo boolean not null default true,
  excluido_em timestamptz,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  criado_por uuid
    references public.perfis(id)
    on delete set null,

  atualizado_por uuid
    references public.perfis(id)
    on delete set null,

  constraint dispositivos_videotelemetria_terminal_id_check
    check (
      terminal_id = btrim(terminal_id)
      and length(terminal_id) between 6 and 30
    ),

  constraint dispositivos_videotelemetria_modelo_check
    check (length(btrim(modelo)) > 0),

  constraint dispositivos_videotelemetria_canais_check
    check (jsonb_typeof(canais) = 'array')
);

-- Um veículo só pode possuir um dispositivo ativo.
create unique index if not exists
  dispositivos_videotelemetria_veiculo_ativo_uniq
on public.dispositivos_videotelemetria(veiculo_id)
where excluido_em is null;

-- Um terminal não pode estar vinculado a dois veículos ao mesmo tempo.
create unique index if not exists
  dispositivos_videotelemetria_terminal_ativo_uniq
on public.dispositivos_videotelemetria(terminal_id)
where excluido_em is null;

-- Evita duplicidade de IMEI, quando ele estiver informado.
create unique index if not exists
  dispositivos_videotelemetria_imei_ativo_uniq
on public.dispositivos_videotelemetria(imei)
where imei is not null
  and excluido_em is null;

create index if not exists
  dispositivos_videotelemetria_veiculo_idx
on public.dispositivos_videotelemetria(veiculo_id);

-- Atualiza atualizado_em automaticamente.
drop trigger if exists
  dispositivos_videotelemetria_set_atualizado_em
on public.dispositivos_videotelemetria;

create trigger
  dispositivos_videotelemetria_set_atualizado_em
before update on public.dispositivos_videotelemetria
for each row
execute function public.set_atualizado_em();

-- Segurança por usuário autenticado.
alter table public.dispositivos_videotelemetria
  enable row level security;

drop policy if exists
  dispositivos_videotelemetria_admin_select
on public.dispositivos_videotelemetria;

create policy
  dispositivos_videotelemetria_admin_select
on public.dispositivos_videotelemetria
for select
to authenticated
using (
  public.admin_pode_acessar_veiculo(veiculo_id)
);

drop policy if exists
  dispositivos_videotelemetria_admin_insert
on public.dispositivos_videotelemetria;

create policy
  dispositivos_videotelemetria_admin_insert
on public.dispositivos_videotelemetria
for insert
to authenticated
with check (
  public.admin_pode_acessar_veiculo(veiculo_id)
);

drop policy if exists
  dispositivos_videotelemetria_admin_update
on public.dispositivos_videotelemetria;

create policy
  dispositivos_videotelemetria_admin_update
on public.dispositivos_videotelemetria
for update
to authenticated
using (
  public.admin_pode_acessar_veiculo(veiculo_id)
)
with check (
  public.admin_pode_acessar_veiculo(veiculo_id)
);

revoke all
on public.dispositivos_videotelemetria
from anon;

grant select, insert, update
on public.dispositivos_videotelemetria
to authenticated;