begin;

-- Documentos de veiculo passam a ser aplicaveis por veiculo.
-- A existencia de um registro ativo em veiculo_documentos define se aquele documento vale para o veiculo.
-- Documentos cancelados, substituidos ou de tipos inativos nao devem gerar alertas operacionais.
create or replace view public.vw_documentos_veiculo_status
with (security_invoker = true)
as
select
  d.*,
  v.placa as veiculo_placa,
  t.codigo as tipo_codigo,
  t.nome as tipo_nome,
  public.calcular_status_vencimento(d.vencimento_em, t.dias_alerta) as status_calculado,
  public.calcular_severidade_vencimento(d.vencimento_em, t.dias_alerta) as severidade_calculada,
  v.codigo_frota as veiculo_codigo_frota
from public.veiculo_documentos d
join public.tipos_documento_veiculo t on t.id = d.tipo_documento_id
join public.veiculos v on v.id = d.veiculo_id
where d.status_operacional = 'ativo'
  and d.excluido_em is null
  and t.ativo = true;

comment on view public.vw_documentos_veiculo_status is
  'Documentos ativos e aplicaveis por veiculo, usados para vencimentos e pendencias calculadas.';
comment on table public.tipos_documento_veiculo is
  'Catalogo de tipos de documentos que podem ser selecionados individualmente em cada veiculo.';
comment on table public.veiculo_documentos is
  'Historico de documentos aplicados ao veiculo; somente registros ativos indicam documentos vigentes.';
comment on column public.veiculo_documentos.status_operacional is
  'ativo = documento vigente do veiculo; substituido/cancelado = historico sem gerar pendencias.';

-- Saneamento inicial do legado: o formulario antigo criava CETURB para todo veiculo.
-- Pela regra operacional atual, CETURB permanece apenas em onibus.
update public.veiculo_documentos d
set
  status_operacional = 'cancelado',
  atualizado_em = now(),
  atualizado_por = coalesce(auth.uid(), d.atualizado_por)
from public.tipos_documento_veiculo t, public.veiculos v
where d.tipo_documento_id = t.id
  and d.veiculo_id = v.id
  and t.codigo = 'ceturb'
  and d.status_operacional = 'ativo'
  and d.excluido_em is null
  and coalesce(v.tipo, '') not ilike '%nibus%';

commit;
