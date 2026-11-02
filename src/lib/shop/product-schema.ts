import { z } from 'zod'
import { SHOP_CATEGORY_ENUM } from '@/lib/shop/categories'
import { SHOP_DEFAULT_SHIP_BY_BUSINESS_DAYS } from '@/lib/shop/fees'
import {
  sanitizeWorkshopHtml,
  workshopRichTextPlainLength,
  WORKSHOP_RICH_TEXT_MAX_PLAIN_LENGTH,
} from '@/lib/workshop-rich-text'

/** HTML number inputs / Postgres numerics may arrive as strings. */
const cadAmount = z.coerce.number().min(0).max(100000)
const nonNegInt = z.coerce.number().int().min(0).max(100000)
const weightGrams = z.preprocess((value) => {
  if (value === '' || value == null) return value
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? Math.round(n) : value
}, z.number().int().min(1, 'Weight must be at least 1 g').max(30000))
const dimensionCm = z.coerce
  .number()
  .min(0.1, 'Each dimension must be at least 0.1 cm')
  .max(200)
const shipByDays = z.preprocess((value) => {
  if (value === '' || value == null) return SHOP_DEFAULT_SHIP_BY_BUSINESS_DAYS
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n < 1) return SHOP_DEFAULT_SHIP_BY_BUSINESS_DAYS
  return Math.round(n)
}, z.number().int().min(1).max(30))

export const shopProductWriteSchema = z.object({
  title: z.string().trim().min(2, 'Title must be at least 2 characters').max(120),
  description: z
    .string()
    .max(6000)
    .optional()
    .nullable()
    .transform((value, ctx) => {
      if (value == null || value === '') return null
      try {
        const sanitized = sanitizeWorkshopHtml(value)
        if (!sanitized) return null
        if (workshopRichTextPlainLength(sanitized) > WORKSHOP_RICH_TEXT_MAX_PLAIN_LENGTH) {
          ctx.addIssue({
            code: 'custom',
            message: `Description must be ${WORKSHOP_RICH_TEXT_MAX_PLAIN_LENGTH} characters or less`,
          })
          return z.NEVER
        }
        return sanitized
      } catch {
        ctx.addIssue({ code: 'custom', message: 'Invalid description formatting' })
        return z.NEVER
      }
    }),
  category: z.enum(SHOP_CATEGORY_ENUM),
  price_cad: cadAmount,
  quantity: nonNegInt,
  weight_g: weightGrams,
  length_cm: dimensionCm,
  width_cm: dimensionCm,
  height_cm: dimensionCm,
  fragile: z.boolean().optional().default(false),
  pickup_available: z.boolean().optional().default(false),
  made_to_order: z.boolean().optional().default(false),
  ship_by_business_days: shipByDays.optional().default(SHOP_DEFAULT_SHIP_BY_BUSINESS_DAYS),
  buyer_remorse_returns: z.boolean().optional().default(false),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  image_urls: z
    .array(z.string().url('Each image must be a valid URL'))
    .max(8)
    .optional()
    .default([]),
})

export type ShopProductWrite = z.infer<typeof shopProductWriteSchema>

export const shopShippingSettingsSchema = z.object({
  ship_from_name: z.string().min(2).max(120),
  ship_from_line1: z.string().min(3).max(200),
  ship_from_line2: z.string().max(200).optional().nullable(),
  ship_from_city: z.string().min(2).max(100),
  ship_from_province: z.string().min(2).max(40),
  ship_from_postal_code: z
    .string()
    .trim()
    .regex(/^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ ]?\d[ABCEGHJ-NPRSTV-Z]\d$/i, {
      message: 'Enter a valid Canadian postal code',
    }),
  ship_from_phone: z.string().max(30).optional().nullable(),
  shipping_handling_fee_cad: z.number().min(0).max(100),
  shop_pickup_enabled: z.boolean(),
  shop_pickup_line1: z.string().max(200).optional().nullable(),
  shop_pickup_line2: z.string().max(200).optional().nullable(),
  shop_pickup_city: z.string().max(100).optional().nullable(),
  shop_pickup_province: z.string().max(40).optional().nullable(),
  shop_pickup_postal_code: z
    .string()
    .trim()
    .regex(/^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ ]?\d[ABCEGHJ-NPRSTV-Z]\d$/i, {
      message: 'Enter a valid Canadian postal code',
    })
    .optional()
    .nullable()
    .or(z.literal('')),
  shop_pickup_hours: z.string().max(500).optional().nullable(),
  shop_pickup_arrange_by_contact: z.boolean().optional(),
  shop_return_policy: z.string().max(4000).optional().nullable(),
  canada_ship_attested: z.boolean(),
  shop_status: z.enum(['off', 'draft', 'live', 'paused']).optional(),
}).superRefine((data, ctx) => {
  if (!data.shop_pickup_enabled) return
  if (!data.shop_pickup_line1?.trim()) {
    ctx.addIssue({ code: 'custom', message: 'Pickup address line 1 is required', path: ['shop_pickup_line1'] })
  }
  if (!data.shop_pickup_city?.trim()) {
    ctx.addIssue({ code: 'custom', message: 'Pickup city is required', path: ['shop_pickup_city'] })
  }
  if (!data.shop_pickup_province?.trim()) {
    ctx.addIssue({ code: 'custom', message: 'Pickup province is required', path: ['shop_pickup_province'] })
  }
  const postal = data.shop_pickup_postal_code?.trim() ?? ''
  if (!postal) {
    ctx.addIssue({ code: 'custom', message: 'Pickup postal code is required', path: ['shop_pickup_postal_code'] })
  }
  const arrange = data.shop_pickup_arrange_by_contact === true
  if (!arrange && !data.shop_pickup_hours?.trim()) {
    ctx.addIssue({
      code: 'custom',
      message: 'Add pickup hours, or check “Contact seller to arrange pickup”',
      path: ['shop_pickup_hours'],
    })
  }
})
