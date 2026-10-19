'use client'

import { AppProvider, BlockStack, Link, Text } from '@shopify/polaris'
import enTranslations from '@shopify/polaris/locales/en.json'
import '@shopify/polaris/build/esm/styles.css'
import { SHOPIFY_SYNC_COMMISSION_SENTENCE } from '@/lib/partner-pricing'

export function ShopifyChannelPolarisFrame({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider i18n={enTranslations}>
      <div style={{ minHeight: '100vh', background: '#f1f1f1', padding: '24px 16px' }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }} data-shopify-auth="polaris">
          <BlockStack gap="400">
            {children}
            <Text as="p" variant="bodyMd">
              <Link url="https://offhrs.app/terms" target="_blank">
                Terms
              </Link>
              {' and '}
              <Link url="https://offhrs.app/privacy" target="_blank">
                Privacy Policy
              </Link>
              {' open in a new window. '}
              {SHOPIFY_SYNC_COMMISSION_SENTENCE}
            </Text>
          </BlockStack>
        </div>
      </div>
    </AppProvider>
  )
}
