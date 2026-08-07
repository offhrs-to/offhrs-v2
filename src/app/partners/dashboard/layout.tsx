import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { vendorHasNativePartnerPlan } from '@/lib/partner-access'
import { DashboardShell } from './DashboardShell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let hasNativePlan = false

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
      }
    }
  } catch {
    hasNativePlan = false
  }

  return <DashboardShell hasNativePlan={hasNativePlan}>{children}</DashboardShell>
}
