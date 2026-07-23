import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function PartnerEmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  compact = false,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  className?: string
  /** Tighter padding for nested panels (Overview lists, modals). */
  compact?: boolean
}) {
  return (
    <div className={cn(compact ? 'py-8' : 'py-14 sm:py-16', 'px-4 text-center', className)}>
      {Icon ? (
        <Icon
          className={cn(
            'mx-auto mb-3 text-muted-foreground/40',
            compact ? 'size-8' : 'size-10'
          )}
          aria-hidden
        />
      ) : null}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? (
        <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  )
}
