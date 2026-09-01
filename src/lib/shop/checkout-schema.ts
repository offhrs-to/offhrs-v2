import { z } from 'zod'

const caPostalSchema = z
  .string()
  .trim()
  .regex(/^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ ]?\d[ABCEGHJ-NPRSTV-Z]\d$/i, {
    message: 'Enter a valid Canadian postal code',
  })

export const shopShipAddressSchema = z.object({
  name: z.string().min(2).max(120),
  line1: z.string().min(3).max(200),
  line2: z.string().max(200).optional().nullable(),
  city: z.string().min(2).max(100),
  province: z.string().min(2).max(40),
  postal_code: caPostalSchema,
  country: z.literal('CA').optional().default('CA'),
})

export const shopRatesBodySchema = z
  .object({
    product_id: z.string().uuid(),
    fulfillment_type: z.enum(['ship', 'pickup']).default('ship'),
    postal_code: caPostalSchema.optional(),
  })
  .strict()

export const shopCheckoutBodySchema = z
  .object({
    product_id: z.string().uuid(),
    fulfillment_type: z.enum(['ship', 'pickup']),
    buyer_name: z.string().min(2).max(120),
    buyer_email: z.string().email(),
    ship_address: shopShipAddressSchema.optional(),
    shippo_rate_id: z.string().min(1).optional(),
    shippo_shipment_id: z.string().min(1).optional(),
    shippo_rate_amount_cad: z.number().min(0).optional(),
  })
  .strict()

export const shopConfirmBodySchema = z
  .object({
    paymentIntentId: z.string().min(1),
  })
  .strict()
