import { z } from 'zod'

export const bookBodySchema = z.object({
  event_id: z.coerce.number().int().positive(),
  event_title: z.string().max(500).optional(),
})

export const confirmAttendanceTokenSchema = z.string().min(1).max(100)

export const scrapeBodySchema = z.object({
  url: z.string().url().max(2048),
})

export const adminLoginBodySchema = z.object({
  username: z.string().max(256),
  password: z.string().max(512),
})

export type BookBody = z.infer<typeof bookBodySchema>
export type ScrapeBody = z.infer<typeof scrapeBodySchema>
export type AdminLoginBody = z.infer<typeof adminLoginBodySchema>
