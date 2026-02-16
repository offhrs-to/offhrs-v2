'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { User, GraduationCap, Mail } from 'lucide-react'

const CONTACT_EMAIL = 'offhrs.to@gmail.com'

type Role = 'learner' | 'instructor' | null

export default function ContactPage() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [chatWithUs, setChatWithUs] = useState('')
  const [role, setRole] = useState<Role>(null)

  const handleGetInTouch = () => {
    const body = [
      `First name: ${firstName.trim() || '(not provided)'}`,
      `Last name: ${lastName.trim() || '(not provided)'}`,
      `Email: ${email.trim() || '(not provided)'}`,
      `Role: ${role === 'learner' ? "I'm a learner" : role === 'instructor' ? "I'm an instructor" : '(not selected)'}`,
      '',
      'Chat with us:',
      chatWithUs.trim() || '(empty)',
    ].join('\n')
    const subject = encodeURIComponent('Contact from Offhrs app')
    const bodyEncoded = encodeURIComponent(body)
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${bodyEncoded}`
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="container mx-auto max-w-xl px-4 py-8 sm:py-10">
        <Link
          href="/"
          className="inline-block text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
        >
          ← Back
        </Link>

        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-2">
          Let&apos;s grow together
        </h1>
        <p className="text-sm sm:text-base text-gray-500 text-center mb-8 leading-relaxed">
          Have a workshop to list? We&apos;d love to hear from you.
        </p>

        {/* Email link */}
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="flex items-center gap-4 w-full rounded-full border border-[var(--border)] bg-white py-4 px-5 mb-8 hover:border-[var(--ring)] hover:bg-gray-50/80 transition-colors"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-white">
            <Mail className="h-5 w-5" />
          </span>
          <span className="text-base font-medium text-[var(--primary)]">{CONTACT_EMAIL}</span>
        </a>

        {/* Form */}
        <div className="space-y-6 mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName" className="text-gray-700">First name</Label>
              <Input
                id="firstName"
                placeholder="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="border-gray-200 bg-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName" className="text-gray-700">Last name</Label>
              <Input
                id="lastName"
                placeholder="Last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="border-gray-200 bg-white"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-gray-700">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="border-gray-200 bg-white"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="chatWithUs" className="text-gray-700">Chat with us</Label>
            <Textarea
              id="chatWithUs"
              placeholder="Chat with us"
              value={chatWithUs}
              onChange={(e) => setChatWithUs(e.target.value)}
              rows={4}
              className="border-gray-200 bg-white min-h-[100px] resize-y"
            />
          </div>

          <div className="space-y-3">
            <Label className="text-gray-700">I am</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole('learner')}
                className={`flex items-start gap-3 rounded-lg border-2 bg-white p-4 text-left transition-colors ${
                  role === 'learner'
                    ? 'border-[var(--primary)] ring-[var(--ring)]'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <User
                  className={`h-5 w-5 shrink-0 mt-0.5 ${role === 'learner' ? 'text-[var(--primary)]' : 'text-gray-600'}`}
                />
                <div>
                  <p className="font-semibold text-gray-900">I&apos;m a learner</p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    I want to discover and book workshops.
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setRole('instructor')}
                className={`flex items-start gap-3 rounded-lg border-2 bg-white p-4 text-left transition-colors ${
                  role === 'instructor'
                    ? 'border-[var(--primary)] ring-[var(--ring)]'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <GraduationCap
                  className={`h-5 w-5 shrink-0 mt-0.5 ${role === 'instructor' ? 'text-[var(--primary)]' : 'text-gray-600'}`}
                />
                <div>
                  <p className="font-semibold text-gray-900">I&apos;m an instructor</p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    I want to list my workshops and reach learners.
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>

        <Button
          onClick={handleGetInTouch}
          className="w-full bg-[var(--primary)] hover:opacity-90 text-white font-semibold py-3"
        >
          Get in touch
        </Button>

        <p className="text-sm text-gray-500 text-center mt-6">
          We typically respond within 24–48 hours.
        </p>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <Link href="/">
            <Button variant="outline" className="w-full sm:w-auto">
              Back to home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
