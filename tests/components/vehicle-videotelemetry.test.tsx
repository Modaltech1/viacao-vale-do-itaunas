import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { VehicleVideotelemetry } from '@/components/vehicles/vehicle-videotelemetry'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function apiResponse(body: unknown, ok = true) {
  return {
    ok,
    json: async () => body,
  } as Response
}

describe('videotelemetria do veiculo', () => {
  it('reserva a aba no clique, inicia a live e encerra a sessao', async () => {
    const requests: Array<{ url: string; method: string }> = []
    const startSequence: string[] = []
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      requests.push({ url, method })

      if (url.endsWith('/videotelemetria')) {
        return apiResponse({
          device: {
            id: 'device-1',
            model: 'MC202P',
            terminalLabel: '\u2022\u2022\u2022\u2022 6338',
            active: true,
            channels: [
              { number: 1, name: 'C\u00e2mera frontal', type: 'frontal' },
              { number: 2, name: 'C\u00e2mera da cabine', type: 'cabine' },
            ],
          },
        })
      }
      if (url.endsWith('/status')) {
        return apiResponse({
          live: { running: false, channel: null, startedAt: null, url: null },
        })
      }
      if (method === 'POST') {
        startSequence.push('request')
        return apiResponse({
          live: {
            running: true,
            channel: 1,
            startedAt: '2026-07-27T10:00:00.000Z',
            url: 'http://32.196.8.246:8080/?token=temporario',
            alreadyRunning: false,
          },
        })
      }
      return apiResponse({ stopped: true })
    })
    const replaceMock = vi.fn()
    const playerWindow = {
      closed: false,
      opener: window,
      location: { replace: replaceMock },
      focus: vi.fn(),
      close: vi.fn(),
    } as unknown as Window
    const openMock = vi.spyOn(window, 'open').mockImplementation(() => {
      startSequence.push('open')
      return playerWindow
    })
    vi.stubGlobal('fetch', fetchMock)

    const user = userEvent.setup()
    render(<VehicleVideotelemetry vehicleId="vehicle-1" />)

    expect(await screen.findByText('C\u00e2mera frontal')).toBeInTheDocument()
    expect(screen.getByText('C\u00e2mera da cabine')).toBeInTheDocument()
    expect(screen.getByText('Terminal \u2022\u2022\u2022\u2022 6338 \u00b7 2 c\u00e2mera(s)')).toBeInTheDocument()
    expect(screen.getByText('Nenhuma transmiss\u00e3o ativa')).toBeInTheDocument()

    await user.click(screen.getByRole('button', {
      name: 'Assistir ao vivo: C\u00e2mera frontal',
    }))

    await waitFor(() => {
      expect(openMock).toHaveBeenCalledWith(
        'about:blank',
        'prodexy-videotelemetry-live',
      )
      expect(replaceMock).toHaveBeenCalledWith(
        'http://32.196.8.246:8080/?token=temporario',
      )
    })
    expect(startSequence.slice(-2)).toEqual(['open', 'request'])
    expect(screen.getByText(/Ao vivo desde/)).toBeInTheDocument()
    expect(screen.getAllByText('C\u00e2mera frontal').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: 'Encerrar' }))
    expect(await screen.findByText('Nenhuma transmiss\u00e3o ativa')).toBeInTheDocument()

    expect(requests).toEqual([
      {
        url: '/api/admin/veiculos/vehicle-1/videotelemetria',
        method: 'GET',
      },
      {
        url: '/api/admin/veiculos/vehicle-1/videotelemetria/status',
        method: 'GET',
      },
      {
        url: '/api/admin/veiculos/vehicle-1/videotelemetria/live',
        method: 'POST',
      },
      {
        url: '/api/admin/veiculos/vehicle-1/videotelemetria/live',
        method: 'DELETE',
      },
    ])
  })

  it('exibe estado vazio sem controles de transmissao', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => apiResponse({ device: null })))

    render(<VehicleVideotelemetry vehicleId="vehicle-2" />)

    expect(await screen.findByText('Nenhuma c\u00e2mera vinculada')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Assistir ao vivo/ }))
      .not.toBeInTheDocument()
  })
})
