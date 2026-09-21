import { shopifyAdminGraphql } from '@/lib/shopify/admin-client'

const BULK_FEEDBACK = `
  mutation OffhrsBulkProductFeedback($feedbackInput: [ProductResourceFeedbackInput!]!) {
    bulkProductResourceFeedbackCreate(feedbackInput: $feedbackInput) {
      userErrors { field message }
      feedback { productId state }
    }
  }
`

export type ProductFeedbackState = 'ACCEPTED' | 'REQUIRES_ACTION'

/**
 * Publish product-level ResourceFeedback so merchants see validation in Admin.
 * Requires write_resource_feedbacks (and sales-channel / storefront configuration).
 */
export async function submitProductResourceFeedback(opts: {
  shop: string
  accessToken: string
  productGid: string
  productUpdatedAt: string
  state: ProductFeedbackState
  messages?: string[]
}): Promise<void> {
  const feedbackGeneratedAt = new Date().toISOString()
  const result = await shopifyAdminGraphql<{
    bulkProductResourceFeedbackCreate: {
      userErrors: Array<{ field?: string[] | null; message: string }>
    }
  }>({
    shop: opts.shop,
    accessToken: opts.accessToken,
    query: BULK_FEEDBACK,
    variables: {
      feedbackInput: [
        {
          productId: opts.productGid,
          state: opts.state,
          feedbackGeneratedAt,
          productUpdatedAt: opts.productUpdatedAt,
          messages: opts.messages ?? [],
        },
      ],
    },
  })

  const errors = result.bulkProductResourceFeedbackCreate?.userErrors ?? []
  if (errors.length > 0) {
    const msg = errors.map((e) => e.message).join('; ')
    // Stale feedback is common on rapid updates — ignore.
    if (!/later version|already accepted|outdated/i.test(msg)) {
      console.error('[shopify] resourceFeedback', msg)
    }
  }
}
