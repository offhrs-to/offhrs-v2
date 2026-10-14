import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function DisclaimerPage() {
  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <Link href="/" className="inline-block text-sm text-gray-500 hover:text-gray-700 mb-6">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Listing &amp; third-party disclaimer</h1>
        <p className="text-sm text-gray-500 mb-8">Summary for users. The legally binding terms are in our Terms &amp; policies.</p>

        <div className="prose prose-gray max-w-none space-y-5 text-gray-700 text-sm">
          <p>
            Offhrs helps you <strong>discover</strong> workshops and creative experiences. We display information that may
            come from vendors, public pages, or automated tools. It may be <strong>incomplete, inaccurate, or out of date</strong>
            — including dates, times, prices, locations, capacity, age or skill requirements, cancellation policies, and
            accessibility.
          </p>
          <p>
            <strong>Always confirm details with the vendor</strong> through their official booking link, website, or
            contact before you travel, pay, or rely on a listing.
          </p>
          <p>
            How you book depends on the listing. For vendor-hosted workshops and Marketplace goods, you pay securely in the
            Offhrs app or site (processed by Stripe), and Offhrs collects payment as the vendor&apos;s limited commercial
            agent as described in our Service Terms. For <strong>linked listings</strong> (workshops synced from a
            vendor&apos;s online store, or added by Offhrs with a link to the vendor&apos;s site), Offhrs{' '}
            <strong>does not process payment or complete the booking</strong>: you leave our site or app and book with the{' '}
            <strong>third-party vendor</strong>, and final price, availability, refunds, and all obligations are between you
            and that vendor. Their terms apply. In every case the vendor, not Offhrs, runs the workshop or sells and ships the
            goods.
          </p>
          <p>
            Inclusion of a workshop, product, or vendor is <strong>not an endorsement</strong>, recommendation, or guarantee
            of quality, safety, or legality. Except where we collect payment as described above, we are not the
            vendor&apos;s agent.
          </p>
          <p>
            Maps and pins are <strong>approximate</strong>. Images and descriptions may not reflect the current offering.
          </p>
          <p>
            Workshops can involve physical activities, tools, or materials. <strong>Participation is at your own risk.</strong>{' '}
            Offhrs does not supervise or run the events listed. Marketplace goods are made, sold, and shipped by
            independent vendors; Offhrs does not inspect them or take title to them.
          </p>
          <p>
            In-app features such as levels, points, or &quot;mastery&quot; labels are for <strong>engagement only</strong> unless we
            expressly state otherwise; they are not professional certifications.
          </p>
          <p>
            Emails or notifications you receive from us about bookings or links are <strong>informational</strong> and do
            not by themselves form a contract between you and Offhrs for attendance at a workshop.
          </p>
          <p className="text-gray-600 italic">
            This page is a plain-language summary. For warranties, liability limits, and your legal relationship with Offhrs,
            see our{' '}
            <Link href="/terms" className="text-[#5D755D] font-medium underline underline-offset-2">
              Terms &amp; policies
            </Link>
            . Nothing here changes those terms unless they explicitly say so.
          </p>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200 flex flex-wrap gap-3">
          <Link href="/terms">
            <Button variant="default" className="bg-[#5D755D] hover:bg-[#4a634a]">
              Terms &amp; policies
            </Button>
          </Link>
          <Link href="/workshops">
            <Button variant="outline">Workshops</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
