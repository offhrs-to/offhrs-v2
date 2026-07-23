import { ChevronDown } from 'lucide-react'
import { PARTNER_FAQ_SECTIONS, type PartnerFaqSection } from '@/lib/partner-faq'
import { cn } from '@/lib/utils'

type Props = {
  /** Defaults to the shared partner FAQ sections. */
  sections?: PartnerFaqSection[]
  /** Show section headings (dashboard). Landing can keep them for parity. */
  showSectionTitles?: boolean
  className?: string
}

export function PartnerFaqAccordion({
  sections = PARTNER_FAQ_SECTIONS,
  showSectionTitles = true,
  className = '',
}: Props) {
  return (
    <div className={cn('space-y-10', className)}>
      {sections.map((section) => (
        <section key={section.id} aria-labelledby={`faq-${section.id}`}>
          {showSectionTitles ? (
            <h3
              id={`faq-${section.id}`}
              className="mb-3 text-xs font-semibold uppercase tracking-wide text-primary"
            >
              {section.title}
            </h3>
          ) : null}
          <div className="space-y-2">
            {section.items.map((item) => (
              <details
                key={item.q}
                className="group overflow-hidden rounded-xl border border-partner-border bg-white"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3.5 text-sm font-medium text-foreground transition-colors hover:bg-partner-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
                  <span>{item.q}</span>
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <div className="px-4 pb-4 pt-0 text-sm leading-relaxed text-muted-foreground">
                  {item.a ?? <p>{item.aText}</p>}
                </div>
              </details>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
