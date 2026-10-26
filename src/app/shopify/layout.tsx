import { createElement } from 'react'

/** Nested layout — App Bridge is injected by root layout when x-offhrs-shopify-admin is set. */
export default function ShopifyAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {/* Replaces Partner Dashboard static menus. Home stays the app name in the sidebar. */}
      {createElement(
        's-app-nav',
        null,
        createElement('s-link', { href: '/shopify', rel: 'home' }, 'Home')
      )}
      {children}
    </>
  )
}
