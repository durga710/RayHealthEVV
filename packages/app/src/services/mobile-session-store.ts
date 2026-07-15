import type { Request } from 'express'
import { MobileSessionRepository } from '@rayhealth/core'

export type MobileSessionStore = Pick<
  MobileSessionRepository,
  'create' | 'findActiveByJti' | 'revokeByJti'
>

export function getMobileSessionStore(req: Request): MobileSessionStore {
  return (
    (req.app.get('mobileSessionStore') as MobileSessionStore | undefined) ??
    new MobileSessionRepository(req.app.get('db'))
  )
}

