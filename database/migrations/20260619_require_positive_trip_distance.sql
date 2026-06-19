-- Viagens concluidas devem representar deslocamento real.
-- A constraint fica NOT VALID para preservar o historico ja existente,
-- mas passa a proteger imediatamente toda nova inclusao ou alteracao.

alter table public.viagens
  drop constraint if exists viagens_km_final_check;

alter table public.viagens
  add constraint viagens_km_final_check
  check (km_final is null or km_final > km_inicial)
  not valid;

create or replace function public.validar_distancia_positiva_viagem()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.km_final is not null and new.km_final <= new.km_inicial then
    raise exception 'KM final deve ser maior que o KM inicial da viagem';
  end if;

  return new;
end;
$$;

drop trigger if exists validar_distancia_positiva_viagem_trg on public.viagens;
create trigger validar_distancia_positiva_viagem_trg
  before insert or update of status, km_inicial, km_final on public.viagens
  for each row execute function public.validar_distancia_positiva_viagem();
