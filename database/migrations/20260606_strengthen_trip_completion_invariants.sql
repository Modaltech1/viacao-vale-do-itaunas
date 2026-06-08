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

revoke execute on function public.fn_concluir_viagem(uuid, numeric, timestamptz, text) from public, anon;
grant execute on function public.fn_concluir_viagem(uuid, numeric, timestamptz, text) to authenticated;
