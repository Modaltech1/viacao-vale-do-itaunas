-- Atribui as peças já cadastradas ao admin restrito responsável pela manutenção.
-- Admin: Sânela Zimmer <manutencao@viacaovaledoitaunas.com.br>

do $$
declare
  v_admin_id uuid := '83d784d1-9cb7-4653-bbfb-8ab6bbc681b2'::uuid;
begin
  if not exists (
    select 1
    from public.perfis p
    where p.id = v_admin_id
      and p.papel = 'admin'
      and p.ativo = true
  ) then
    raise exception 'Admin responsável pelas peças não encontrado ou inativo: %', v_admin_id;
  end if;

  update public.pecas
  set
    admin_responsavel_id = v_admin_id,
    atualizado_por = v_admin_id
  where excluido_em is null;
end;
$$;
