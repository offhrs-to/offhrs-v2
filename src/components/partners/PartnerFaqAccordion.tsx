import { ChevronDown } from 'lucide-react'
import { PARTNER_FAQ_SECTIONS, type PartnerFaqSection } from '@/lib/partner-faq'

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
    <div className={`space-y-10 ${className}`.trim()}>
      {sections.map((section) => (
        <section key={section.id} aria-labelledby={`faq-${section.id}`}>
          {showSectionTitles ? (
            <h3
              id={`faq-${section.id}`}
              className="text-xs font-semibold uppercase tracking-wide text-[#5D755D] mb-3"
            >
              {section.title}
            </h3>
          ) : null}
          <div className="space-y-2">
            {section.items.map((item) => (
              <details
                key={item.q}
                className="group bg-white border border-[#E8E4DE] rounded-xl overflow-hidden"
              >
                <summary className="flex items-center justify-between gap-3 cursor-pointer list-none px-4 py-3.5 text-sm font-medium text-[#1a1a1a] hover:bg-[#FAFAF8] transition-colors [&::-webkit-details-marker]:hidden">
                  <span>{item.q}</span>
                  <ChevronDown className="w-4 h-4 flex-shrink-0 text-[#888] transition-transform group-open:rotate-180" />
                </summary>
                <div className="px-4 pb-4 pt-0 text-sm text-[#555] leading-relaxed">
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
