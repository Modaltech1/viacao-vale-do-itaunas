begin;

insert into public.tipos_documento_veiculo (codigo, nome, dias_alerta)
values ('aet', 'AET', 30)
on conflict (codigo) do update set
  nome = excluded.nome,
  dias_alerta = excluded.dias_alerta,
  ativo = true,
  atualizado_em = now();

commit;
