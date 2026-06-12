-- =========================================================
-- NIVEIS ADMINISTRATIVOS E RESPONSABILIDADE OPERACIONAL
-- =========================================================

alter table public.perfis
  add column if not exists nivel_admin text;

update public.perfis
set nivel_admin = 'global'
where papel = 'admin'
  and (
    nivel_admin is null
    or nivel_admin not in ('global', 'restrito')
  );

update public.perfis
set nivel_admin = null
where papel <> 'admin'
  and nivel_admin is not null;

alter table public.perfis
  drop constraint if exists perfis_nivel_admin_check;

alter table public.perfis
  add constraint perfis_nivel_admin_check check (
    (papel = 'admin' and nivel_admin in ('global', 'restrito'))
    or (papel <> 'admin' and nivel_admin is null)
  );

alter table public.veiculos
  add column if not exists admin_responsavel_id uuid references public.perfis(id) on delete set null;

alter table public.motoristas
  add column if not exists admin_responsavel_id uuid references public.perfis(id) on delete set null;

alter table public.pendencias_manuais
  add column if not exists admin_responsavel_id uuid references public.perfis(id) on delete set null;

create index if not exists veiculos_admin_responsavel_idx
  on public.veiculos(admin_responsavel_id)
  where excluido_em is null;

create index if not exists motoristas_admin_responsavel_idx
  on public.motoristas(admin_responsavel_id)
  where excluido_em is null;

create index if not exists pendencias_admin_responsavel_idx
  on public.pendencias_manuais(admin_responsavel_id)
  where status = 'aberta';

comment on column public.perfis.nivel_admin is
  'Nivel do administrador: global enxerga toda a companhia; restrito enxerga somente dados sob sua responsabilidade.';
comment on column public.veiculos.admin_responsavel_id is
  'Administrador atualmente responsavel pelo veiculo. Independente de criado_por, que preserva auditoria.';
comment on column public.motoristas.admin_responsavel_id is
  'Administrador atualmente responsavel pelo motorista. Independente de criado_por, que preserva auditoria.';

create or replace function public.handle_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_papel text;
  v_nivel_admin text;
begin
  v_papel := case
    when new.raw_app_meta_data ->> 'papel' in ('admin', 'motorista', 'mecanico')
      then new.raw_app_meta_data ->> 'papel'
    else 'motorista'
  end;

  v_nivel_admin := case
    when v_papel = 'admin'
      then case
        when new.raw_app_meta_data ->> 'nivel_admin' in ('global', 'restrito')
          then new.raw_app_meta_data ->> 'nivel_admin'
        else 'restrito'
      end
    else null
  end;

  insert into public.perfis (id, nome, email, papel, nivel_admin, ativo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1), 'Usuario'),
    new.email,
    v_papel,
    v_nivel_admin,
    true
  )
  on conflict (id) do update set
    email = excluded.email,
    nome = coalesce(public.perfis.nome, excluded.nome),
    atualizado_em = now();

  return new;
end;
$$;

create or replace function public.eh_admin_global()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.perfis p
    where p.id = auth.uid()
      and p.ativo = true
      and p.papel = 'admin'
      and p.nivel_admin = 'global'
  )
$$;

create or replace function public.admin_pode_acessar_responsavel(p_admin_responsavel_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.eh_admin()
    and (
      public.eh_admin_global()
      or p_admin_responsavel_id = auth.uid()
    )
$$;

create or replace function public.admin_pode_acessar_veiculo(p_veiculo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.eh_admin()
    and (
      public.eh_admin_global()
      or exists (
        select 1
        from public.veiculos v
        where v.id = p_veiculo_id
          and v.excluido_em is null
          and v.admin_responsavel_id = auth.uid()
      )
    )
$$;

create or replace function public.admin_pode_acessar_motorista(p_motorista_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.eh_admin()
    and (
      public.eh_admin_global()
      or exists (
        select 1
        from public.motoristas m
        where m.id = p_motorista_id
          and m.excluido_em is null
          and m.admin_responsavel_id = auth.uid()
      )
    )
$$;

create or replace function public.perfil_visivel_para_usuario(p_perfil_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    p_perfil_id = auth.uid()
    or public.eh_admin_global()
    or public.eh_mecanico()
    or (
      public.eh_admin()
      and (
        exists (
          select 1
          from public.motoristas m
          where m.perfil_id = p_perfil_id
            and m.excluido_em is null
            and m.admin_responsavel_id = auth.uid()
        )
        or exists (
          select 1
          from public.mecanicos mec
          where mec.perfil_id = p_perfil_id
            and mec.excluido_em is null
        )
      )
    )
$$;

create or replace function public.preparar_admin_responsavel()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin public.perfis%rowtype;
begin
  if public.eh_admin() and not public.eh_admin_global() then
    new.admin_responsavel_id := auth.uid();
  end if;

  if new.admin_responsavel_id is not null then
    select * into v_admin
    from public.perfis
    where id = new.admin_responsavel_id
      and papel = 'admin'
      and ativo = true;

    if not found then
      raise exception 'Administrador responsavel invalido ou inativo';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists veiculos_preparar_admin_responsavel_trg on public.veiculos;
create trigger veiculos_preparar_admin_responsavel_trg
  before insert or update of admin_responsavel_id on public.veiculos
  for each row execute function public.preparar_admin_responsavel();

drop trigger if exists motoristas_preparar_admin_responsavel_trg on public.motoristas;
create trigger motoristas_preparar_admin_responsavel_trg
  before insert or update of admin_responsavel_id on public.motoristas
  for each row execute function public.preparar_admin_responsavel();

drop trigger if exists pendencias_preparar_admin_responsavel_trg on public.pendencias_manuais;
create trigger pendencias_preparar_admin_responsavel_trg
  before insert or update of admin_responsavel_id on public.pendencias_manuais
  for each row execute function public.preparar_admin_responsavel();

create or replace function public.validar_escopo_vinculo_motorista()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_veiculo uuid;
  v_admin_motorista uuid;
begin
  select admin_responsavel_id into v_admin_veiculo
  from public.veiculos
  where id = new.veiculo_id;

  select admin_responsavel_id into v_admin_motorista
  from public.motoristas
  where id = new.motorista_id;

  if v_admin_veiculo is not null
    and v_admin_motorista is not null
    and v_admin_veiculo <> v_admin_motorista
  then
    raise exception 'Motorista e veiculo pertencem a administradores diferentes';
  end if;

  if public.eh_admin() and not public.eh_admin_global() then
    if v_admin_veiculo <> auth.uid() or v_admin_motorista <> auth.uid() then
      raise exception 'Vinculo fora da responsabilidade do administrador';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists veiculo_motoristas_validar_escopo_trg on public.veiculo_motoristas;
create trigger veiculo_motoristas_validar_escopo_trg
  before insert or update of veiculo_id, motorista_id on public.veiculo_motoristas
  for each row execute function public.validar_escopo_vinculo_motorista();

create or replace function public.validar_escopo_operacao_veiculo()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_motorista_id uuid;
begin
  if public.eh_admin()
    and not public.admin_pode_acessar_veiculo(new.veiculo_id)
  then
    raise exception 'Operacao fora da responsabilidade do administrador';
  end if;

  v_motorista_id := nullif(to_jsonb(new) ->> 'motorista_id', '')::uuid;
  if public.eh_admin()
    and v_motorista_id is not null
    and not public.admin_pode_acessar_motorista(v_motorista_id)
  then
    raise exception 'Motorista fora da responsabilidade do administrador';
  end if;

  return new;
end;
$$;

drop trigger if exists viagens_validar_escopo_trg on public.viagens;
create trigger viagens_validar_escopo_trg
  before insert or update of veiculo_id on public.viagens
  for each row execute function public.validar_escopo_operacao_veiculo();

drop trigger if exists abastecimentos_validar_escopo_trg on public.abastecimentos;
create trigger abastecimentos_validar_escopo_trg
  before insert or update of veiculo_id on public.abastecimentos
  for each row execute function public.validar_escopo_operacao_veiculo();

drop trigger if exists despesas_validar_escopo_trg on public.despesas_viagem;
create trigger despesas_validar_escopo_trg
  before insert or update of veiculo_id on public.despesas_viagem
  for each row execute function public.validar_escopo_operacao_veiculo();

drop trigger if exists manutencoes_validar_escopo_trg on public.manutencoes;
create trigger manutencoes_validar_escopo_trg
  before insert or update of veiculo_id on public.manutencoes
  for each row execute function public.validar_escopo_operacao_veiculo();

alter view public.vw_veiculos_resumo set (security_invoker = true);
alter view public.vw_viagens_detalhadas set (security_invoker = true);
alter view public.vw_manutencoes_detalhadas set (security_invoker = true);
alter view public.vw_servicos_programados_status set (security_invoker = true);
alter view public.vw_documentos_veiculo_status set (security_invoker = true);
alter view public.vw_pendencias_calculadas set (security_invoker = true);
alter view public.vw_pendencias_operacionais set (security_invoker = true);

-- =========================================================
-- RLS COM ESCOPO ADMINISTRATIVO
-- =========================================================

drop policy if exists perfis_select_por_contexto on public.perfis;
drop policy if exists motoristas_select_por_contexto on public.motoristas;
drop policy if exists motoristas_admin_insert_escopo on public.motoristas;
drop policy if exists motoristas_admin_update_escopo on public.motoristas;
drop policy if exists veiculos_select_por_contexto on public.veiculos;
drop policy if exists veiculos_admin_insert_escopo on public.veiculos;
drop policy if exists veiculos_admin_update_escopo on public.veiculos;
drop policy if exists veiculo_motoristas_select_por_contexto on public.veiculo_motoristas;
drop policy if exists veiculo_motoristas_admin_insert_escopo on public.veiculo_motoristas;
drop policy if exists veiculo_motoristas_admin_update_escopo on public.veiculo_motoristas;
drop policy if exists veiculo_documentos_select_contexto on public.veiculo_documentos;
drop policy if exists veiculo_documentos_admin_insert_escopo on public.veiculo_documentos;
drop policy if exists veiculo_documentos_admin_update_escopo on public.veiculo_documentos;
drop policy if exists programacoes_select_contexto on public.veiculo_servico_programacoes;
drop policy if exists programacoes_insert_contexto on public.veiculo_servico_programacoes;
drop policy if exists programacoes_update_contexto on public.veiculo_servico_programacoes;
drop policy if exists viagens_select_contexto on public.viagens;
drop policy if exists viagens_admin_insert_escopo on public.viagens;
drop policy if exists viagens_admin_update_escopo on public.viagens;
drop policy if exists abastecimentos_select_contexto on public.abastecimentos;
drop policy if exists abastecimentos_admin_insert_escopo on public.abastecimentos;
drop policy if exists abastecimentos_admin_update_escopo on public.abastecimentos;
drop policy if exists despesas_select_contexto on public.despesas_viagem;
drop policy if exists despesas_admin_insert_escopo on public.despesas_viagem;
drop policy if exists despesas_admin_update_escopo on public.despesas_viagem;
drop policy if exists manutencoes_select_contexto on public.manutencoes;
drop policy if exists manutencoes_insert_contexto on public.manutencoes;
drop policy if exists manutencoes_update_contexto on public.manutencoes;
drop policy if exists manutencao_mecanicos_select_contexto on public.manutencao_mecanicos;
drop policy if exists manutencao_mecanicos_insert_contexto on public.manutencao_mecanicos;
drop policy if exists manutencao_mecanicos_update_contexto on public.manutencao_mecanicos;
drop policy if exists manutencao_servicos_select_contexto on public.manutencao_servicos;
drop policy if exists manutencao_servicos_insert_contexto on public.manutencao_servicos;
drop policy if exists manutencao_servicos_update_contexto on public.manutencao_servicos;
drop policy if exists manutencao_pecas_select_contexto on public.manutencao_pecas;
drop policy if exists despesa_pecas_select_contexto on public.despesa_pecas;
drop policy if exists pendencias_manuais_select_contexto on public.pendencias_manuais;
drop policy if exists pendencias_manuais_insert_contexto on public.pendencias_manuais;
drop policy if exists pendencias_manuais_update_contexto on public.pendencias_manuais;
drop policy if exists pendencia_interacoes_select_contexto on public.pendencia_interacoes;
drop policy if exists pendencia_interacoes_insert_contexto on public.pendencia_interacoes;
drop policy if exists auditoria_select_global on public.auditoria_eventos;

drop policy if exists perfis_select_proprio_ou_admin on public.perfis;
create policy perfis_select_por_contexto on public.perfis
  for select to authenticated
  using (public.perfil_visivel_para_usuario(id));

drop policy if exists motoristas_select_por_papel on public.motoristas;
create policy motoristas_select_por_contexto on public.motoristas
  for select to authenticated
  using (
    public.admin_pode_acessar_responsavel(admin_responsavel_id)
    or public.eh_mecanico()
    or perfil_id = auth.uid()
  );
create policy motoristas_admin_insert_escopo on public.motoristas
  for insert to authenticated
  with check (public.admin_pode_acessar_responsavel(admin_responsavel_id));
create policy motoristas_admin_update_escopo on public.motoristas
  for update to authenticated
  using (public.admin_pode_acessar_responsavel(admin_responsavel_id))
  with check (public.admin_pode_acessar_responsavel(admin_responsavel_id));

drop policy if exists veiculos_select_por_papel on public.veiculos;
create policy veiculos_select_por_contexto on public.veiculos
  for select to authenticated
  using (
    public.admin_pode_acessar_responsavel(admin_responsavel_id)
    or public.eh_mecanico()
    or exists (
      select 1
      from public.veiculo_motoristas vm
      where vm.veiculo_id = veiculos.id
        and vm.motorista_id = public.motorista_atual_id()
        and vm.ativo = true
        and vm.fim_em is null
    )
    or exists (
      select 1
      from public.viagens vi
      where vi.veiculo_id = veiculos.id
        and vi.motorista_id = public.motorista_atual_id()
    )
  );

drop policy if exists veiculos_admin_insert on public.veiculos;
create policy veiculos_admin_insert_escopo on public.veiculos
  for insert to authenticated
  with check (public.admin_pode_acessar_responsavel(admin_responsavel_id));

drop policy if exists veiculos_admin_update on public.veiculos;
create policy veiculos_admin_update_escopo on public.veiculos
  for update to authenticated
  using (public.admin_pode_acessar_responsavel(admin_responsavel_id))
  with check (public.admin_pode_acessar_responsavel(admin_responsavel_id));

drop policy if exists veiculo_motoristas_select_por_papel on public.veiculo_motoristas;
create policy veiculo_motoristas_select_por_contexto on public.veiculo_motoristas
  for select to authenticated
  using (
    public.eh_mecanico()
    or motorista_id = public.motorista_atual_id()
    or (
      public.admin_pode_acessar_veiculo(veiculo_id)
      and public.admin_pode_acessar_motorista(motorista_id)
    )
  );

drop policy if exists veiculo_motoristas_admin_insert on public.veiculo_motoristas;
create policy veiculo_motoristas_admin_insert_escopo on public.veiculo_motoristas
  for insert to authenticated
  with check (
    public.admin_pode_acessar_veiculo(veiculo_id)
    and public.admin_pode_acessar_motorista(motorista_id)
  );

drop policy if exists veiculo_motoristas_admin_update on public.veiculo_motoristas;
create policy veiculo_motoristas_admin_update_escopo on public.veiculo_motoristas
  for update to authenticated
  using (
    public.admin_pode_acessar_veiculo(veiculo_id)
    and public.admin_pode_acessar_motorista(motorista_id)
  )
  with check (
    public.admin_pode_acessar_veiculo(veiculo_id)
    and public.admin_pode_acessar_motorista(motorista_id)
  );

drop policy if exists veiculo_documentos_select_operacional on public.veiculo_documentos;
create policy veiculo_documentos_select_contexto on public.veiculo_documentos
  for select to authenticated
  using (
    public.admin_pode_acessar_veiculo(veiculo_id)
    or public.eh_mecanico()
    or exists (
      select 1
      from public.veiculo_motoristas vm
      where vm.veiculo_id = veiculo_documentos.veiculo_id
        and vm.motorista_id = public.motorista_atual_id()
        and vm.ativo = true
        and vm.fim_em is null
    )
  );

drop policy if exists veiculo_documentos_admin_insert on public.veiculo_documentos;
create policy veiculo_documentos_admin_insert_escopo on public.veiculo_documentos
  for insert to authenticated
  with check (public.admin_pode_acessar_veiculo(veiculo_id));

drop policy if exists veiculo_documentos_admin_update on public.veiculo_documentos;
create policy veiculo_documentos_admin_update_escopo on public.veiculo_documentos
  for update to authenticated
  using (public.admin_pode_acessar_veiculo(veiculo_id))
  with check (public.admin_pode_acessar_veiculo(veiculo_id));

drop policy if exists programacoes_select_operacional on public.veiculo_servico_programacoes;
create policy programacoes_select_contexto on public.veiculo_servico_programacoes
  for select to authenticated
  using (
    public.admin_pode_acessar_veiculo(veiculo_id)
    or public.eh_mecanico()
    or exists (
      select 1
      from public.veiculo_motoristas vm
      where vm.veiculo_id = veiculo_servico_programacoes.veiculo_id
        and vm.motorista_id = public.motorista_atual_id()
        and vm.ativo = true
        and vm.fim_em is null
    )
  );

drop policy if exists programacoes_admin_mecanico_insert on public.veiculo_servico_programacoes;
create policy programacoes_insert_contexto on public.veiculo_servico_programacoes
  for insert to authenticated
  with check (public.eh_mecanico() or public.admin_pode_acessar_veiculo(veiculo_id));

drop policy if exists programacoes_admin_mecanico_update on public.veiculo_servico_programacoes;
create policy programacoes_update_contexto on public.veiculo_servico_programacoes
  for update to authenticated
  using (public.eh_mecanico() or public.admin_pode_acessar_veiculo(veiculo_id))
  with check (public.eh_mecanico() or public.admin_pode_acessar_veiculo(veiculo_id));

drop policy if exists viagens_select_operacional on public.viagens;
create policy viagens_select_contexto on public.viagens
  for select to authenticated
  using (
    motorista_id = public.motorista_atual_id()
    or (
      public.admin_pode_acessar_veiculo(veiculo_id)
      and public.admin_pode_acessar_motorista(motorista_id)
    )
  );

drop policy if exists viagens_admin_insert on public.viagens;
create policy viagens_admin_insert_escopo on public.viagens
  for insert to authenticated
  with check (
    public.admin_pode_acessar_veiculo(veiculo_id)
    and public.admin_pode_acessar_motorista(motorista_id)
  );

drop policy if exists viagens_admin_update on public.viagens;
create policy viagens_admin_update_escopo on public.viagens
  for update to authenticated
  using (public.admin_pode_acessar_veiculo(veiculo_id))
  with check (
    public.admin_pode_acessar_veiculo(veiculo_id)
    and public.admin_pode_acessar_motorista(motorista_id)
  );

drop policy if exists abastecimentos_select_operacional on public.abastecimentos;
create policy abastecimentos_select_contexto on public.abastecimentos
  for select to authenticated
  using (
    motorista_id = public.motorista_atual_id()
    or public.admin_pode_acessar_veiculo(veiculo_id)
  );

drop policy if exists abastecimentos_admin_insert on public.abastecimentos;
create policy abastecimentos_admin_insert_escopo on public.abastecimentos
  for insert to authenticated
  with check (
    public.admin_pode_acessar_veiculo(veiculo_id)
    and (
      motorista_id is null
      or public.admin_pode_acessar_motorista(motorista_id)
    )
  );

drop policy if exists abastecimentos_update_admin on public.abastecimentos;
create policy abastecimentos_admin_update_escopo on public.abastecimentos
  for update to authenticated
  using (public.admin_pode_acessar_veiculo(veiculo_id))
  with check (
    public.admin_pode_acessar_veiculo(veiculo_id)
    and (
      motorista_id is null
      or public.admin_pode_acessar_motorista(motorista_id)
    )
  );

drop policy if exists despesas_select_operacional on public.despesas_viagem;
create policy despesas_select_contexto on public.despesas_viagem
  for select to authenticated
  using (
    motorista_id = public.motorista_atual_id()
    or public.admin_pode_acessar_veiculo(veiculo_id)
  );

drop policy if exists despesas_admin_insert on public.despesas_viagem;
create policy despesas_admin_insert_escopo on public.despesas_viagem
  for insert to authenticated
  with check (
    public.admin_pode_acessar_veiculo(veiculo_id)
    and (
      motorista_id is null
      or public.admin_pode_acessar_motorista(motorista_id)
    )
  );

drop policy if exists despesas_update_admin on public.despesas_viagem;
create policy despesas_admin_update_escopo on public.despesas_viagem
  for update to authenticated
  using (public.admin_pode_acessar_veiculo(veiculo_id))
  with check (
    public.admin_pode_acessar_veiculo(veiculo_id)
    and (
      motorista_id is null
      or public.admin_pode_acessar_motorista(motorista_id)
    )
  );

drop policy if exists manutencoes_select_admin_mecanico on public.manutencoes;
create policy manutencoes_select_contexto on public.manutencoes
  for select to authenticated
  using (public.eh_mecanico() or public.admin_pode_acessar_veiculo(veiculo_id));

drop policy if exists manutencoes_insert_admin_mecanico on public.manutencoes;
create policy manutencoes_insert_contexto on public.manutencoes
  for insert to authenticated
  with check (public.eh_mecanico() or public.admin_pode_acessar_veiculo(veiculo_id));

drop policy if exists manutencoes_update_admin_mecanico on public.manutencoes;
create policy manutencoes_update_contexto on public.manutencoes
  for update to authenticated
  using (public.eh_mecanico() or public.admin_pode_acessar_veiculo(veiculo_id))
  with check (public.eh_mecanico() or public.admin_pode_acessar_veiculo(veiculo_id));

drop policy if exists manutencao_mecanicos_select_admin_mecanico on public.manutencao_mecanicos;
create policy manutencao_mecanicos_select_contexto on public.manutencao_mecanicos
  for select to authenticated
  using (
    public.eh_mecanico()
    or exists (
      select 1
      from public.manutencoes m
      where m.id = manutencao_mecanicos.manutencao_id
        and public.admin_pode_acessar_veiculo(m.veiculo_id)
    )
  );

drop policy if exists manutencao_mecanicos_insert_admin_mecanico on public.manutencao_mecanicos;
create policy manutencao_mecanicos_insert_contexto on public.manutencao_mecanicos
  for insert to authenticated
  with check (
    public.eh_mecanico()
    or exists (
      select 1
      from public.manutencoes m
      where m.id = manutencao_mecanicos.manutencao_id
        and public.admin_pode_acessar_veiculo(m.veiculo_id)
    )
  );

drop policy if exists manutencao_mecanicos_update_admin_mecanico on public.manutencao_mecanicos;
create policy manutencao_mecanicos_update_contexto on public.manutencao_mecanicos
  for update to authenticated
  using (
    public.eh_mecanico()
    or exists (
      select 1
      from public.manutencoes m
      where m.id = manutencao_mecanicos.manutencao_id
        and public.admin_pode_acessar_veiculo(m.veiculo_id)
    )
  )
  with check (
    public.eh_mecanico()
    or exists (
      select 1
      from public.manutencoes m
      where m.id = manutencao_mecanicos.manutencao_id
        and public.admin_pode_acessar_veiculo(m.veiculo_id)
    )
  );

drop policy if exists manutencao_servicos_select_admin_mecanico on public.manutencao_servicos;
create policy manutencao_servicos_select_contexto on public.manutencao_servicos
  for select to authenticated
  using (
    public.eh_mecanico()
    or exists (
      select 1
      from public.manutencoes m
      where m.id = manutencao_servicos.manutencao_id
        and public.admin_pode_acessar_veiculo(m.veiculo_id)
    )
  );

drop policy if exists manutencao_servicos_insert_admin_mecanico on public.manutencao_servicos;
create policy manutencao_servicos_insert_contexto on public.manutencao_servicos
  for insert to authenticated
  with check (
    public.eh_mecanico()
    or exists (
      select 1
      from public.manutencoes m
      where m.id = manutencao_servicos.manutencao_id
        and public.admin_pode_acessar_veiculo(m.veiculo_id)
    )
  );

drop policy if exists manutencao_servicos_update_admin_mecanico on public.manutencao_servicos;
create policy manutencao_servicos_update_contexto on public.manutencao_servicos
  for update to authenticated
  using (
    public.eh_mecanico()
    or exists (
      select 1
      from public.manutencoes m
      where m.id = manutencao_servicos.manutencao_id
        and public.admin_pode_acessar_veiculo(m.veiculo_id)
    )
  )
  with check (
    public.eh_mecanico()
    or exists (
      select 1
      from public.manutencoes m
      where m.id = manutencao_servicos.manutencao_id
        and public.admin_pode_acessar_veiculo(m.veiculo_id)
    )
  );

drop policy if exists manutencao_pecas_select_admin_mecanico on public.manutencao_pecas;
create policy manutencao_pecas_select_contexto on public.manutencao_pecas
  for select to authenticated
  using (
    public.eh_mecanico()
    or exists (
      select 1
      from public.manutencoes m
      where m.id = manutencao_pecas.manutencao_id
        and public.admin_pode_acessar_veiculo(m.veiculo_id)
    )
  );

drop policy if exists despesa_pecas_select_admin_mecanico on public.despesa_pecas;
create policy despesa_pecas_select_contexto on public.despesa_pecas
  for select to authenticated
  using (
    public.eh_mecanico()
    or exists (
      select 1
      from public.despesas_viagem d
      where d.id = despesa_pecas.despesa_id
        and public.admin_pode_acessar_veiculo(d.veiculo_id)
    )
  );

drop policy if exists pendencias_manuais_select_operacional on public.pendencias_manuais;
create policy pendencias_manuais_select_contexto on public.pendencias_manuais
  for select to authenticated
  using (
    public.eh_mecanico()
    or motorista_id = public.motorista_atual_id()
    or public.admin_pode_acessar_responsavel(admin_responsavel_id)
    or (veiculo_id is not null and public.admin_pode_acessar_veiculo(veiculo_id))
    or (motorista_id is not null and public.admin_pode_acessar_motorista(motorista_id))
    or exists (
      select 1
      from public.veiculo_motoristas vm
      where vm.veiculo_id = pendencias_manuais.veiculo_id
        and vm.motorista_id = public.motorista_atual_id()
        and vm.ativo = true
        and vm.fim_em is null
    )
  );

drop policy if exists pendencias_manuais_insert_admin_mecanico on public.pendencias_manuais;
create policy pendencias_manuais_insert_contexto on public.pendencias_manuais
  for insert to authenticated
  with check (
    public.eh_mecanico()
    or (
      public.eh_admin()
      and (
        public.admin_pode_acessar_responsavel(admin_responsavel_id)
        or (veiculo_id is not null and public.admin_pode_acessar_veiculo(veiculo_id))
        or (motorista_id is not null and public.admin_pode_acessar_motorista(motorista_id))
      )
    )
  );

drop policy if exists pendencias_manuais_update_admin_mecanico on public.pendencias_manuais;
create policy pendencias_manuais_update_contexto on public.pendencias_manuais
  for update to authenticated
  using (
    public.eh_mecanico()
    or public.admin_pode_acessar_responsavel(admin_responsavel_id)
    or (veiculo_id is not null and public.admin_pode_acessar_veiculo(veiculo_id))
    or (motorista_id is not null and public.admin_pode_acessar_motorista(motorista_id))
  )
  with check (
    public.eh_mecanico()
    or public.admin_pode_acessar_responsavel(admin_responsavel_id)
    or (veiculo_id is not null and public.admin_pode_acessar_veiculo(veiculo_id))
    or (motorista_id is not null and public.admin_pode_acessar_motorista(motorista_id))
  );

drop policy if exists pendencia_interacoes_select_relacionadas on public.pendencia_interacoes;
drop policy if exists pendencia_interacoes_insert_autenticado_ativo on public.pendencia_interacoes;
drop policy if exists pendencia_interacoes_admin_update on public.pendencia_interacoes;
create policy pendencia_interacoes_select_contexto on public.pendencia_interacoes
  for select to authenticated
  using (
    public.eh_admin_global()
    or public.eh_mecanico()
    or criado_por = auth.uid()
  );
create policy pendencia_interacoes_insert_contexto on public.pendencia_interacoes
  for insert to authenticated
  with check (
    public.perfil_ativo()
    and criado_por = auth.uid()
  );

drop policy if exists auditoria_select_admin on public.auditoria_eventos;
drop policy if exists auditoria_insert_admin on public.auditoria_eventos;
create policy auditoria_select_global on public.auditoria_eventos
  for select to authenticated
  using (public.eh_admin_global());
create policy auditoria_insert_admin on public.auditoria_eventos
  for insert to authenticated
  with check (public.eh_admin());

-- =========================================================
-- DASHBOARD RESPEITANDO O ADMINISTRADOR RESPONSAVEL
-- =========================================================

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
  if not public.eh_admin() then
    raise exception 'Somente admin pode consultar dashboard administrativo';
  end if;

  with veiculos_permitidos as (
    select v.id
    from public.veiculos v
    where v.excluido_em is null
      and (
        public.eh_admin_global()
        or v.admin_responsavel_id = auth.uid()
      )
  ), motoristas_permitidos as (
    select m.id
    from public.motoristas m
    where m.excluido_em is null
      and (
        public.eh_admin_global()
        or m.admin_responsavel_id = auth.uid()
      )
  ), viagens_filtradas as (
    select v.*
    from public.viagens v
    join veiculos_permitidos vp on vp.id = v.veiculo_id
    where v.saiu_em >= v_inicio and v.saiu_em < v_fim
      and (p_veiculo_id is null or v.veiculo_id = p_veiculo_id)
      and (p_motorista_id is null or v.motorista_id = p_motorista_id)
  ), abastecimentos_filtrados as (
    select a.*
    from public.abastecimentos a
    join veiculos_permitidos vp on vp.id = a.veiculo_id
    where a.registrado_em >= v_inicio and a.registrado_em < v_fim
      and a.cancelado_em is null
      and (p_veiculo_id is null or a.veiculo_id = p_veiculo_id)
      and (p_motorista_id is null or a.motorista_id = p_motorista_id)
  ), despesas_filtradas as (
    select d.*
    from public.despesas_viagem d
    join veiculos_permitidos vp on vp.id = d.veiculo_id
    where d.registrado_em >= v_inicio and d.registrado_em < v_fim
      and d.cancelado_em is null
      and (p_veiculo_id is null or d.veiculo_id = p_veiculo_id)
      and (p_motorista_id is null or d.motorista_id = p_motorista_id)
  ), manutencoes_filtradas as (
    select
      m.*,
      coalesce(servicos.valor_servicos, 0)
      + coalesce(itens.valor_pecas, 0) as valor_realizado
    from public.manutencoes m
    join veiculos_permitidos vp on vp.id = m.veiculo_id
    left join lateral (
      select sum(ms.valor_aplicado) as valor_servicos
      from public.manutencao_servicos ms
      where ms.manutencao_id = m.id
    ) servicos on true
    left join lateral (
      select sum(mp.valor_total) as valor_pecas
      from public.manutencao_pecas mp
      where mp.manutencao_id = m.id
    ) itens on true
    where m.aberto_em >= v_inicio
      and m.aberto_em < v_fim
      and m.status <> 'cancelada'
      and (p_veiculo_id is null or m.veiculo_id = p_veiculo_id)
  ), pendencias_criticas as (
    select count(*) as total
    from public.vw_pendencias_operacionais p
    where p.severidade = 'critica'
      and p.status = 'aberta'
      and (
        public.eh_admin_global()
        or p.veiculo_id in (select id from veiculos_permitidos)
        or p.motorista_id in (select id from motoristas_permitidos)
        or p.chave in (
          select 'manual:' || pm.id::text
          from public.pendencias_manuais pm
          where pm.admin_responsavel_id = auth.uid()
        )
      )
  )
  select jsonb_build_object(
    'total_veiculos', (select count(*) from veiculos_permitidos),
    'veiculos_em_manutencao', (
      select count(*)
      from public.veiculos v
      join veiculos_permitidos vp on vp.id = v.id
      where v.status_operacional = 'em_manutencao'
    ),
    'viagens_em_andamento', (
      select count(*)
      from public.viagens v
      join veiculos_permitidos vp on vp.id = v.veiculo_id
      where v.status = 'em_andamento'
    ),
    'pendencias_criticas', (select total from pendencias_criticas),
    'km_rodados', coalesce((
      select sum(km_final - km_inicial)
      from viagens_filtradas
      where status = 'concluida'
    ), 0),
    'litros_abastecidos', coalesce((
      select sum(litros)
      from abastecimentos_filtrados
      where tipo_combustivel <> 'ARLA'
    ), 0),
    'consumo_medio', case
      when coalesce((
        select sum(litros)
        from abastecimentos_filtrados
        where tipo_combustivel <> 'ARLA'
      ), 0) > 0
      then round((
        (
          select coalesce(sum(km_final - km_inicial), 0)
          from viagens_filtradas
          where status = 'concluida'
        )
        / nullif((
          select coalesce(sum(litros), 0)
          from abastecimentos_filtrados
          where tipo_combustivel <> 'ARLA'
        ), 0)
      )::numeric, 2)
      else null
    end,
    'gasto_abastecimento', coalesce((
      select sum(coalesce(valor_total, 0))
      from abastecimentos_filtrados
    ), 0),
    'gasto_manutencao', coalesce((
      select sum(valor_realizado)
      from manutencoes_filtradas
    ), 0),
    'gasto_despesas', coalesce((
      select sum(valor)
      from despesas_filtradas
    ), 0),
    'gasto_total',
      coalesce((select sum(coalesce(valor_total, 0)) from abastecimentos_filtrados), 0)
      + coalesce((select sum(valor_realizado) from manutencoes_filtradas), 0)
      + coalesce((select sum(valor) from despesas_filtradas), 0),
    'pecas_estoque_baixo', (
      select count(*)
      from public.pecas
      where ativo
        and excluido_em is null
        and quantidade_estoque <= estoque_minimo
    ),
    'valor_estoque_pecas', (
      select coalesce(sum(quantidade_estoque * valor_unitario), 0)
      from public.pecas
      where ativo
        and excluido_em is null
    )
  ) into result;

  return result;
end;
$$;

revoke execute on function public.eh_admin_global() from public, anon;
revoke execute on function public.admin_pode_acessar_responsavel(uuid) from public, anon;
revoke execute on function public.admin_pode_acessar_veiculo(uuid) from public, anon;
revoke execute on function public.admin_pode_acessar_motorista(uuid) from public, anon;

grant execute on function public.eh_admin_global() to authenticated;
grant execute on function public.admin_pode_acessar_responsavel(uuid) to authenticated;
grant execute on function public.admin_pode_acessar_veiculo(uuid) to authenticated;
grant execute on function public.admin_pode_acessar_motorista(uuid) to authenticated;
