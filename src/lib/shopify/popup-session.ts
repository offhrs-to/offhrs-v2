/** postMessage payload from AccountConnection popup → embedded Admin iframe. */
export const SHOPIFY_POPUP_CONNECTED_MESSAGE = 'offhrs-shopify-connected' as const

export type ShopifyPopupConnectedMessage = {
  type: typeof SHOPIFY_POPUP_CONNECTED_MESSAGE
  shop?: string
  error?: string | null
  /** Hand session into the Admin iframe (partitioned cookies otherwise block status). */
  access_token?: string
  refresh_token?: string
}
