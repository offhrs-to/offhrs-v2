import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { vendorHasNativePartnerPlan } from '@/lib/partner-access'
import { vendorHasMarketplaceAccess } from '@/lib/shop/access'
import { DashboardShell } from './DashboardShell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let hasNativePlan = false
  let hasMarketplaceAccess = false

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const admin = createAdminClient()
    if (user && admin) {
      const { data: vendor } = await admin
        .from('vendor_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (vendor?.id) {
        hasNativePlan = await vendorHasNativePartnerPlan(admin, vendor.id)
        hasMarketplaceAccess = await vendorHasMarketplaceAccess(admin, vendor.id)
      }
    }
  } catch {
    hasNativePlan = false
    hasMarketplaceAccess = false
  }

  return (
    <DashboardShell hasNativePlan={hasNativePlan} hasMarketplaceAccess={hasMarketplaceAccess}>
      {children}
    </DashboardShell>
  )
}
