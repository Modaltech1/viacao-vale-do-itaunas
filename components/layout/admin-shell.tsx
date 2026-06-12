'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LogOut,
  Menu,
} from 'lucide-react'
import { Button, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, cn } from '@prodexy/ui'
import { brand } from '@/branding/brand'
import {
  adminNavigation,
  driverNavigation,
  mechanicNavigation,
  type NavigationItem,
} from '@/components/layout/navigation-items'
import { supabase } from '@/lib/supabase-client'

function BrandBlock({ compact = false, subtitle }: { compact?: boolean; subtitle: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn('flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary text-primary-foreground', compact ? 'size-9' : 'size-11')}>
        <img src={brand.logoUrl} alt={brand.appName} className="h-full w-full object-cover" />
      </div>
      <div className="min-w-0">
        <p className={cn('truncate font-semibold leading-tight', compact ? 'text-sm' : 'text-lg')}>{compact ? brand.shortName : brand.appName}</p>
        <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  )
}

function NavItems({
  pathname,
  items,
  isGlobalAdmin,
}: {
  pathname: string
  items: NavigationItem[]
  isGlobalAdmin?: boolean
}) {
  const visibleItems = items.filter((item) => !item.globalOnly || isGlobalAdmin)

  return (
    <ul className="flex flex-1 flex-col gap-y-2">
      {visibleItems.map((item) => {
        const Icon = item.icon
        const active =
          pathname === item.href
          || (!item.exact && pathname.startsWith(`${item.href}/`))
          || item.activePrefixes?.some(
            (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
          )

        return (
          <li key={item.href}>
            <Link
              href={item.href}
              className={cn(
                'group flex w-full gap-x-3 rounded-lg p-3 text-sm font-medium leading-6 transition-colors',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="size-5 shrink-0" />
              {item.label}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function AppShell({
  children,
  items,
  mainClassName = 'p-4 lg:p-8',
  subtitle,
  isGlobalAdmin,
}: {
  children: React.ReactNode
  items: NavigationItem[]
  mainClassName?: string
  subtitle: string
  isGlobalAdmin?: boolean
}) {
  const pathname = usePathname() ?? ''

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b bg-card px-4">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="size-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex w-72 flex-col p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Navegação</SheetTitle>
              <SheetDescription>Navegação principal da aplicação.</SheetDescription>
            </SheetHeader>

            <div className="flex h-16 shrink-0 items-center border-b px-6">
              <BrandBlock subtitle={subtitle} />
            </div>

            <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <NavItems
                pathname={pathname}
                items={items}
                isGlobalAdmin={isGlobalAdmin}
              />

              <Button
                variant="ghost"
                className="mt-4 justify-start gap-x-3 rounded-lg p-3 text-sm font-medium leading-6 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={handleLogout}
              >
                <LogOut className="size-5 shrink-0" />
                Sair
              </Button>
            </nav>
          </SheetContent>
        </Sheet>

        <BrandBlock compact subtitle={subtitle} />
      </header>

      <main className={mainClassName}>{children}</main>
    </div>
  )
}

export function AdminShell({
  children,
  isGlobalAdmin,
}: {
  children: React.ReactNode
  isGlobalAdmin: boolean
}) {
  return (
    <AppShell
      items={adminNavigation}
      subtitle="Painel administrativo"
      isGlobalAdmin={isGlobalAdmin}
    >
      {children}
    </AppShell>
  )
}

export function MechanicShell({ children }: { children: React.ReactNode }) {
  return <AppShell items={mechanicNavigation} subtitle="Painel do mecânico">{children}</AppShell>
}

export function DriverShell({ children }: { children: React.ReactNode }) {
  return <AppShell items={driverNavigation} mainClassName="mx-auto max-w-md p-4" subtitle="Portal do motorista">{children}</AppShell>
}
