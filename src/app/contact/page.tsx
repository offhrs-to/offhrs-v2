'use client'

import Navbar from '@/components/navbar'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Mail } from 'lucide-react'

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      
      <main className="container mx-auto px-4 py-16 max-w-2xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">Get in Touch</h1>
          <p className="text-slate-600 text-lg">
            Have a workshop to list? We'd love to hear from you.
          </p>
        </div>

        <Card className="border-gray-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-moss" />
              Contact Us
            </CardTitle>
            <CardDescription>
              Reach out to us for workshop listings, partnerships, or general inquiries.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-slate-600 mb-2">Email us at:</p>
              <a 
                href="mailto:offhrs.to@gmail.com" 
                className="text-moss hover:text-moss-dark font-semibold text-lg"
              >
                offhrs.to@gmail.com
              </a>
            </div>
            <div className="pt-4 border-t border-gray-200">
              <p className="text-sm text-slate-600">
                We typically respond within 24-48 hours. For urgent matters, please include "URGENT" in your subject line.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
