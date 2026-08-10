import assert from 'node:assert/strict'
import test from 'node:test'

import { createVideotelemetryGatewayClient } from '@/lib/videotelemetry-gateway'

const baseUrl = 'http://32.196.8.246:7010'
const playerUrl = 'http://32.196.8.246:8080/?token=temporario'

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

test('gateway envia Bearer no servidor e valida status, inicio e parada', async () => {
  const calls = []
  const fetchImpl = async (input, init) => {
    const url = new URL(input)
    calls.push({ url, init })

    if (url.pathname === '/status') {
      return jsonResponse({
        running: true,
        channel: 1,
        startedAt: '2026-07-27T10:00:00.000Z',
        url: playerUrl,
      })
    }
    if (url.pathname === '/start') {
      return jsonResponse({
        success: true,
        alreadyRunning: false,
        channel: Number(url.searchParams.get('channel')),
        url: playerUrl,
      })
    }
    return jsonResponse({ success: true, stopped: true })
  }

  const client = createVideotelemetryGatewayClient({
    baseUrl,
    apiKey: 'segredo-de-teste',
    fetchImpl,
  })

  assert.deepEqual(await client.getStatus(), {
    running: true,
    channel: 1,
    startedAt: '2026-07-27T10:00:00.000Z',
    url: playerUrl,
  })

  const started = await client.startLive(2)
  assert.equal(started.running, true)
  assert.equal(started.channel, 2)
  assert.equal(started.url, playerUrl)
  assert.equal(started.alreadyRunning, false)
  assert.deepEqual(await client.stopLive(), { stopped: true })

  assert.deepEqual(calls.map((call) => call.url.pathname), ['/status', '/start', '/stop'])
  assert.equal(calls[1].url.searchParams.get('channel'), '2')
  for (const call of calls) {
    assert.equal(call.init.headers.Authorization, 'Bearer segredo-de-teste')
    assert.equal(call.init.cache, 'no-store')
  }
})

test('gateway converte autenticacao recusada em mensagem segura', async () => {
  const client = createVideotelemetryGatewayClient({
    baseUrl,
    apiKey: 'segredo-de-teste',
    fetchImpl: async () => jsonResponse({ error: 'unauthorized' }, 401),
  })

  await assert.rejects(
    () => client.getStatus(),
    (error) => error instanceof Error
      && error.message.includes('autenticar no servi\u00e7o de c\u00e2meras')
      && error.status === 502,
  )
})

test('gateway rejeita JSON e URL de player fora do host autorizado', async () => {
  const invalidJsonClient = createVideotelemetryGatewayClient({
    baseUrl,
    apiKey: 'segredo-de-teste',
    fetchImpl: async () => new Response('conteudo invalido', { status: 200 }),
  })
  await assert.rejects(
    () => invalidJsonClient.getStatus(),
    /resposta inv\u00e1lida/,
  )

  const foreignUrlClient = createVideotelemetryGatewayClient({
    baseUrl,
    apiKey: 'segredo-de-teste',
    fetchImpl: async () => jsonResponse({
      running: true,
      channel: 1,
      url: 'https://example.com/?token=vazamento',
    }),
  })
  await assert.rejects(
    () => foreignUrlClient.getStatus(),
    /URL de transmiss\u00e3o inv\u00e1lida/,
  )
})

test('gateway interrompe requisicao que excede o timeout', async () => {
  const client = createVideotelemetryGatewayClient({
    baseUrl,
    apiKey: 'segredo-de-teste',
    timeoutMs: 5,
    fetchImpl: (_input, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => {
        const error = new Error('aborted')
        error.name = 'AbortError'
        reject(error)
      })
    }),
  })

  await assert.rejects(
    () => client.getStatus(),
    (error) => error instanceof Error
      && error.message.includes('demorou para responder')
      && error.status === 504,
  )
})
