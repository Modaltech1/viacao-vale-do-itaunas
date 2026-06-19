const KM_DECIMAL_STEP = 0.01

export function tripFinalKmMinimum(initialKm: number, latestRecordedKm: number) {
  const firstValidKm = Math.round((initialKm + KM_DECIMAL_STEP) * 100) / 100
  return Math.max(firstValidKm, latestRecordedKm)
}

export function tripFinalKmSuggestion(initialKm: number, latestRecordedKm: number) {
  return latestRecordedKm > initialKm ? latestRecordedKm.toString() : ''
}
