'use client'

import { GettingStartedRail } from './GettingStartedRail'
import { PartnerNotificationsBell } from './PartnerNotificationsBell'
import type { ChecklistItemProps } from './GettingStartedChecklist'

/**
 * Header cluster: notifications (left), getting started + trial (right).
 * `flex-row-reverse` keeps the getting-started overlay from painting over the bell in DOM order.
 */
export function PartnerDashboardHeaderActions({
  items,
  allDone,
  trialDays,
}: {
  items: ChecklistItemProps[]
  allDone: boolean
  trialDays: number | null
}) {
  return (
    <div className="flex flex-row-reverse items-center gap-2 flex-shrink-0">
      <GettingStartedRail items={items} allDone={allDone} trialDays={trialDays} />
      <PartnerNotificationsBell />
    </div>
  )
}
