'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { User, GraduationCap, Mail } from 'lucide-react'
import { FloatingNav } from '@/components/marketing/floating-nav'
import { FollowUs } from '@/components/marketing/follow-us'
import { OffhrsLogo } from '@/components/offhrs-logo'

const CONTACT_EMAIL = 'hello@offhrs.app'

type Role = 'learner' | 'instructor' | null

export default function ContactPage() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [chatWithUs, setChatWithUs] = useState('')
  const [role, setRole] = useState<Role>(null)

  const handleGetInTouch = () => {
    const body = [
      `First name: ${firstName.trim() || '(not provided)'}`,
      `Last name: ${lastName.trim() || '(not provided)'}`,
      `Email: ${email.trim() || '(not provided)'}`,
      `Business / studio: ${businessName.trim() || '(not provided)'}`,
      `Role: ${role === 'learner' ? "I'm a learner" : role === 'instructor' ? "I'm an artist" : '(not selected)'}`,
      '',
      'Chat with us:',
      chatWithUs.trim() || '(empty)',
    ].join('\n')
    const subject = encodeURIComponent('Contact from Offhrs app')
    const bodyEncoded = encodeURIComponent(body)
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${bodyEncoded}`
  }

  return (
    <div className="relative min-h-screen bg-[#F7F5F1]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-56 overflow-hidden"
      >
        <div className="absolute -left-16 top-0 h-44 w-44 rounded-full bg-[#D9D2C5]/55 blur-3xl" />
        <div className="absolute right-10 top-4 h-40 w-56 rounded-full bg-[#C9D0C4]/45 blur-3xl" />
        <div className="absolute left-1/3 top-8 h-32 w-48 rounded-full bg-[#E8DFD2]/50 blur-3xl" />
      </div>

      <FloatingNav />

      <div className="relative mx-auto grid max-w-5xl items-start gap-10 px-5 pb-14 pt-24 sm:gap-14 sm:px-6 sm:pb-16 sm:pt-28 md:grid-cols-2 md:gap-16 md:pb-24 md:pt-36 lg:gap-24">
        {/* Left — brand + invite + socials */}
        <div className="flex flex-col md:pt-6">
          <OffhrsLogo
            className="h-11 w-auto max-w-[180px] object-contain object-left sm:h-14 sm:max-w-[200px]"
            width={240}
            height={56}
            priority
          />
          <h1 className="mt-6 text-[1.75rem] font-bold leading-tight tracking-tight text-neutral-900 sm:mt-8 sm:text-3xl md:text-4xl">
            Are you an artist?
          </h1>
          <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-neutral-600 sm:mt-4 sm:text-base sm:text-lg">
            Got a workshop to host or a piece to list? We&apos;d love to hear from you —
            let&apos;s get your work in front of the community.
          </p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="mt-5 inline-flex items-center gap-3 text-sm font-medium text-heading-dark transition-opacity hover:opacity-80 sm:mt-6"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-heading-dark text-white">
              <Mail className="h-4 w-4" />
            </span>
            {CONTACT_EMAIL}
          </a>
          <FollowUs className="mt-8 items-start sm:mt-12" tone="onLight" align="start" />
        </div>

        {/* Right — contact form */}
        <div className="w-full">
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName" className="text-neutral-700">
                  First name
                </Label>
                <Input
                  id="firstName"
                  placeholder="First name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="h-11 rounded-xl border-neutral-200 bg-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName" className="text-neutral-700">
                  Last name
                </Label>
                <Input
                  id="lastName"
                  placeholder="Last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="h-11 rounded-xl border-neutral-200 bg-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-neutral-700">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="h-11 rounded-xl border-neutral-200 bg-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessName" className="text-neutral-700">
                What&apos;s the name of your business/studio{' '}
                <span className="font-normal text-neutral-400">(optional)</span>
              </Label>
              <Input
                id="businessName"
                placeholder="Business or studio name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="h-11 rounded-xl border-neutral-200 bg-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="chatWithUs" className="text-neutral-700">
                Chat with us
              </Label>
              <Textarea
                id="chatWithUs"
                placeholder="Tell us a little about what you’d like to list or ask"
                value={chatWithUs}
                onChange={(e) => setChatWithUs(e.target.value)}
                rows={4}
                className="min-h-[100px] resize-y rounded-xl border-neutral-200 bg-white"
              />
            </div>

            <div className="space-y-3">
              <Label className="text-neutral-700">I am</Label>
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => setRole('learner')}
                  className={`flex w-full items-center gap-3 rounded-xl border-2 bg-white px-4 py-3.5 text-left transition-colors ${
                    role === 'learner'
                      ? 'border-heading-dark ring-1 ring-heading-dark/30'
                      : 'border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  <User
                    className={`h-5 w-5 shrink-0 ${
                      role === 'learner' ? 'text-heading-dark' : 'text-neutral-600'
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="font-semibold leading-snug text-neutral-900">I&apos;m a learner</p>
                    <p className="mt-0.5 text-sm leading-snug text-neutral-500">
                      I want to discover and book workshops.
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setRole('instructor')}
                  className={`flex w-full items-center gap-3 rounded-xl border-2 bg-white px-4 py-3.5 text-left transition-colors ${
                    role === 'instructor'
                      ? 'border-heading-dark ring-1 ring-heading-dark/30'
                      : 'border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  <GraduationCap
                    className={`h-5 w-5 shrink-0 ${
                      role === 'instructor' ? 'text-heading-dark' : 'text-neutral-600'
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="font-semibold leading-snug text-neutral-900">I&apos;m an Artist</p>
                    <p className="mt-0.5 text-sm leading-snug text-neutral-500">
                      I want to list my workshops and/or artworks
                    </p>
                  </div>
                </button>
              </div>
            </div>
          </div>

          <Button
            onClick={handleGetInTouch}
            className="mt-6 h-11 w-full rounded-xl bg-heading-dark font-semibold text-white hover:bg-heading-dark/90 sm:w-auto sm:min-w-[10rem]"
          >
            Get in touch
          </Button>

          <p className="mt-5 text-sm text-neutral-500">
            We typically respond within 24–48 hours.
          </p>
        </div>
      </div>
    </div>
  )
}
