import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <Link href="/" className="inline-block text-sm text-gray-500 hover:text-gray-700 mb-6">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: March 23, 2026</p>
        <p className="text-xs text-gray-500 mb-6 -mt-4">
          These Terms are intended to reflect how the Service works. You may wish to have them reviewed by a lawyer in your
          jurisdiction; consumer protection laws may limit certain exclusions or caps where you live.
        </p>

        <div className="prose prose-gray max-w-none space-y-6 text-gray-700">
          <section>
            <h2 className="text-lg font-semibold text-gray-900">1. Acceptance of Terms</h2>
            <p>
              By accessing or using Offhrs (&quot;we,&quot; &quot;us,&quot; &quot;our&quot;), including our website at offhrs.app
              and related services (the &quot;Service&quot;), you agree to be bound by these Terms of Service (&quot;Terms&quot;). If
              you do not agree, do not use the Service. We may update these Terms from time to time; continued use
              after changes constitutes acceptance of the revised Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">2. Description of the Service</h2>
            <p>
              Offhrs is a discovery and listing platform for workshops and creative experiences. We help you find
              workshops, view details, and get directed to third-party vendor websites where you can book and pay.{' '}
              <strong>We do not process payments or complete bookings on our platform.</strong> All bookings, payments,
              cancellations, and fulfillment are between you and the respective vendor. We are not a party to any
              transaction between you and a vendor.
            </p>
            <p>
              We are <strong>not the vendor&apos;s agent</strong> and cannot accept bookings, set prices, or bind vendors on
              your behalf. Inclusion of any listing or vendor <strong>does not constitute an endorsement</strong>,
              recommendation, or guarantee of quality, safety, suitability, or legality.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">3. Eligibility</h2>
            <p>
              You must be at least 18 years old (or the age of majority in your jurisdiction) and able to form a binding
              contract to use the Service. By using the Service, you represent that you meet these requirements.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">4. Accounts and Registration</h2>
            <p>
              If you create an account, you agree to provide accurate and current information and to keep it updated.
              You are responsible for maintaining the confidentiality of your account credentials and for all activity
              under your account. Notify us promptly of any unauthorized use.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">5. Acceptable Use</h2>
            <p>
              You agree to use the Service only for lawful purposes and in accordance with these Terms. You will not:
              (a) use the Service in any way that violates applicable laws; (b) impersonate any person or entity or
              misrepresent your affiliation; (c) scrape, harvest, or use automated means to collect data from the
              Service without our permission; (d) interfere with or disrupt the Service or servers or networks connected
              to it; (e) transmit any malware or harmful code; or (f) use the Service for any fraudulent or abusive
              purpose. We may suspend or terminate access for violation of these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">6. Third-Party Vendors, Listings, and Links</h2>
            <p>
              The Service contains listings and links to third-party vendor websites. We do not operate, control, or
              endorse those sites. Your use of vendor sites and any bookings, payments, or disputes with vendors are
              solely between you and the vendor. We are not responsible for vendor conduct, pricing, availability,
              quality of workshops, or any terms or policies of third-party sites. You use external links at your own
              risk.
            </p>
            <p>
              <strong>Listing information may be wrong or stale.</strong> Details shown on the Service (including dates,
              times, prices, locations, maps and pins, images, descriptions, capacity, age or skill requirements,
              cancellation policies, and promotions) may be incomplete, inaccurate, or outdated. Such information may
              come from vendors, public sources, or automated means.{' '}
              <strong>
                You should verify all material details with the vendor through their official booking channel or contact
              </strong>{' '}
              before you rely on a listing, travel, or pay.
            </p>
            <p>
              <strong>Pricing and availability.</strong> Displayed prices or availability are not offers from Offhrs and
              may differ from what the vendor charges at checkout. Final price, taxes, fees, and whether a spot is
              available are determined only by the vendor. Promotions or discounts shown on the Service may not apply on
              the vendor&apos;s site.
            </p>
            <p>
              <strong>Maps and media.</strong> Map locations and pins are approximate unless we state otherwise. Images and
              descriptions may not reflect the current offering or may be supplied by third parties; we do not warrant
              that they are current, complete, or correctly licensed for your reuse.
            </p>
            <p>
              <strong>Participation and safety.</strong> Workshops may involve physical activity, tools, materials, or
              other risks. You participate in any real-world activity at your own risk. Offhrs does not supervise,
              instruct, or control how vendors run their events.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">7. Intellectual Property</h2>
            <p>
              The Service and its content (including text, graphics, logos, and design) are owned or licensed by us and
              protected by intellectual property laws. You may not copy, modify, distribute, or create derivative works
              from our content without our prior written permission, except for limited personal, non-commercial use.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">8. Disclaimers</h2>
            <p>
              THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR
              IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
              PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR
              FREE OF HARMFUL COMPONENTS. WE DO NOT GUARANTEE THE ACCURACY, COMPLETENESS, OR RELIABILITY OF ANY LISTINGS
              OR VENDOR INFORMATION. ANY RELIANCE ON SUCH INFORMATION IS AT YOUR OWN RISK.
            </p>
            <p>
              <strong>Gamification.</strong> Features such as experience points, levels, labels (for example &quot;Novice&quot; or
              &quot;Master&quot;), or similar in-app progress indicators are provided for engagement and orientation only
              unless we expressly state otherwise in writing. They do not constitute a professional certification,
              license, or credential unless we specifically offer an accredited program and say so.
            </p>
            <p>
              <strong>Communications.</strong> Emails, push notifications, or in-app messages we send about workshops,
              links, or redirects are informational. They do not by themselves create a contract between you and Offhrs
              for attendance, performance, or delivery of any workshop; the vendor&apos;s terms govern your booking.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">9. Limitation of Liability</h2>
            <p>
              <strong>Consumer rights.</strong> Nothing in these Terms is intended to exclude or limit rights that
              applicable law (including consumer protection law in Ontario, elsewhere in Canada, or your country of
              residence) does not allow to be excluded or limited. Where such laws apply to you, our liability will be
              limited to the <strong>maximum extent permitted by those laws</strong>.
            </p>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, OFFHRS AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AND
              AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES
              (INCLUDING LOSS OF PROFITS, DATA, OR GOODWILL) ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE, EVEN
              IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. OUR TOTAL LIABILITY FOR ANY CLAIMS ARISING OUT OF OR
              RELATED TO THESE TERMS OR THE SERVICE SHALL NOT EXCEED THE GREATER OF ONE HUNDRED CANADIAN DOLLARS (CAD
              $100) OR THE AMOUNT YOU PAID US, IF ANY, IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM. SOME
              JURISDICTIONS DO NOT ALLOW CERTAIN LIMITATIONS; IN SUCH CASES, OUR LIABILITY WILL BE LIMITED TO THE
              MAXIMUM EXTENT PERMITTED BY LAW.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">10. Indemnification</h2>
            <p>
              You agree to indemnify, defend, and hold harmless Offhrs and its officers, directors, employees, and
              agents from and against any claims, damages, losses, liabilities, costs, and expenses (including reasonable
              legal fees) arising out of or related to: (a) your use of the Service; (b) your violation of these Terms
              or any law; (c) your violation of any third-party rights; or (d) any dispute between you and a vendor. We
              reserve the right to assume the exclusive defense and control of any matter subject to indemnification by
              you.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">11. Termination</h2>
            <p>
              We may suspend or terminate your access to the Service, with or without notice, for any reason, including
              breach of these Terms. You may stop using the Service at any time. Provisions that by their nature should
              survive (including intellectual property, disclaimers, limitation of liability, indemnification, and this
              Section 11) will survive termination.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">12. Changes to the Service and Terms</h2>
            <p>
              We may modify the Service or these Terms at any time. We will indicate the &quot;Last updated&quot; date at the
              top of the Terms. Material changes may be communicated by posting on the Service or by email where
              appropriate. Your continued use after the effective date of changes constitutes acceptance. If you do not
              agree, you must stop using the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900">13. General</h2>
            <p>
              <strong>Entire agreement.</strong> These Terms, together with our Privacy Policy, our Listing &amp;
              third-party disclaimer page (if any), and any other policies we reference, constitute the entire agreement
              between you and Offhrs regarding the Service. If there is a conflict between a summary page and these
              Terms, these Terms control unless we expressly state otherwise in writing.
            </p>
            <p>
              <strong>Severability.</strong> If any provision is held invalid or unenforceable, the remaining provisions
              remain in effect.
            </p>
            <p>
              <strong>Waiver.</strong> Our failure to enforce any right or provision does not waive that right or
              provision.
            </p>
            <p>
              <strong>Governing law and venue.</strong> These Terms are governed by the laws of the Province of
              Ontario and the federal laws of Canada applicable therein, without regard to conflict of law principles.
              Any dispute shall be resolved in the courts located in Toronto, Ontario. If you are outside Canada, you
              may also have rights under your local law.
            </p>
            <p>
              <strong>Contact.</strong> For questions about these Terms, contact us at the email address provided on
              our website or in the Offhrs app (e.g. offhrs.to@gmail.com).
            </p>
          </section>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <Link href="/">
            <Button variant="outline">Back to home</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
