'use client'

import { Button, Card, CardContent, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@prodexy/ui'
import { PageHeader } from '@/components/layout/page-header'
import { MetricCard } from '@/components/shared/metric-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { number } from '@/lib/format'
import { services, vehicleServiceSchedules } from '@/lib/mock-data'
import { FilterInput, FilterSelect } from '@/components/shared/filters'

export default function ServicesPage() {
  const tires = services.filter((s) => s.category === 'Pneus').length
  const oil = services.filter((s) => s.category === 'Óleo').length
  return <><PageHeader title="Serviços" description="Catálogo central de manutenção. Óleo e pneus são categorias de serviço com periodicidade."><Button>Novo serviço</Button></PageHeader><div className="mb-5 grid gap-4 md:grid-cols-5"><MetricCard title="Serviços" value={services.length}/><MetricCard title="Por KM" value={services.filter(s=>s.periodicityType==='km').length}/><MetricCard title="Por tempo" value={services.filter(s=>s.periodicityType==='time').length}/><MetricCard title="Óleo" value={oil}/><MetricCard title="Pneus" value={tires}/></div><Card><CardContent className="space-y-4 p-4"><div className="grid gap-3 md:grid-cols-4"><FilterInput placeholder="Buscar serviço..."/><FilterSelect><option>Todas as categorias</option><option>Óleo</option><option>Pneus</option><option>Freios</option></FilterSelect><FilterSelect><option>Todas as periodicidades</option><option>KM</option><option>Tempo</option><option>Sem recorrência</option></FilterSelect><FilterSelect><option>Tipo sugerido</option><option>Preventiva</option><option>Corretiva</option></FilterSelect></div><Table><TableHeader><TableRow><TableHead>Serviço</TableHead><TableHead>Categoria</TableHead><TableHead>Tipo sugerido</TableHead><TableHead>Periodicidade</TableHead><TableHead>Veículos vinculados</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{services.map((service)=>{const linked=vehicleServiceSchedules.filter((item)=>item.serviceId===service.id).length; return <TableRow key={service.id}><TableCell className="font-semibold">{service.name}<br/><span className="text-xs text-muted-foreground">{service.description}</span></TableCell><TableCell>{service.category}</TableCell><TableCell>{service.suggestedMaintenanceType}</TableCell><TableCell>{service.periodicityType==='km'?`${number(service.periodicityKm??0)} km`:service.periodicityType==='time'?`${service.periodicityDays} dias`:'Sem recorrência'}</TableCell><TableCell>{linked}</TableCell><TableCell><StatusBadge type="raw" value={service.status} label={service.status==='ativo'?'Ativo':'Inativo'}/></TableCell></TableRow>})}</TableBody></Table></CardContent></Card></>
}
