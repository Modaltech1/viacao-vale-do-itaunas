-- Padroniza toda quilometragem em decimos de KM.
-- Valores historicos inteiros permanecem os mesmos e passam a ser exibidos como *.0.

alter table public.viagens
  drop constraint if exists viagens_km_final_check;
alter table public.rotas drop constraint if exists rotas_km_estimado_decimos_check;
alter table public.veiculos drop constraint if exists veiculos_km_atual_decimos_check;
alter table public.servicos drop constraint if exists servicos_periodicidade_km_decimos_check;
alter table public.veiculo_servico_programacoes drop constraint if exists veiculo_servico_programacoes_km_decimos_check;
alter table public.viagens drop constraint if exists viagens_km_decimos_check;
alter table public.abastecimentos drop constraint if exists abastecimentos_km_decimos_check;
alter table public.manutencoes drop constraint if exists manutencoes_km_decimos_check;
alter table public.pendencias_manuais drop constraint if exists pendencias_manuais_km_decimos_check;

update public.rotas
set km_estimado = round(km_estimado, 1)
where km_estimado is not null
  and km_estimado <> round(km_estimado, 1);

update public.veiculos
set km_atual = round(km_atual, 1)
where km_atual <> round(km_atual, 1);

update public.servicos
set periodicidade_km = round(periodicidade_km, 1)
where periodicidade_km is not null
  and periodicidade_km <> round(periodicidade_km, 1);

update public.veiculo_servico_programacoes
set
  periodicidade_km_snapshot = round(periodicidade_km_snapshot, 1),
  ultimo_realizado_km = round(ultimo_realizado_km, 1),
  proximo_vencimento_km = round(proximo_vencimento_km, 1),
  km_alerta = round(km_alerta, 1)
where periodicidade_km_snapshot is distinct from round(periodicidade_km_snapshot, 1)
   or ultimo_realizado_km is distinct from round(ultimo_realizado_km, 1)
   or proximo_vencimento_km is distinct from round(proximo_vencimento_km, 1)
   or km_alerta <> round(km_alerta, 1);

update public.viagens
set
  km_estimado_snapshot = round(km_estimado_snapshot, 1),
  km_inicial = round(km_inicial, 1),
  km_final = round(km_final, 1)
where km_estimado_snapshot is distinct from round(km_estimado_snapshot, 1)
   or km_inicial <> round(km_inicial, 1)
   or km_final is distinct from round(km_final, 1);

update public.abastecimentos
set km_registrado = round(km_registrado, 1)
where km_registrado <> round(km_registrado, 1);

update public.manutencoes
set km_veiculo = round(km_veiculo, 1)
where km_veiculo is not null
  and km_veiculo <> round(km_veiculo, 1);

update public.pendencias_manuais
set vencimento_km = round(vencimento_km, 1)
where vencimento_km is not null
  and vencimento_km <> round(vencimento_km, 1);

alter table public.rotas
  add constraint rotas_km_estimado_decimos_check
  check (km_estimado is null or km_estimado = round(km_estimado, 1)) not valid;

alter table public.veiculos
  add constraint veiculos_km_atual_decimos_check
  check (km_atual = round(km_atual, 1)) not valid;

alter table public.servicos
  add constraint servicos_periodicidade_km_decimos_check
  check (periodicidade_km is null or periodicidade_km = round(periodicidade_km, 1)) not valid;

alter table public.veiculo_servico_programacoes
  add constraint veiculo_servico_programacoes_km_decimos_check
  check (
    (periodicidade_km_snapshot is null or periodicidade_km_snapshot = round(periodicidade_km_snapshot, 1))
    and (ultimo_realizado_km is null or ultimo_realizado_km = round(ultimo_realizado_km, 1))
    and (proximo_vencimento_km is null or proximo_vencimento_km = round(proximo_vencimento_km, 1))
    and km_alerta = round(km_alerta, 1)
  ) not valid;

alter table public.viagens
  add constraint viagens_km_decimos_check
  check (
    km_inicial = round(km_inicial, 1)
    and (km_final is null or km_final = round(km_final, 1))
    and (km_estimado_snapshot is null or km_estimado_snapshot = round(km_estimado_snapshot, 1))
  ) not valid;

alter table public.viagens
  add constraint viagens_km_final_check
  check (km_final is null or km_final > km_inicial) not valid;

alter table public.abastecimentos
  add constraint abastecimentos_km_decimos_check
  check (km_registrado = round(km_registrado, 1)) not valid;

alter table public.manutencoes
  add constraint manutencoes_km_decimos_check
  check (km_veiculo is null or km_veiculo = round(km_veiculo, 1)) not valid;

alter table public.pendencias_manuais
  add constraint pendencias_manuais_km_decimos_check
  check (vencimento_km is null or vencimento_km = round(vencimento_km, 1)) not valid;

alter table public.rotas validate constraint rotas_km_estimado_decimos_check;
alter table public.veiculos validate constraint veiculos_km_atual_decimos_check;
alter table public.servicos validate constraint servicos_periodicidade_km_decimos_check;
alter table public.veiculo_servico_programacoes validate constraint veiculo_servico_programacoes_km_decimos_check;
alter table public.viagens validate constraint viagens_km_decimos_check;
alter table public.abastecimentos validate constraint abastecimentos_km_decimos_check;
alter table public.manutencoes validate constraint manutencoes_km_decimos_check;
alter table public.pendencias_manuais validate constraint pendencias_manuais_km_decimos_check;
