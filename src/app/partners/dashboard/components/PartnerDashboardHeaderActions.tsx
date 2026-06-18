'use client'

import { useState } from 'react'
import { GettingStartedRail } from './GettingStartedRail'
import { PartnerNotificationsBell } from './PartnerNotificationsBell'
import type { ChecklistItemProps } from './GettingStartedChecklist'

/**
 * Header cluster: notifications (left), getting started + trial (right).
 * When the getting-started rail is open it raises its stacking context so the dimmed overlay
 * covers the notifications control; the bell lowers its z-index while the rail is open.
 */
export function PartnerDashboardHeaderActions({
  items,
  allDone,
  trialDays,
  openGettingStartedInitially = false,
}: {
  items: ChecklistItemProps[]
  allDone: boolean
  trialDays: number | null
  openGettingStartedInitially?: boolean
}) {
  const [gettingStartedOpen, setGettingStartedOpen] = useState(openGettingStartedInitially)

  return (
    <div className="flex flex-row-reverse items-center gap-2 flex-shrink-0 isolate">
      <GettingStartedRail
        items={items}
        allDone={allDone}
        trialDays={trialDays}
        initialOpen={openGettingStartedInitially}
        onOpenChange={setGettingStartedOpen}
      />
      <PartnerNotificationsBell gettingStartedOpen={gettingStartedOpen} />
    </div>
  )
}
