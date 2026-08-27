import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPageLayout } from '@/components/legal-page-layout'
import { policyHref } from '@/lib/policy-pages'

export const metadata: Metadata = {
  title: 'Content Policy | offhrs',
  description:
    'Rules for listings, reviews, messages, profiles, and other user-generated content on the offhrs Platform.',
  alternates: { canonical: 'https://offhrs.app/terms/content-policy' },
}

export default function ContentPolicyPage() {
  return (
    <LegalPageLayout slug="content-policy">
      <section>
        <h2>1. Introduction and scope</h2>
        <p>
          offhrs aims to maintain a respectful, trustworthy community for discovering and booking creative
          workshops. This Content Policy describes what content and behaviour are allowed or prohibited on
          the offhrs Platform. It applies to all user-generated material, including workshop listings (text,
          photos, and video), reviews and ratings, in-app messages, profile details, and any other materials
          shared by Consumers or Vendors.
        </p>
        <p>
          By using offhrs.app, partners.offhrs.app, or our mobile apps, you agree to follow this Content
          Policy together with our{' '}
          <Link href={policyHref('terms-of-use')}>Terms of Use</Link> and{' '}
          <Link href={policyHref('privacy-policy')}>Privacy Policy</Link>. Violations may lead to content
          removal, account suspension, or account termination.
        </p>
      </section>

      <section>
        <h2>2. General principles</h2>
        <p>
          We expect everyone on offhrs to act with honesty, courtesy, and professionalism. Content should
          relate to the purpose of the Platform: connecting workshop attendees with independent creative
          studios and instructors.
        </p>
        <ul>
          <li>
            <strong>Authenticity.</strong> Content must be truthful and accurately reflect the workshops
            offered or attended. Do not impersonate others or misstate your affiliation with a studio or
            brand.
          </li>
          <li>
            <strong>Respect.</strong> Treat other users with courtesy. Harassment, bullying, and hate speech
            are not permitted.
          </li>
          <li>
            <strong>Safety.</strong> Do not post content that encourages dangerous activities, self-harm, or
            unlawful conduct.
          </li>
          <li>
            <strong>Legality.</strong> Content must comply with applicable laws in Ontario and Canada, and
            with any other local rules that apply to you.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. Prohibited content</h2>
        <p>The following categories of content are not allowed on offhrs:</p>

        <h3 className="mt-4">3.1 Illegal content</h3>
        <p>
          Content that breaks applicable law, including material related to illegal goods or services, child
          exploitation, or encouraging others to commit unlawful acts.
        </p>

        <h3 className="mt-4">3.2 Intellectual property infringement</h3>
        <p>
          Content that infringes another party&rsquo;s copyright, trademark, patent, or other intellectual
          property rights. To report suspected infringement, contact{' '}
          <a href="mailto:hello@offhrs.app">hello@offhrs.app</a> with enough detail for us to review the
          claim.
        </p>

        <h3 className="mt-4">3.3 Hate speech and discrimination</h3>
        <p>
          Content that attacks, demeans, or promotes hatred, discrimination, or violence against people or
          groups based on characteristics such as race, ethnicity, national origin, religion, gender
          identity, sexual orientation, disability, or serious medical condition.
        </p>

        <h3 className="mt-4">3.4 Harassment, bullying, and abuse</h3>
        <p>
          Content or behaviour that targets someone with unwanted contact, threats, intimidation, humiliation,
          or sexual solicitation. This includes repeated unwanted messages and malicious personal attacks.
        </p>

        <h3 className="mt-4">3.5 Violence and graphic content</h3>
        <p>
          Content that shows gratuitous violence, promotes violent extremism, threatens violence, or is
          excessively graphic or shocking.
        </p>

        <h3 className="mt-4">3.6 Sexually explicit content</h3>
        <p>
          Pornographic or explicit sexual material, content depicting non-consensual sexual acts, or content
          that promotes illegal sexual services.
        </p>

        <h3 className="mt-4">3.7 Dangerous activities and regulated goods</h3>
        <p>
          Content that promotes activities likely to cause serious harm, or that facilitates the sale of
          regulated goods such as firearms, controlled drugs, or alcohol outside lawful frameworks.
        </p>

        <h3 className="mt-4">3.8 Spam, scams, and deceptive practices</h3>
        <p>
          Unsolicited commercial messages, phishing, fraud schemes, repetitive low-value posts, or attempts
          to manipulate reviews and ratings.
        </p>

        <h3 className="mt-4">3.9 Misinformation</h3>
        <p>
          Content that is demonstrably false and intended to cause harm&mdash;for example, dangerous health
          misinformation or material designed to undermine civic processes.
        </p>

        <h3 className="mt-4">3.10 Impersonation</h3>
        <p>Pretending to be another person, brand, or organization in a deceptive way.</p>

        <h3 className="mt-4">3.11 Privacy violations</h3>
        <p>
          Sharing someone else&rsquo;s private or confidential information without clear consent (including
          doxxing), such as non-public contact details, financial information, or intimate images or video.
        </p>
      </section>

      <section>
        <h2>4. Guidelines for workshop listings</h2>
        <p>Vendors must ensure their workshop listings are:</p>
        <ul>
          <li>
            <strong>Accurate and complete.</strong> Clearly describe the workshop, schedule, location,
            requirements, and what is included (materials, refreshments, skill level, and similar details).
          </li>
          <li>
            <strong>Relevant.</strong> Photos and descriptions must relate directly to the workshop being
            offered.
          </li>
          <li>
            <strong>Fair.</strong> Do not use misleading bait-and-switch tactics, or discriminatory pricing
            or availability that is not based on objective, lawful criteria.
          </li>
          <li>
            <strong>Compliant.</strong> Follow all rules in Section 3 (Prohibited content).
          </li>
        </ul>
      </section>

      <section>
        <h2>4A. Guidelines for Marketplace (physical goods) listings</h2>
        <p>When selling art or craft goods on the Artist Marketplace, Vendors must ensure listings are:</p>
        <ul>
          <li>
            <strong>Accurate.</strong> Clear photos, truthful materials/dimensions, and honest condition.
            Disclose whether a work is an original or a print/reproduction.
          </li>
          <li>
            <strong>Shipable as described.</strong> Weight and dimensions must be accurate for carrier rating.
          </li>
          <li>
            <strong>Lawful.</strong> No weapons, controlled substances, hazardous materials, recalled goods,
            counterfeits, or dropshipped mass-market junk misrepresented as handmade local work.
          </li>
          <li>
            <strong>Quality imagery.</strong> Listings with unusable (e.g. heavily pixelated) photos may be
            removed during review.
          </li>
        </ul>
      </section>

      <section>
        <h2>5. Guidelines for reviews</h2>
        <p>Reviews should be:</p>
        <ul>
          <li>
            <strong>Based on a real booking.</strong> Only leave a review for a workshop you booked and
            attended, or were scheduled to attend.
          </li>
          <li>
            <strong>On topic.</strong> Focus on the workshop itself, the Vendor&rsquo;s conduct, and whether
            the listing matched what was delivered.
          </li>
          <li>
            <strong>Independent.</strong> Do not solicit, incentivize, or exchange positive reviews, and do
            not post reviews as retaliation.
          </li>
          <li>
            <strong>Respectful.</strong> Avoid personal attacks, hate speech, or harassment as described in
            Section 3.
          </li>
          <li>
            <strong>Non-promotional.</strong> Do not insert advertising, affiliate links, or unrelated
            marketing into reviews.
          </li>
        </ul>
        <p>
          Vendors may not review their own workshops or otherwise game the ratings system.
        </p>
      </section>

      <section>
        <h2>6. Enforcement</h2>
        <p>
          offhrs may, but is not required to, review User Content and enforce this Policy. Actions are taken
          at our sole discretion and may include:
        </p>
        <ul>
          <li>Removing or restricting access to content that violates this Policy</li>
          <li>Issuing warnings</li>
          <li>Suspending accounts</li>
          <li>Terminating accounts</li>
          <li>Reporting unlawful activity to law enforcement when appropriate</li>
        </ul>
        <p>
          We consider how serious a violation is and whether it has happened before when deciding what action
          to take.
        </p>
      </section>

      <section>
        <h2>7. Reporting violations</h2>
        <p>
          If you see content or behaviour that appears to break this Content Policy, please report it
          promptly. Where available, use in-app reporting tools, or email our support team with specifics
          about the listing, review, message, or user involved and why you believe it violates this Policy.
        </p>
        <p>
          We take reports seriously. We may not be able to share the outcome of an investigation because of
          privacy or legal constraints.
        </p>
        <p>
          Contact support:{' '}
          <a href="mailto:hello@offhrs.app">hello@offhrs.app</a>
        </p>
      </section>

      <section>
        <h2>8. Policy updates</h2>
        <p>
          We may revise this Content Policy from time to time as our services or legal requirements change.
          Updated versions will be posted on the Platform with a revised &ldquo;Last updated&rdquo; date.
        </p>
      </section>
    </LegalPageLayout>
  )
}
