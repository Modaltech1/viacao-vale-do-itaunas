import assert from 'node:assert/strict'
import test from 'node:test'

import {
  cancelMaintenance,
  createMaintenance,
  updateMaintenance,
} from '@/lib/maintenances-service'
import {
  createManagedUser,
  updateManagedUser,
} from '@/lib/managed-users'
import {
  createAdminUser,
  transferAdminResource,
  updateAdminUser,
} from '@/lib/admin-management-service'
import { savePart } from '@/lib/parts-service'
import { saveExpense } from '@/lib/expenses-service'
import { interactWithPending } from '@/lib/pendings-service'
import { resolveTripRelation } from '@/lib/travel-operation-service'

function profileUpdateService({
  profileError = null,
  authUpdateError = null,
  rollbackError = null,
} = {}) {
  const calls = []
  let updateCount = 0
  const currentProfile = {
    nome: 'Nome anterior',
    email: 'anterior@example.com',
    telefone: null,
    papel: 'motorista',
    ativo: true,
    atualizado_por: 'admin-old',
  }
  const service = {
    calls,
    auth: {
      admin: {
        async createUser(payload) {
          calls.push(['auth.createUser', payload])
          return { data: { user: { id: 'user-1' } }, error: null }
        },
        async deleteUser(userId) {
          calls.push(['auth.deleteUser', userId])
          return { error: null }
        },
        async updateUserById(userId, payload) {
          calls.push(['auth.updateUserById', userId, payload])
          return { error: authUpdateError }
        },
      },
    },
    from(table) {
      assert.equal(table, 'perfis')
      return {
        select() {
          return {
            eq(column, value) {
              calls.push(['profile.select.eq', column, value])
              return {
                async single() {
                  return { data: currentProfile, error: null }
                },
              }
            },
          }
        },
        update(payload) {
          updateCount += 1
          const currentError = updateCount === 1 ? profileError : rollbackError
          calls.push(['profile.update', updateCount, payload])
          return {
            eq(column, value) {
              calls.push(['profile.eq', column, value])
              return {
                select() {
                  return {
                    async single() {
                      return {
                        data: currentError ? null : { id: value },
                        error: currentError,
                      }
                    },
                  }
                },
                then(resolve) {
                  resolve({ error: currentError })
                },
              }
            },
          }
        },
      }
    },
  }
  return service
}

test('criação de usuário compensa o Auth quando o perfil falha', async () => {
  const service = profileUpdateService({ profileError: new Error('profile failed') })

  await assert.rejects(
    createManagedUser(service, 'admin-1', {
      name: 'Motorista',
      email: 'motorista@example.com',
      password: 'secret123',
      phone: '',
      active: true,
      role: 'motorista',
    }),
    /profile failed/,
  )

  assert.deepEqual(
    service.calls.filter(([name]) => name === 'auth.deleteUser'),
    [['auth.deleteUser', 'user-1']],
  )
})

test('criação e atualização de usuário propagam papel e dados do perfil', async () => {
  const service = profileUpdateService()
  const input = {
    name: 'Mecânico',
    email: 'mecanico@example.com',
    password: 'secret123',
    phone: '27999999999',
    active: true,
    role: 'mecanico',
  }

  assert.equal(await createManagedUser(service, 'admin-1', input), 'user-1')
  await updateManagedUser(service, 'admin-1', 'user-1', input)
  assert.equal(
    service.calls.some(([name, , payload]) => (
      name === 'auth.updateUserById' && payload.app_metadata.papel === 'mecanico'
    )),
    true,
  )
})

test('criação de administrador propaga nível ao Auth e ao perfil', async () => {
  const service = profileUpdateService()

  await createAdminUser(service, 'admin-global', {
    name: 'Gestor de ônibus',
    email: 'onibus@example.com',
    password: 'secret123',
    phone: '',
    active: true,
    level: 'restrito',
  })

  const authCall = service.calls.find(([name]) => name === 'auth.createUser')
  const profileCall = service.calls.find(([name]) => name === 'profile.update')
  assert.equal(authCall[1].app_metadata.papel, 'admin')
  assert.equal(authCall[1].app_metadata.nivel_admin, 'restrito')
  assert.equal(profileCall[2].nivel_admin, 'restrito')
})

test('administrador global não pode restringir o próprio acesso', async () => {
  await assert.rejects(
    updateAdminUser({}, 'admin-global', 'admin-global', {
      name: 'Administrador',
      email: 'admin@example.com',
      password: '',
      phone: '',
      active: true,
      level: 'restrito',
    }),
    /próprio acesso global/,
  )
})

function transferService({ linkedOwnerId = null } = {}) {
  const calls = []

  return {
    calls,
    from(table) {
      if (table === 'perfis') {
        return {
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      eq() {
                        return {
                          async maybeSingle() {
                            return { data: { id: 'admin-b' }, error: null }
                          },
                        }
                      },
                    }
                  },
                }
              },
            }
          },
        }
      }

      if (table === 'veiculo_motoristas') {
        return {
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      async is() {
                        return {
                          data: linkedOwnerId
                            ? [{
                                motorista_id: 'driver-1',
                                motoristas: { admin_responsavel_id: linkedOwnerId },
                              }]
                            : [],
                          error: null,
                        }
                      },
                    }
                  },
                }
              },
            }
          },
        }
      }

      if (table === 'veiculos') {
        return {
          update(payload) {
            calls.push(['vehicle.update', payload])
            return {
              eq() {
                return {
                  is() {
                    return {
                      select() {
                        return {
                          async single() {
                            return { data: { id: 'vehicle-1' }, error: null }
                          },
                        }
                      },
                    }
                  },
                }
              },
            }
          },
        }
      }

      throw new Error(`Tabela inesperada: ${table}`)
    },
  }
}

test('transferência de veículo preserva consistência com motoristas ativos', async () => {
  const service = transferService()
  await transferAdminResource(
    service,
    'admin-global',
    'vehicle',
    'vehicle-1',
    'admin-b',
  )

  assert.deepEqual(service.calls[0], [
    'vehicle.update',
    {
      admin_responsavel_id: 'admin-b',
      atualizado_por: 'admin-global',
    },
  ])

  await assert.rejects(
    transferAdminResource(
      transferService({ linkedOwnerId: 'admin-a' }),
      'admin-global',
      'vehicle',
      'vehicle-1',
      'admin-b',
    ),
    /Transfira primeiro os motoristas ativos/,
  )
})

test('falha no Auth restaura o perfil anterior durante atualização', async () => {
  const service = profileUpdateService({ authUpdateError: new Error('auth failed') })

  await assert.rejects(
    updateManagedUser(service, 'admin-1', 'user-1', {
      name: 'Nome novo',
      email: 'novo@example.com',
      phone: '27999999999',
      active: false,
      role: 'motorista',
    }),
    /auth failed/,
  )

  const updates = service.calls.filter(([name]) => name === 'profile.update')
  assert.equal(updates.length, 2)
  assert.equal(updates[0][2].nome, 'Nome novo')
  assert.equal(updates[1][2].nome, 'Nome anterior')
})

function pendingService({ interactionError = null } = {}) {
  const calls = []
  let updateCount = 0
  return {
    calls,
    from(table) {
      if (table === 'pendencias_manuais') {
        return {
          select() {
            return {
              eq() {
                return {
                  async single() {
                    return {
                      data: {
                        status: 'aberta',
                        resolvida_em: null,
                        resolvida_por: null,
                        observacoes_resolucao: null,
                      },
                      error: null,
                    }
                  },
                }
              },
            }
          },
          update(payload) {
            updateCount += 1
            calls.push(['pending.update', updateCount, payload])
            return {
              async eq() {
                return { error: null }
              },
            }
          },
        }
      }

      if (table === 'pendencia_interacoes') {
        return {
          async insert(payload) {
            calls.push(['interaction.insert', payload])
            return { error: interactionError }
          },
        }
      }

      throw new Error(`Tabela inesperada: ${table}`)
    },
  }
}

test('resolução manual registra estado e interação', async () => {
  const service = pendingService()
  await interactWithPending(service, {
    key: 'manual:pending-1',
    origin: 'manual',
    action: 'resolvida_manual',
    comment: 'Documento regularizado',
    userId: 'admin-1',
  })

  assert.equal(service.calls[0][2].status, 'resolvida')
  assert.equal(service.calls[1][1].acao, 'resolvida_manual')
})

test('falha ao registrar interação restaura a pendência manual', async () => {
  const service = pendingService({ interactionError: new Error('interaction failed') })
  await assert.rejects(
    interactWithPending(service, {
      key: 'manual:pending-1',
      origin: 'manual',
      action: 'cancelada',
      comment: 'Registro duplicado',
      userId: 'admin-1',
    }),
    /interaction failed/,
  )

  const updates = service.calls.filter(([name]) => name === 'pending.update')
  assert.equal(updates.length, 2)
  assert.equal(updates[0][2].status, 'cancelada')
  assert.equal(updates[1][2].status, 'aberta')
})

test('relação de viagem prevalece sobre dados enviados pelo formulário', async () => {
  const service = {
    from(table) {
      assert.equal(table, 'viagens')
      return {
        select() {
          return {
            eq() {
              return {
                neq() {
                  return {
                    async single() {
                      return {
                        data: {
                          veiculo_id: 'vehicle-trip',
                          motorista_id: 'driver-trip',
                        },
                        error: null,
                      }
                    },
                  }
                },
              }
            },
          }
        },
      }
    },
  }

  assert.deepEqual(await resolveTripRelation(service, 'trip-1'), {
    vehicleId: 'vehicle-trip',
    driverId: 'driver-trip',
  })
  assert.equal(await resolveTripRelation(service, null), undefined)
})

test('peças, despesas e manutenções usam RPCs transacionais', async () => {
  const calls = []
  const service = {
    async rpc(name, payload) {
      calls.push([name, payload])
      return {
        data: name === 'fn_salvar_peca'
          ? 'part-1'
          : name === 'fn_salvar_despesa'
            ? 'expense-1'
            : 'maintenance-1',
        error: null,
      }
    },
  }

  assert.equal(await savePart(service, null, {
    code: 'FLT-001',
    name: 'Filtro',
    category: 'Filtros',
    unit: 'unidade',
    stockQuantity: 10,
    minimumStock: 2,
    unitValue: 50,
    description: null,
    active: true,
  }), 'part-1')

  assert.equal(await saveExpense(service, null, {
    tripId: null,
    vehicleId: 'vehicle-1',
    driverId: null,
    category: 'Peças',
    value: 0,
    registeredAt: '2026-06-08T10:00:00.000Z',
    notes: 'Troca avulsa',
    receiptPath: null,
    parts: [{ partId: 'part-1', quantity: 1, unitValue: 48 }],
  }), 'expense-1')

  assert.equal(await createMaintenance(service, {
    vehicleId: 'vehicle-1',
    maintenanceType: 'preventiva',
    cause: 'Revisão',
    openedAt: '2026-06-08T10:00:00.000Z',
    completedAt: null,
    vehicleKm: 25000,
    responsibleMechanicId: 'mechanic-1',
    status: 'aberta',
    notes: null,
    services: [{ serviceId: 'service-1', appliedValue: 120 }],
    parts: [{ partId: 'part-1', quantity: 2, unitValue: 45 }],
  }), 'maintenance-1')

  assert.equal(await createMaintenance(service, {
    vehicleId: 'vehicle-1',
    maintenanceType: 'corretiva',
    cause: 'Reparo histórico',
    openedAt: '2026-06-07T10:00:00.000Z',
    completedAt: '2026-06-07T15:00:00.000Z',
    vehicleKm: 24000,
    responsibleMechanicId: 'mechanic-1',
    status: 'concluida',
    notes: 'Lançamento posterior',
    services: [{ serviceId: 'service-1', appliedValue: 180 }],
    parts: [],
  }), 'maintenance-1')

  await updateMaintenance(service, 'maintenance-1', {
    vehicleId: 'vehicle-1',
    maintenanceType: 'preventiva',
    cause: 'Revisão concluída corrigida',
    openedAt: '2026-06-08T10:00:00.000Z',
    completedAt: '2026-06-08T18:00:00.000Z',
    vehicleKm: 25000,
    responsibleMechanicId: 'mechanic-1',
    status: 'concluida',
    notes: null,
    services: [{ serviceId: 'service-1', appliedValue: 135 }],
    parts: [{ partId: 'part-1', quantity: 2, unitValue: 45 }],
  })

  await cancelMaintenance(service, 'maintenance-1', 'Registro aberto por engano')

  assert.equal(calls[0][0], 'fn_salvar_peca')
  assert.equal(calls[1][0], 'fn_salvar_despesa')
  assert.deepEqual(calls[1][1].p_pecas, [
    { partId: 'part-1', quantity: 1, unitValue: 48 },
  ])
  assert.equal(calls[2][0], 'fn_salvar_manutencao')
  assert.deepEqual(calls[2][1].p_servicos, [
    { serviceId: 'service-1', appliedValue: 120 },
  ])
  assert.deepEqual(calls[2][1].p_pecas, [
    { partId: 'part-1', quantity: 2, unitValue: 45 },
  ])
  assert.equal(calls[3][0], 'fn_criar_manutencao_concluida')
  assert.equal(calls[3][1].p_status, 'concluida')
  assert.equal(calls[3][1].p_concluido_em, '2026-06-07T15:00:00.000Z')
  assert.equal('p_manutencao_id' in calls[3][1], false)
  assert.equal(calls[4][0], 'fn_editar_manutencao_concluida')
  assert.equal(calls[4][1].p_status, 'concluida')
  assert.equal(calls[4][1].p_concluido_em, '2026-06-08T18:00:00.000Z')
  assert.deepEqual(calls[4][1].p_servicos, [
    { serviceId: 'service-1', appliedValue: 135 },
  ])
  assert.equal(calls[5][0], 'fn_cancelar_manutencao')
})
