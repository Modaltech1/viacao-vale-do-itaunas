import {
  AlertTriangle,
  BarChart3,
  Bus,
  ClipboardList,
  DollarSign,
  Fuel,
  LayoutDashboard,
  Route,
  Users,
  Wrench,
} from 'lucide-react'

export type NavigationItem = {
  label: string
  href: string
  icon: typeof LayoutDashboard
  exact?: boolean
  activePrefixes?: string[]
}

const navigationCatalog = {
  dashboard: { label: 'Dashboard', icon: LayoutDashboard },
  vehicles: { label: 'Veículos', icon: Bus },
  drivers: { label: 'Motoristas', icon: Users },
  mechanics: { label: 'Mecânicos', icon: Wrench },
  trips: { label: 'Viagens', icon: Route },
  refuelings: { label: 'Abastecimentos', icon: Fuel },
  expenses: { label: 'Despesas', icon: DollarSign },
  maintenances: { label: 'Manutenções', icon: Wrench },
  services: { label: 'Serviços', icon: ClipboardList },
  pendings: { label: 'Pendências', icon: AlertTriangle },
  reports: { label: 'Relatórios', icon: BarChart3 },
} as const

function item(
  key: keyof typeof navigationCatalog,
  href: string,
  options?: Pick<NavigationItem, 'exact' | 'activePrefixes'>,
): NavigationItem {
  return { ...navigationCatalog[key], href, ...options }
}

export const adminNavigation: NavigationItem[] = [
  item('dashboard', '/admin/dashboard'),
  item('vehicles', '/admin/veiculos'),
  item('drivers', '/admin/motoristas'),
  item('mechanics', '/admin/mecanicos'),
  item('trips', '/admin/viagens'),
  item('refuelings', '/admin/abastecimentos'),
  item('expenses', '/admin/despesas'),
  item('maintenances', '/admin/manutencoes'),
  item('services', '/admin/servicos'),
  item('pendings', '/admin/pendencias'),
  item('reports', '/admin/relatorios'),
]

export const mechanicNavigation: NavigationItem[] = [
  item('maintenances', '/mechanic', {
    exact: true,
    activePrefixes: ['/mechanic/manutencoes'],
  }),
  item('pendings', '/mechanic/pendencias'),
  item('vehicles', '/mechanic/veiculos'),
  item('services', '/mechanic/servicos'),
]

export const driverNavigation: NavigationItem[] = []
