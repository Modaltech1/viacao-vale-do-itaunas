'use client'

import { useState } from 'react'
import {
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
} from '@prodexy/ui'
import { Bus, DollarSign, Fuel, Square, UserRound } from 'lucide-react'
import { FilterSelect } from '@/components/shared/filters'
import { StatusBadge } from '@/components/shared/status-badge'
import { brl, dateTime, maskCpf, number } from '@/lib/format'
import { drivers, refuelings, routes, travelExpenses, trips, vehicles } from '@/lib/mock-data'

export default function DriverPage() {
  const driver = drivers[0]
  const vehicle = vehicles.find((item) => item.id === driver.mainVehicleId)!
  const currentTrip = trips.find((item) => item.driverId === driver.id && item.status === 'em_andamento')
  const route = routes.find((item) => item.id === vehicle.routeId)
  const [modal, setModal] = useState<'fuel' | 'expense' | 'end' | null>(null)

  const tripRefuelings = currentTrip ? refuelings.filter((item) => item.tripId === currentTrip.id).slice(0, 2) : []
  const tripExpenses = currentTrip ? travelExpenses.filter((item) => item.tripId === currentTrip.id).slice(0, 2) : []

  return (
    <div className="space-y-4">
      {currentTrip ? (
        <Card className="border-primary/40 bg-primary/5 shadow-sm">
          <CardContent className="space-y-4 p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Viagem em andamento</p>
              <span className="rounded-full bg-sky-100 px-2 py-1 text-xs text-sky-700">Ao vivo</span>
            </div>

            <div>
              <p className="text-lg font-bold leading-tight">
                {currentTrip.origin} → {currentTrip.destination}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Início: {dateTime(currentTrip.startedAt)} - KM inicial: {number(currentTrip.initialKm)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setModal('fuel')}>
                <Fuel className="mr-1 size-4" />
                Abastecimento
              </Button>
              <Button variant="outline" onClick={() => setModal('expense')}>
                <DollarSign className="mr-1 size-4" />
                Despesa
              </Button>
            </div>

            <Button variant="destructive" className="w-full" onClick={() => setModal('end')}>
              <Square className="mr-1 size-4" />
              Encerrar viagem
            </Button>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Registros recentes
              </p>
              <div className="space-y-2">
                {tripRefuelings.map((item) => (
                  <div key={item.id} className="rounded-md border bg-card p-3 text-sm">
                    Abastecimento - {number(item.liters)} litros - KM {number(item.currentKm)}
                  </div>
                ))}
                {tripExpenses.map((item) => (
                  <div key={item.id} className="rounded-md border bg-card p-3 text-sm">
                    Despesa - {item.type} - {brl(item.value)}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-3 p-4">
            <p className="font-semibold">Iniciar viagem</p>
            <Field label="Origem" defaultValue={route?.origin} />
            <Field label="Destino" defaultValue={route?.destination} />
            <Field label="KM inicial" defaultValue={vehicle.currentKm} />
            <div className="space-y-2">
              <Label>Observação</Label>
              <Textarea placeholder="Opcional" />
            </div>
            <Button className="w-full">Iniciar</Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <UserRound className="size-4 text-muted-foreground" />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Motorista</p>
            </div>
            <StatusBadge type="document" value={driver.licenseStatus} />
          </div>
          <div>
            <p className="font-semibold">{driver.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">{driver.phone}</p>
            <p className="text-sm text-muted-foreground">CPF: {maskCpf(driver.cpf)}</p>
            <p className="text-sm text-muted-foreground">
              CNH {driver.licenseNumber} - venc. {new Date(driver.licenseDueDate).toLocaleDateString('pt-BR')}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Bus className="size-4 text-muted-foreground" />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Veículo atual</p>
            </div>
            <StatusBadge type="vehicle" value={vehicle.status} />
          </div>
          <div>
            <p className="text-xl font-bold">{vehicle.plate}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {vehicle.brand} {vehicle.model} - KM {number(vehicle.currentKm)}
            </p>
            <p className="text-sm text-muted-foreground">
              Rota fixa: {route?.origin} → {route?.destination}
            </p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={modal === 'fuel'} onOpenChange={(open: boolean) => !open && setModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar abastecimento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="KM atual" />
            <Field label="Litros abastecidos" />
            <div className="space-y-2">
              <Label>Combustível</Label>
              <FilterSelect>
                <option>Diesel S10</option>
                <option>Diesel S500</option>
                <option>Arla</option>
              </FilterSelect>
            </div>
            <div className="space-y-2">
              <Label>Observação</Label>
              <Textarea />
            </div>
            <p className="text-xs text-muted-foreground">
              Você não informa valor. O financeiro é registrado pelo administrador.
            </p>
            <Button className="w-full" onClick={() => setModal(null)}>
              Registrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={modal === 'expense'} onOpenChange={(open: boolean) => !open && setModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar despesa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <FilterSelect>
                <option>Pedágio</option>
                <option>Alimentação</option>
                <option>Hospedagem</option>
                <option>Descarga</option>
                <option>Outros</option>
              </FilterSelect>
            </div>
            <Field label="Valor" />
            <div className="space-y-2">
              <Label>Observação</Label>
              <Textarea />
            </div>
            <Button className="w-full" onClick={() => setModal(null)}>
              Registrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={modal === 'end'} onOpenChange={(open: boolean) => !open && setModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Encerrar viagem</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="KM final" />
            <div className="space-y-2">
              <Label>Observação final</Label>
              <Textarea />
            </div>
            <Button variant="destructive" className="w-full" onClick={() => setModal(null)}>
              Encerrar viagem
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Field({ label, defaultValue }: { label: string; defaultValue?: string | number }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input defaultValue={defaultValue} />
    </div>
  )
}
