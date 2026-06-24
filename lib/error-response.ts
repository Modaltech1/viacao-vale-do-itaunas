import 'server-only'

import { NextResponse } from 'next/server'
import {
  resolveUserFacingError,
  type UserFacingErrorRule,
} from '@/lib/error-messages'

export function apiErrorResponse(
  error: unknown,
  fallback: string,
  status = 400,
  rules: UserFacingErrorRule[] = [],
) {
  const response = resolveUserFacingError(error, fallback, status, rules)
  return NextResponse.json({ error: response.message }, { status: response.status })
}
