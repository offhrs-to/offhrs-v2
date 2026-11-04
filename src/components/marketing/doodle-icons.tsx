/** Simple hand-drawn style line icons for Partners marketing sections. */

import type { ReactNode } from 'react'

type IconProps = { className?: string }

function frame({ className = 'h-12 w-12', children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  )
}

export function IconCommunity(props: IconProps) {
  return frame({
    ...props,
    children: (
      <>
        <circle cx="22" cy="22" r="7" />
        <circle cx="42" cy="22" r="7" />
        <path d="M8 48c2.5-9 8-14 14-14s11.5 5 14 14" />
        <path d="M28 48c2.5-9 8-14 14-14s11.5 5 14 14" />
        <path d="M20 18c1.5-3 5-4 8-2" />
      </>
    ),
  })
}

export function IconCrossPollinate(props: IconProps) {
  return frame({
    ...props,
    children: (
      <>
        <path d="M18 46c0-10 8-16 14-16s14 6 14 16" />
        <circle cx="32" cy="22" r="8" />
        <path d="M12 20h10M42 20h10M17 12l6 6M47 12l-6 6" />
        <path d="M28 40h8M30 44h4" />
      </>
    ),
  })
}

export function IconDashboard(props: IconProps) {
  return frame({
    ...props,
    children: (
      <>
        <rect x="10" y="12" width="44" height="40" rx="6" />
        <path d="M10 24h44" />
        <path d="M20 34h8M20 42h14M36 34h12M36 42h8" />
        <circle cx="46" cy="18" r="2" fill="currentColor" stroke="none" />
      </>
    ),
  })
}

export function IconListWorkshop(props: IconProps) {
  return frame({
    ...props,
    children: (
      <>
        <rect x="14" y="10" width="36" height="44" rx="4" />
        <path d="M22 22h20M22 30h16M22 38h12" />
        <path d="M40 46l4 4 8-10" />
      </>
    ),
  })
}

export function IconDiscover(props: IconProps) {
  return frame({
    ...props,
    children: (
      <>
        <circle cx="28" cy="28" r="14" />
        <path d="M38 38l12 12" />
        <path d="M22 28h12M28 22v12" />
      </>
    ),
  })
}

export function IconBookPay(props: IconProps) {
  return frame({
    ...props,
    children: (
      <>
        <rect x="12" y="18" width="40" height="28" rx="4" />
        <path d="M12 28h40" />
        <circle cx="24" cy="38" r="3" />
        <path d="M34 36h12M34 41h8" />
      </>
    ),
  })
}

export function IconHost(props: IconProps) {
  return frame({
    ...props,
    children: (
      <>
        <circle cx="32" cy="18" r="8" />
        <path d="M16 50c3-12 10-18 16-18s13 6 16 18" />
        <path d="M44 28c6 2 10 8 10 14" />
        <path d="M20 34h6M38 34h6" />
      </>
    ),
  })
}

export function IconListArt(props: IconProps) {
  return frame({
    ...props,
    children: (
      <>
        <rect x="12" y="14" width="40" height="36" rx="3" />
        <path d="M12 40l10-10 8 8 8-12 14 14" />
        <circle cx="24" cy="24" r="4" />
      </>
    ),
  })
}

export function IconBrowse(props: IconProps) {
  return frame({
    ...props,
    children: (
      <>
        <rect x="10" y="16" width="18" height="24" rx="2" />
        <rect x="36" y="16" width="18" height="24" rx="2" />
        <path d="M14 44h10M40 44h10" />
        <path d="M28 28h8" />
      </>
    ),
  })
}

export function IconShipPickup(props: IconProps) {
  return frame({
    ...props,
    children: (
      <>
        <path d="M10 40h30l8-12h6v20H10z" />
        <circle cx="20" cy="50" r="4" />
        <circle cx="42" cy="50" r="4" />
        <path d="M14 28h16l4 12" />
      </>
    ),
  })
}

export function IconCollection(props: IconProps) {
  return frame({
    ...props,
    children: (
      <>
        <path d="M18 46V22l14-8 14 8v24" />
        <path d="M18 22l14 8 14-8M32 30v24" />
        <path d="M24 18c4-6 12-6 16 0" />
      </>
    ),
  })
}

export function IconShopifyInstall(props: IconProps) {
  return frame({
    ...props,
    children: (
      <>
        <path d="M18 26h28v28H18z" />
        <path d="M24 26V20a8 8 0 0 1 16 0v6" />
        <path d="M28 38h8M32 34v8" />
      </>
    ),
  })
}

export function IconShopifyConnect(props: IconProps) {
  return frame({
    ...props,
    children: (
      <>
        <circle cx="22" cy="32" r="10" />
        <circle cx="42" cy="32" r="10" />
        <path d="M28 32h8" />
        <path d="M20 28h4M40 28h4" />
      </>
    ),
  })
}

export function IconShopifyPublish(props: IconProps) {
  return frame({
    ...props,
    children: (
      <>
        <rect x="14" y="14" width="36" height="28" rx="3" />
        <path d="M14 22h36" />
        <path d="M24 34l8-8 8 8M32 26v16" />
      </>
    ),
  })
}

export function IconShopifyCheckout(props: IconProps) {
  return frame({
    ...props,
    children: (
      <>
        <path d="M16 20h6l4 20h22" />
        <circle cx="30" cy="46" r="3" />
        <circle cx="44" cy="46" r="3" />
        <path d="M28 28h20l-2 10H30z" />
        <path d="M34 18v8M38 20v6" />
      </>
    ),
  })
}

export function IconCheck(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={props.className ?? 'h-5 w-5'} aria-hidden>
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path
        d="M7.5 12.5l3 3 6-6.5"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
