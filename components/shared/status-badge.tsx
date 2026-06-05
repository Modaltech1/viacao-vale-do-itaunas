'use client'

import { Badge } from '@prodexy/ui'
import { badgeClassByStatus, documentStatusLabel, maintenanceStatusLabel, severityLabel, tripStatusLabel, vehicleStatusLabel } from '@/lib/status'
import type { DocumentStatus, MaintenanceStatus, Severity, TripStatus, VehicleStatus } from '@/types/fleet'

type Props =
  | { type: 'vehicle'; value: VehicleStatus }
  | { type: 'document'; value: DocumentStatus }
  | { type: 'trip'; value: TripStatus }
  | { type: 'maintenance'; value: MaintenanceStatus }
  | { type: 'severity'; value: Severity }
  | { type?: 'raw'; value: string; label?: string }

export function StatusBadge(props: Props) {
  const label = props.type === 'vehicle'
    ? vehicleStatusLabel[props.value]
    : props.type === 'document'
      ? documentStatusLabel[props.value]
      : props.type === 'trip'
        ? tripStatusLabel[props.value]
        : props.type === 'maintenance'
          ? maintenanceStatusLabel[props.value]
          : props.type === 'severity'
            ? severityLabel[props.value]
            : (props.label ?? props.value)

  return (
    <Badge variant="outline" className={badgeClassByStatus(props.value)}>
      {label}
    </Badge>
  )
}
