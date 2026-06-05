'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import {
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@prodexy/ui'
import {
  Bus,
  CircleStop,
  DollarSign,
  Fuel,
  MapPin,
  Play,
  Route,
  UserRound,
} from 'lucide-react'
import {
  EndTripDialog,
  ExpenseDialog,
  RefuelingDialog,
} from '@/components/driver/driver-operation-dialogs'
import { StatusBadge } from '@/components/shared/status-badge'
import { brl, dateTime, maskCpf, number } from '@/lib/format'
import type {
  DriverPortalData,
  DriverPortalVehicle,
  StartTripFormValues,
} from '@/types/driver-portal'

const emptyStartForm: StartTripFormValues = {
  vehicleId: '',
  origin: '',
  destination: '',
  initialKm: '',
  notes: '',
}

const unavailableVehicleStatuses = ['em_manutencao', 'inativo', 'indisponivel']

function startFormForVehicle(vehicle?: DriverPortalVehicle | null): StartTripFormValues {
  if (!vehicle) return emptyStartForm

  return {
    vehicleId: vehicle.id,
    origin: vehicle.route?.origin ?? '',
    destination: vehicle.route?.destination ?? '',
    initialKm: vehicle.currentKm.toString(),
    notes: '',
  }
}

function formatDateOnly(value: string) {
  if (!value) return 'Não informada'
  return new Intl.DateTimeFormat('pt-BR').format(new Date(`${value}T00:00:00`))
}

export default function DriverPage() {
  const [portal, setPortal] = useState<DriverPortalData | null>(null)
  const [startForm, setStartForm] = useState<StartTripFormValues>(emptyStartForm)
  const [operation, setOperation] = useState<'fuel' | 'expense' | 'end' | null>(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const [startError, setStartError] = useState('')

  const loadPortal = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/driver', { cache: 'no-store' })
      const result = await response.json()

      if (!response.ok) throw new Error(result.error || 'Não foi possível carregar o portal.')

      const nextPortal = result.portal as DriverPortalData
      setPortal(nextPortal)

      if (!nextPortal.currentTrip) {
        const preferredVehicle =
          nextPortal.vehicles.find(
            (vehicle) => vehicle.principal && !unavailableVehicleStatuses.includes(vehicle.status),
          )
          ?? nextPortal.vehicles.find(
            (vehicle) => !unavailableVehicleStatuses.includes(vehicle.status),
          )
          ?? nextPortal.vehicles[0]
          ?? null
        setStartForm((current) => (
          current.vehicleId && nextPortal.vehicles.some((vehicle) => vehicle.id === current.vehicleId)
            ? current
            : startFormForVehicle(preferredVehicle)
        ))
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar o portal.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPortal()
  }, [loadPortal])

  const selectedVehicle = useMemo(() => {
    if (!portal) return null
    if (portal.currentTrip) return portal.currentTrip.vehicle
    return portal.vehicles.find((vehicle) => vehicle.id === startForm.vehicleId) ?? portal.vehicles[0] ?? null
  }, [portal, startForm.vehicleId])

  function selectVehicle(vehicleId: string) {
    const vehicle = portal?.vehicles.find((item) => item.id === vehicleId)
    setStartForm(startFormForVehicle(vehicle))
    setStartError('')
  }

  async function handleStartTrip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStarting(true)
    setStartError('')

    try {
      const response = await fetch('/api/driver/viagens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(startForm),
      })
      const result = await response.json()

      if (!response.ok) throw new Error(result.error || 'Não foi possível iniciar a viagem.')

      setStartForm(emptyStartForm)
      await loadPortal()
    } catch (startTripError) {
      setStartError(
        startTripError instanceof Error
          ? startTripError.message
          : 'Não foi possível iniciar a viagem.',
      )
    } finally {
      setStarting(false)
    }
  }

  if (loading && !portal) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Carregando portal do motorista...
        </CardContent>
      </Card>
    )
  }

  if (error || !portal) {
    return (
      <Card>
        <CardContent className="space-y-4 p-8 text-center">
          <p className="text-destructive">{error || 'Cadastro do motorista não encontrado.'}</p>
          <Button variant="outline" onClick={() => void loadPortal()}>
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    )
  }

  const currentTrip = portal.currentTrip

  return (
    <div className="space-y-4">
      {currentTrip ? (
        <Card className="overflow-hidden border-primary/30 shadow-sm">
          <div className="h-1 bg-primary" />
          <CardContent className="p-0">
            <div className="space-y-5 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-primary">
                    <Route className="size-4 shrink-0" />
                    <p className="text-xs font-semibold uppercase">Viagem em andamento</p>
                  </div>
                  <p className="mt-3 text-xl font-semibold leading-tight">
                    {currentTrip.origin}
                  </p>
                  <div className="my-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="h-px w-5 bg-border" />
                    <span>para</span>
                  </div>
                  <p className="text-xl font-semibold leading-tight">
                    {currentTrip.destination}
                  </p>
                </div>
                <StatusBadge type="raw" value="em_andamento" label="Em curso" />
              </div>

              <div className="grid grid-cols-2 gap-x-5 gap-y-4 border-y py-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Início</p>
                  <p className="mt-1 font-medium">{dateTime(currentTrip.startedAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Último KM registrado</p>
                  <p className="mt-1 font-medium">{number(currentTrip.latestRecordedKm)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Veículo</p>
                  <p className="mt-1 font-medium">
                    {currentTrip.vehicle.plate} · {currentTrip.vehicle.brand} {currentTrip.vehicle.model}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="gap-2" onClick={() => setOperation('fuel')}>
                  <Fuel className="size-4" />
                  Abastecimento
                </Button>
                <Button variant="outline" className="gap-2" onClick={() => setOperation('expense')}>
                  <DollarSign className="size-4" />
                  Despesa
                </Button>
              </div>

              <Button
                variant="destructive"
                className="w-full gap-2"
                onClick={() => setOperation('end')}
              >
                <CircleStop className="size-4" />
                Encerrar viagem
              </Button>
            </div>

            <div className="border-t bg-muted/20 px-5 py-4">
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                Registros recentes
              </p>
              {portal.recentRefuelings.length || portal.recentExpenses.length ? (
                <div className="divide-y">
                  {portal.recentRefuelings.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                      <span>
                        <span className="block font-medium">Abastecimento · {item.fuelType}</span>
                        <span className="text-xs text-muted-foreground">{dateTime(item.registeredAt)}</span>
                      </span>
                      <span className="text-right">
                        <span className="block">{number(item.liters, 1)} L</span>
                        <span className="text-xs text-muted-foreground">KM {number(item.registeredKm)}</span>
                      </span>
                    </div>
                  ))}
                  {portal.recentExpenses.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                      <span>
                        <span className="block font-medium">Despesa · {item.category}</span>
                        <span className="text-xs text-muted-foreground">{dateTime(item.registeredAt)}</span>
                      </span>
                      <span className="font-medium">{brl(item.value)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhum abastecimento ou despesa registrado nesta viagem.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-4 p-4">
            <div>
              <p className="font-semibold">Iniciar viagem</p>
              <p className="text-sm text-muted-foreground">
                Selecione um veículo vinculado e confirme os dados da rota.
              </p>
            </div>

            {portal.vehicles.length ? (
              <form className="space-y-4" onSubmit={handleStartTrip}>
                <div className="space-y-2">
                  <Label>Veículo</Label>
                  <Select value={startForm.vehicleId} onValueChange={selectVehicle}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {portal.vehicles.map((vehicle) => (
                        <SelectItem
                          key={vehicle.id}
                          value={vehicle.id}
                          disabled={unavailableVehicleStatuses.includes(vehicle.status)}
                        >
                          {vehicle.plate} · {vehicle.brand} {vehicle.model}
                          {vehicle.principal ? ' · Principal' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="trip-origin">Origem</Label>
                  <Input
                    id="trip-origin"
                    value={startForm.origin}
                    onChange={(event) => {
                      setStartForm((current) => ({ ...current, origin: event.target.value }))
                    }}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="trip-destination">Destino</Label>
                  <Input
                    id="trip-destination"
                    value={startForm.destination}
                    onChange={(event) => {
                      setStartForm((current) => ({ ...current, destination: event.target.value }))
                    }}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="trip-initial-km">KM inicial</Label>
                  <Input
                    id="trip-initial-km"
                    type="number"
                    min={selectedVehicle?.currentKm ?? 0}
                    step="0.01"
                    value={startForm.initialKm}
                    onChange={(event) => {
                      setStartForm((current) => ({ ...current, initialKm: event.target.value }))
                    }}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="trip-notes">Observação</Label>
                  <Textarea
                    id="trip-notes"
                    rows={3}
                    placeholder="Opcional"
                    value={startForm.notes}
                    onChange={(event) => {
                      setStartForm((current) => ({ ...current, notes: event.target.value }))
                    }}
                  />
                </div>

                {startError ? <p role="alert" className="text-sm text-destructive">{startError}</p> : null}

                <Button
                  type="submit"
                  className="w-full gap-2"
                  disabled={
                    starting
                    || !selectedVehicle
                    || unavailableVehicleStatuses.includes(selectedVehicle.status)
                  }
                >
                  <Play className="size-4" />
                  {starting ? 'Iniciando...' : 'Iniciar viagem'}
                </Button>
              </form>
            ) : (
              <div className="border-t py-6 text-sm text-muted-foreground">
                Nenhum veículo está vinculado ao seu cadastro. Procure o administrador.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <UserRound className="size-4 text-muted-foreground" />
              <p className="text-xs font-semibold uppercase text-muted-foreground">Motorista</p>
            </div>
            <StatusBadge type="document" value={portal.profile.licenseStatus} />
          </div>
          <div>
            <p className="font-semibold">{portal.profile.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {portal.profile.phone || 'Telefone não informado'}
            </p>
            <p className="text-sm text-muted-foreground">
              CPF: {portal.profile.cpf ? maskCpf(portal.profile.cpf) : 'Não informado'}
            </p>
            <p className="text-sm text-muted-foreground">
              CNH {portal.profile.licenseNumber || 'não informada'}
              {portal.profile.licenseCategory ? ` · Categoria ${portal.profile.licenseCategory}` : ''}
            </p>
            <p className="text-sm text-muted-foreground">
              Validade: {formatDateOnly(portal.profile.licenseDueDate)}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Bus className="size-4 text-muted-foreground" />
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                {currentTrip ? 'Veículo da viagem' : 'Veículo selecionado'}
              </p>
            </div>
            {selectedVehicle ? <StatusBadge type="vehicle" value={selectedVehicle.status} /> : null}
          </div>

          {selectedVehicle ? (
            <div>
              <p className="text-xl font-bold">{selectedVehicle.plate}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {selectedVehicle.brand} {selectedVehicle.model} · KM {number(selectedVehicle.currentKm)}
              </p>
              <div className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="mt-0.5 size-4 shrink-0" />
                <span>
                  {selectedVehicle.route
                    ? `${selectedVehicle.route.origin} → ${selectedVehicle.route.destination}`
                    : 'Sem rota fixa cadastrada'}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum veículo disponível.</p>
          )}
        </CardContent>
      </Card>

      {currentTrip ? (
        <>
          <RefuelingDialog
            open={operation === 'fuel'}
            onOpenChange={(open) => !open && setOperation(null)}
            trip={currentTrip}
            onSaved={loadPortal}
          />
          <ExpenseDialog
            open={operation === 'expense'}
            onOpenChange={(open) => !open && setOperation(null)}
            trip={currentTrip}
            onSaved={loadPortal}
          />
          <EndTripDialog
            open={operation === 'end'}
            onOpenChange={(open) => !open && setOperation(null)}
            trip={currentTrip}
            onSaved={loadPortal}
          />
        </>
      ) : null}
    </div>
  )
}
