export type UserFacingErrorRule = {
  includes: string[]
  message: string
  status?: number
}

export type UserFacingError = {
  message: string
  status: number
}

function rawErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function explicitErrorStatus(error: unknown) {
  return typeof error === 'object'
    && error !== null
    && 'status' in error
    && typeof error.status === 'number'
      ? error.status
      : null
}

function normalizeForMatch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function ruleMatches(message: string, rule: UserFacingErrorRule) {
  return rule.includes.some((fragment) => message.includes(normalizeForMatch(fragment)))
}

function sanitizeMessage(message: string, fallback: string) {
  const normalized = normalizeForMatch(message)
  const isTechnical =
    normalized.includes('violates ')
    || normalized.includes('constraint ')
    || normalized.includes('duplicate key')
    || normalized.includes('foreign key')
    || normalized.includes('invalid api key')
    || normalized.includes('supabase')
    || normalized.includes('postgrest')
    || normalized.includes('schema cache')
    || normalized.includes('permission denied')

  return isTechnical ? fallback : message
}

const genericRules: UserFacingErrorRule[] = [
  {
    includes: ['invalid api key', 'service_role', 'schema cache'],
    message: 'O sistema não conseguiu acessar o banco de dados. Avise o suporte.',
    status: 500,
  },
  {
    includes: ['perfil inativo'],
    message: 'Seu acesso não está ativo. Fale com o administrador.',
    status: 403,
  },
  {
    includes: ['nao autenticado', 'não autenticado', 'sessao nao encontrada', 'sessão não encontrada'],
    message: 'Entre novamente para continuar.',
    status: 401,
  },
  {
    includes: ['peca fora da responsabilidade', 'peça fora da responsabilidade'],
    message: 'A peça selecionada não pertence ao responsável deste veículo.',
    status: 403,
  },
  {
    includes: ['sem permissao', 'sem permissão', 'fora da responsabilidade', 'permission denied', 'row-level security'],
    message: 'Você não tem permissão para fazer esta ação.',
    status: 403,
  },
  {
    includes: ['somente administradores globais', 'apenas para administradores globais'],
    message: 'Apenas administradores globais podem fazer esta ação.',
    status: 403,
  },
  {
    includes: ['somente administradores', 'somente admin', 'apenas para administradores'],
    message: 'Você não tem permissão para fazer esta ação.',
    status: 403,
  },
  {
    includes: ['administrador responsavel invalido', 'administrador responsável inválido', 'administrador responsavel precisa estar ativo', 'administrador responsável precisa estar ativo'],
    message: 'Selecione um administrador ativo para essa responsabilidade.',
    status: 400,
  },
  {
    includes: ['duplicate key', 'already registered', 'already exists', 'ja existe', 'já existe'],
    message: 'Já existe um registro com esses dados.',
    status: 409,
  },
  {
    includes: ['violates foreign key constraint', 'foreign key'],
    message: 'Este registro possui vínculos ativos e não pode ser alterado dessa forma.',
    status: 409,
  },
  {
    includes: ['violates not-null constraint', 'null value in column'],
    message: 'Preencha os campos obrigatórios antes de salvar.',
    status: 400,
  },
  {
    includes: [
      'km_decimos_check',
      'km_atual_decimos_check',
      'periodicidade_km_decimos_check',
      'pendencias_manuais_km_decimos_check',
    ],
    message: 'Informe o KM com ponto e uma casa decimal. Exemplo: 1000.0.',
    status: 400,
  },
  {
    includes: ['viagens_km_final_check'],
    message: 'O KM final deve ser maior que o KM inicial.',
    status: 400,
  },
  {
    includes: ['viagens_datas_check'],
    message: 'A chegada não pode ser anterior à saída.',
    status: 400,
  },
  {
    includes: ['abastecimentos_litros_check'],
    message: 'Informe uma quantidade de litros maior que zero.',
    status: 400,
  },
  {
    includes: ['abastecimentos_valores_check'],
    message: 'Revise os valores do abastecimento.',
    status: 400,
  },
  {
    includes: ['manutencoes_datas_check'],
    message: 'As datas da manutenção precisam seguir a ordem de abertura, início e conclusão.',
    status: 400,
  },
  {
    includes: ['manutencoes_concluida_check'],
    message: 'Informe a data de conclusão para finalizar a manutenção.',
    status: 400,
  },
  {
    includes: ['veiculos_ano_check'],
    message: 'Informe um ano válido para o veículo.',
    status: 400,
  },
  {
    includes: ['veiculos_status_operacional_check'],
    message: 'Selecione um status válido para o veículo.',
    status: 400,
  },
  {
    includes: ['violates check constraint', 'check constraint'],
    message: 'Confira os dados informados. Algum valor não atende às regras do sistema.',
    status: 400,
  },
  {
    includes: ['km atual nao pode ser menor que o ultimo evento operacional', 'km atual não pode ser menor que o último evento operacional'],
    message: 'O KM atual não pode ser menor que o último registro operacional do veículo. Revise viagens, abastecimentos ou manutenções.',
    status: 409,
  },
  {
    includes: ['km_atual do veiculo nao pode regredir', 'km_atual do veículo não pode regredir'],
    message: 'O KM do veículo só pode ser reduzido pela correção administrativa.',
    status: 409,
  },
  {
    includes: ['nao e possivel corrigir o km atual com viagem em andamento', 'não é possível corrigir o km atual com viagem em andamento'],
    message: 'Encerre ou cancele a viagem em andamento antes de alterar o KM do veículo.',
    status: 409,
  },
  {
    includes: ['km inicial nao pode ser menor que o km atual', 'km inicial não pode ser menor que o km atual'],
    message: 'O KM inicial da viagem não pode ser menor que o KM atual do veículo.',
    status: 400,
  },
  {
    includes: ['km final deve ser maior que o km inicial'],
    message: 'O KM final deve ser maior que o KM inicial.',
    status: 400,
  },
  {
    includes: ['km final nao pode ser menor que o ultimo km registrado', 'km final não pode ser menor que o último km registrado'],
    message: 'O KM final não pode ser menor que o último KM registrado na viagem.',
    status: 400,
  },
  {
    includes: ['data de chegada nao pode ser anterior', 'data de chegada não pode ser anterior'],
    message: 'A chegada não pode ser anterior à saída ou ao último registro da viagem.',
    status: 400,
  },
  {
    includes: ['ja possui viagem em andamento', 'já possui viagem em andamento', 'viagens_motorista_em_andamento_uniq', 'viagens_veiculo_em_andamento_uniq'],
    message: 'Já existe uma viagem em andamento para este motorista ou veículo.',
    status: 409,
  },
  {
    includes: ['somente viagem em andamento pode ser concluida', 'somente viagem em andamento pode ser concluída'],
    message: 'Apenas viagens em andamento podem ser encerradas.',
    status: 409,
  },
  {
    includes: ['abastecimento operacional so pode ser registrado em viagem em andamento', 'abastecimento operacional só pode ser registrado em viagem em andamento'],
    message: 'Registre abastecimentos apenas em viagens em andamento.',
    status: 409,
  },
  {
    includes: ['despesa operacional so pode ser registrada em viagem em andamento', 'despesa operacional só pode ser registrada em viagem em andamento'],
    message: 'Registre despesas apenas em viagens em andamento.',
    status: 409,
  },
  {
    includes: ['motorista nao possui vinculo ativo', 'motorista não possui vínculo ativo'],
    message: 'Este motorista não está vinculado ao veículo selecionado.',
    status: 403,
  },
  {
    includes: ['veiculo indisponivel', 'veículo indisponível'],
    message: 'Este veículo não está disponível para iniciar viagem.',
    status: 409,
  },
  {
    includes: ['somente a ultima viagem', 'somente a última viagem'],
    message: 'Somente a última viagem do veículo pode ser corrigida.',
    status: 409,
  },
  {
    includes: ['estoque insuficiente'],
    message: 'Estoque insuficiente para uma das peças selecionadas.',
    status: 409,
  },
  {
    includes: ['quantidade da peca', 'quantidade da peça', 'numero inteiro', 'número inteiro'],
    message: 'A quantidade desta peça precisa ser um número inteiro.',
    status: 400,
  },
  {
    includes: ['motorista e veiculo pertencem a administradores diferentes', 'motorista e veículo pertencem a administradores diferentes'],
    message: 'O motorista e o veículo pertencem a administradores diferentes.',
    status: 403,
  },
]

export function resolveUserFacingError(
  error: unknown,
  fallback: string,
  defaultStatus = 400,
  rules: UserFacingErrorRule[] = [],
): UserFacingError {
  const rawMessage = rawErrorMessage(error, fallback)
  const normalized = normalizeForMatch(rawMessage)
  const explicitStatus = explicitErrorStatus(error)
  const rule = [...rules, ...genericRules].find((candidate) => ruleMatches(normalized, candidate))

  if (rule) {
    return {
      message: rule.message,
      status: rule.status ?? explicitStatus ?? defaultStatus,
    }
  }

  return {
    message: sanitizeMessage(rawMessage || fallback, fallback),
    status: explicitStatus ?? defaultStatus,
  }
}
