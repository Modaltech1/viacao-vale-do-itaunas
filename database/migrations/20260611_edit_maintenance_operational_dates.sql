begin;

create or replace function public.fn_editar_manutencao_concluida(
  p_manutencao_id uuid,
  p_veiculo_id uuid,
  p_tipo_manutencao text,
  p_causa text,
  p_aberto_em timestamptz,
  p_concluido_em timestamptz,
  p_km_veiculo numeric,
  p_mecanico_responsavel_id uuid,
  p_status text,
  p_observacoes text,
  p_servicos jsonb,
  p_pecas jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_manutencao public.manutencoes%rowtype;
  v_id uuid;
begin
  if not public.eh_admin() then
    raise exception 'Somente administradores podem editar uma manutenção concluída';
  end if;
  if p_aberto_em is null then
    raise exception 'Informe a data de abertura';
  end if;
  if p_concluido_em is null then
    raise exception 'Informe a data de conclusão';
  end if;

  select *
  into v_manutencao
  from public.manutencoes
  where id = p_manutencao_id
  for update;

  if not found then
    raise exception 'Manutenção não encontrada';
  end if;
  if v_manutencao.status <> 'concluida' then
    raise exception 'Esta rotina edita somente manutenções concluídas';
  end if;
  if v_manutencao.veiculo_id <> p_veiculo_id then
    raise exception 'O veículo de uma manutenção concluída não pode ser alterado';
  end if;
  if v_manutencao.iniciado_em is not null
    and p_aberto_em > v_manutencao.iniciado_em then
    raise exception 'A abertura não pode ser posterior ao início da manutenção';
  end if;
  if p_concluido_em < coalesce(v_manutencao.iniciado_em, p_aberto_em) then
    raise exception 'A conclusão não pode ser anterior ao início ou à abertura da manutenção';
  end if;

  update public.manutencoes
  set aberto_em = p_aberto_em,
      concluido_em = p_concluido_em,
      atualizado_por = auth.uid()
  where id = p_manutencao_id;

  v_id := public.fn_editar_manutencao_concluida(
    p_manutencao_id,
    p_veiculo_id,
    p_tipo_manutencao,
    p_causa,
    p_aberto_em,
    p_km_veiculo,
    p_mecanico_responsavel_id,
    p_status,
    p_observacoes,
    p_servicos,
    p_pecas
  );

  return v_id;
end;
$$;

revoke execute on function public.fn_editar_manutencao_concluida(
  uuid, uuid, text, text, timestamptz, numeric, uuid, text, text, jsonb, jsonb
) from public, anon, authenticated;

revoke execute on function public.fn_editar_manutencao_concluida(
  uuid, uuid, text, text, timestamptz, numeric, uuid, text, text, uuid[], jsonb
) from public, anon, authenticated;

revoke execute on function public.fn_editar_manutencao_concluida(
  uuid, uuid, text, text, timestamptz, timestamptz, numeric, uuid, text, text, jsonb, jsonb
) from public, anon;

grant execute on function public.fn_editar_manutencao_concluida(
  uuid, uuid, text, text, timestamptz, timestamptz, numeric, uuid, text, text, jsonb, jsonb
) to authenticated;

commit;
