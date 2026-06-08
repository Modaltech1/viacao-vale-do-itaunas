-- Quantidades de itens discretos devem ser inteiras.
-- Litro e metro continuam aceitando ate tres casas decimais.

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
      raise exception 'Estoque de unidade, kit e par deve ser informado em numeros inteiros';
    end if;
  else
    select unidade_medida into v_unidade
    from public.pecas
    where id = new.peca_id;

    if v_unidade not in ('litro', 'metro') and new.quantidade <> trunc(new.quantidade) then
      raise exception 'A quantidade de unidade, kit e par deve ser um numero inteiro';
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
