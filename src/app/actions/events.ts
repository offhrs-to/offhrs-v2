'use server'

import { requireAdminSession } from '@/lib/admin-auth-server'
import {
  deleteAdminEvent,
  insertAdminEvents,
  updateAdminEvent,
  type AdminEventInput,
} from '@/lib/admin-events'

export type { AdminEventInput }

export async function insertEvents(rows: AdminEventInput[]) {
  await requireAdminSession()
  return insertAdminEvents(rows)
}

export async function deleteEvent(id: string) {
  await requireAdminSession()
  return deleteAdminEvent(id)
}

export async function updateEvent(id: string, data: AdminEventInput) {
  await requireAdminSession()
  return updateAdminEvent(id, data)
}
