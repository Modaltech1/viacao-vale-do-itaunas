import { KM_DECIMAL_STEP, kmInputValue } from '@/lib/km'

export function tripFinalKmMinimum(initialKm: number, latestRecordedKm: number) {
  const firstValidKm = Math.round((initialKm + KM_DECIMAL_STEP) * 10) / 10
  return Math.max(firstValidKm, latestRecordedKm)
}

export function tripFinalKmSuggestion(initialKm: number, latestRecordedKm: number) {
  return latestRecordedKm > initialKm ? kmInputValue(latestRecordedKm) : ''
}
