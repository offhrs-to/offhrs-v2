import { z } from 'zod'
import { SHOP_CATEGORY_ENUM } from '@/lib/shop/categories'
import { SHOP_DEFAULT_SHIP_BY_BUSINESS_DAYS } from '@/lib/shop/fees'

export const shopProductWriteSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().max(6000).optional().nullable(),
  category: z.enum(SHOP_CATEGORY_ENUM),
  price_cad: z.number().min(0).max(100000),
  quantity: z.number().int().min(0).max(100000),
  weight_g: z.number().int().min(1).max(30000),
  length_cm: z.number().min(0.1).max(200),
  width_cm: z.number().min(0.1).max(200),
  height_cm: z.number().min(0.1).max(200),
  fragile: z.boolean().optional().default(false),
  pickup_available: z.boolean().optional().default(false),
  made_to_order: z.boolean().optional().default(false),
  ship_by_business_days: z
    .number()
    .int()
    .min(1)
    .max(30)
    .optional()
    .default(SHOP_DEFAULT_SHIP_BY_BUSINESS_DAYS),
  buyer_remorse_returns: z.boolean().optional().default(false),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  image_urls: z.array(z.string().url()).max(8).optional().default([]),
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
  if (!data.shop_pickup_hours?.trim()) {
    ctx.addIssue({ code: 'custom', message: 'Pickup hours are required', path: ['shop_pickup_hours'] })
  }
})
