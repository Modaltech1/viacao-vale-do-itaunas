'use client'

import Link from 'next/link'
import { Button, Card, CardContent } from '@prodexy/ui'
import { Shield, Smartphone, Wrench } from 'lucide-react'
import { brand } from '@/branding/brand'

const profiles = [
  {
    title: 'Administrador',
    description: 'Gestão completa da operação, frota, motoristas, custos, viagens e relatórios.',
    href: '/admin/dashboard',
    icon: Shield,
    primary: true,
  },
  {
    title: 'Motorista',
    description: 'Registro de viagem, abastecimento, despesas e encerramento de rota.',
    href: '/driver',
    icon: Smartphone,
  },
  {
    title: 'Mecânico',
    description: 'Execução de manutenções, pendências, veículos e serviços recorrentes.',
    href: '/mechanic',
    icon: Wrench,
  },
]

export default function HomePage() {
  return (
    <main className="min-h-screen bg-muted/30 p-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-6xl flex-col justify-center">
        <div className="mb-10 flex items-center gap-4">
          <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-card shadow-sm">
            <img src={brand.logoUrl} alt={brand.appName} className="h-full w-full object-cover" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{brand.appName}</h1>
            <p className="mt-1 text-base text-muted-foreground">Painel operacional Prodexy</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {profiles.map((profile) => {
            const Icon = profile.icon
            return (
              <Card key={profile.href} className="shadow-sm">
                <CardContent className="flex min-h-64 flex-col p-6">
                  <div className="mb-8 flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Icon className="size-5" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold">{profile.title}</h2>
                    <p className="mt-2 text-sm text-muted-foreground">{profile.description}</p>
                  </div>
                  <Button className="mt-6 w-full" variant={profile.primary ? 'default' : 'outline'} asChild>
                    <Link href={profile.href}>Entrar</Link>
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </main>
  )
}
