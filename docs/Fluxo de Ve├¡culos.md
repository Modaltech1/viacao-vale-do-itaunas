# Fluxo de Veículos

## Entradas
- Acesso à listagem de veículos.
- Filtros por placa, modelo, status, tipo e motorista.
- Dados de veículos, rotas, motoristas, viagens, abastecimentos, despesas, manutenções, serviços e pendências.

## O que acontece
1. O admin abre `/admin/veiculos`.
2. O sistema mostra cards de resumo da frota.
3. A tabela lista todos os veículos com rota fixa, motorista, KM, CETURB e status.
4. Ao clicar em detalhes, abre `/admin/veiculos/[id]`.
5. A página do veículo calcula métricas próprias do ativo.
6. O admin analisa consumo, custos, rota, vencimentos, manutenções, serviços programados e controle de pneus.

## Saídas
- Diagnóstico do veículo.
- Identificação de pendências.
- Base para troca de motorista/veículo, manutenção e decisão operacional.
