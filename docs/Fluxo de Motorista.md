# Fluxo de Motorista

## Objetivo
Permitir que o motorista use o sistema no celular para registrar a operação atual, sem acesso a gestão financeira ou dados administrativos.

## Entradas
- Motorista autenticado.
- Veículo principal atribuído.
- Rota fixa do veículo.
- Viagem em andamento ou início de nova viagem.

## O que acontece
1. O motorista abre `/driver`.
2. Visualiza seus dados e o veículo atual.
3. Se não houver viagem em andamento, inicia viagem com origem, destino e KM inicial.
4. Se houver viagem em andamento, registra abastecimentos e despesas.
5. Ao final, informa KM final e encerra viagem.

## Regras
- Motorista não informa valor de combustível.
- Motorista só registra KM, litros, tipo de combustível e despesas da viagem.
- Motorista não edita veículo, rota, serviços ou outro motorista.
