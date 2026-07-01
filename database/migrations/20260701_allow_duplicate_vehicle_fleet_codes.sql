-- =========================================================
-- CODIGO DE FROTA COMO REFERENCIA OPERACIONAL NAO UNICA
-- =========================================================
--
-- A frota e o codigo mais importante para operacao, mecanicos e
-- administradores, mas nao identifica um veiculo de forma unica.
-- A placa continua sendo a identidade documental unica do veiculo.

drop index if exists public.veiculos_codigo_frota_normalizado_uniq;

create index if not exists veiculos_codigo_frota_normalizado_idx
  on public.veiculos(codigo_frota_normalizado)
  where codigo_frota_normalizado is not null and excluido_em is null;
