# Fluxo de Mecânico

## Objetivo
Permitir que o mecânico use o sistema no celular para executar registros de manutenção e acompanhar pendências.

## Entradas
- Lista de veículos.
- Lista de serviços.
- Pendências por KM, tempo, documentação e manutenção aberta.

## O que acontece
1. O mecânico abre `/mechanic`.
2. A tela principal mostra manutenções abertas e botão de registro.
3. Ao registrar manutenção, seleciona veículo, tipo, serviços, causa, KM, valor e status.
4. Pode abrir veículos e consultar histórico e serviços programados.
5. Pode consultar pendências em tela separada.

## Regras
- Mecânico não tem dashboard analítico.
- Manutenções são o módulo principal.
- Óleo e pneus são categorias de serviço.
