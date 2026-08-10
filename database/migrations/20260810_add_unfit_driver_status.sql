begin;

alter table public.motoristas
  drop constraint if exists motoristas_status_profissional_check;

alter table public.motoristas
  add constraint motoristas_status_profissional_check
  check (status_profissional in ('ativo', 'inativo', 'afastado', 'inapto'));

create or replace function public.proteger_status_inapto_motorista()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.status_profissional = 'inapto'
    and new.status_profissional is distinct from 'inapto'
  then
    raise exception 'Motoristas inaptos permanecem bloqueados para preservar o histórico da empresa';
  end if;

  return new;
end;
$$;

drop trigger if exists motoristas_proteger_status_inapto_trg on public.motoristas;
create trigger motoristas_proteger_status_inapto_trg
  before update of status_profissional on public.motoristas
  for each row execute function public.proteger_status_inapto_motorista();

create or replace function public.bloquear_operacao_motorista_inapto()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deve_bloquear boolean := false;
begin
  if new.status_profissional = 'inapto' then
    if tg_op = 'INSERT' then
      v_deve_bloquear := true;
    elsif old.status_profissional is distinct from 'inapto' then
      v_deve_bloquear := true;
    end if;
  end if;

  if v_deve_bloquear then
    update public.perfis
    set ativo = false,
        atualizado_em = now(),
        atualizado_por = coalesce(new.atualizado_por, new.criado_por)
    where id = new.perfil_id;

    update public.veiculo_motoristas
    set ativo = false,
        principal = false,
        fim_em = greatest(now(), inicio_em + interval '1 microsecond'),
        atualizado_por = coalesce(new.atualizado_por, new.criado_por)
    where motorista_id = new.id
      and ativo = true
      and fim_em is null;
  end if;

  return new;
end;
$$;

drop trigger if exists motoristas_bloquear_operacao_inapto_trg on public.motoristas;
create trigger motoristas_bloquear_operacao_inapto_trg
  after insert or update of status_profissional on public.motoristas
  for each row execute function public.bloquear_operacao_motorista_inapto();

create or replace function public.validar_motorista_apto_para_vinculo()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.ativo = true and new.fim_em is null and exists (
    select 1
    from public.motoristas m
    where m.id = new.motorista_id
      and (m.status_profissional = 'inapto' or m.excluido_em is not null)
  ) then
    raise exception 'Motoristas inaptos não podem receber vínculo operacional';
  end if;

  return new;
end;
$$;

drop trigger if exists veiculo_motoristas_validar_motorista_ativo_trg on public.veiculo_motoristas;
create trigger veiculo_motoristas_validar_motorista_ativo_trg
  before insert or update of motorista_id, ativo, fim_em on public.veiculo_motoristas
  for each row execute function public.validar_motorista_apto_para_vinculo();

commit;
