begin;

delete from public.pendencia_interacoes
where acao in ('reconhecida', 'comentario');

alter table public.pendencia_interacoes
  rename column comentario to observacao;

alter table public.pendencia_interacoes
  drop constraint if exists pendencia_interacoes_acao_check;

alter table public.pendencia_interacoes
  add constraint pendencia_interacoes_acao_check
  check (acao in ('visualizada', 'resolvida_manual', 'ignorada'));

commit;
