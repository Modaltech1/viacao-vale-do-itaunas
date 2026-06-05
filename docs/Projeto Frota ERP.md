# Projeto Frota ERP

## Contexto
Sistema para empresa de logística que controla ativos principais da operação: caminhões, ônibus, reboques e utilitários. O veículo é o núcleo do domínio.

## Módulos
- Autenticação e perfis
- Veículos
- Motoristas
- Mecânicos
- Rotas
- Viagens
- Abastecimentos
- Despesas de viagem
- Serviços
- Manutenções
- Pendências
- Relatórios

## Decisões do protótipo
- O protótipo usa dados mockados.
- A UI genérica vem de `@prodexy/ui`.
- O projeto mantém branding, páginas, layouts, navegação e regras de domínio localmente.
- O schema planejado está em `database/schema.sql`.

## Regra central
Detalhes do veículo concentram métricas do ativo: rota fixa, consumo, custos, viagens, abastecimentos, manutenções, serviços programados, pneus, óleo, documentação, tacógrafo e CETURB.
