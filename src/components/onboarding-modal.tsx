'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/browser'
import { Button } from '@/components/ui/button'
import { CATEGORIES } from '@/constants/categories'

const EXPERIENCE_OPTIONS = [
  { value: 'no_experience', label: 'No experience', level: 'Novice', points: 0 },
  { value: '0-1', label: '0-1 year', level: 'Novice', points: 0 },
  { value: '2-3', label: '2-3 years', level: 'Intermediate', points: 8 },
  { value: '3-5', label: '3-5 years', level: 'Advanced', points: 16 },
  { value: '5-10', label: '5-10 years', level: 'Expert', points: 24 },
  { value: '10+', label: '10+ years', level: 'Master', points: 32 },
] as const

export default function OnboardingModal({
  userId,
  onComplete,
}: {
  userId: string
  onComplete: () => void
}) {
  const [step, setStep] = useState(1)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [experience, setExperience] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    )
  }

  const handleComplete = async () => {
    if (!experience) return
    setLoading(true)
    try {
      const option = EXPERIENCE_OPTIONS.find((o) => o.value === experience)
      const supabase = createClient()
      const { error } = await supabase
        .from('profiles')
        .update({
          category_of_interest: selectedCategories.length > 0 ? selectedCategories : null,
          years_experience: experience,
          expertise_level: option?.level ?? 'Novice',
          experience_points: option?.points ?? 0,
          onboarding_completed: true,
        })
        .eq('id', userId)

      if (error) throw error
      onComplete()
    } catch (err) {
      console.error('Onboarding error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-xl">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {step === 1 ? "What sparks your curiosity?" : "What's your experience level?"}
        </h2>
        <p className="text-gray-600 mb-6">
          {step === 1
            ? 'Select categories you&apos;re interested in (optional)'
            : 'We&apos;ll use this to personalize your experience'}
        </p>

        {step === 1 ? (
          <div className="space-y-4 max-h-64 overflow-y-auto">
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => {
                const isActive = selectedCategories.includes(cat)
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      isActive ? 'bg-[#5D755D] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {cat}
                  </button>
                )
              })}
            </div>
            <Button onClick={() => setStep(2)} className="w-full mt-4 bg-[#5D755D] hover:bg-[#4a5e4a]">
              Next
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {EXPERIENCE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setExperience(opt.value)}
                className={`w-full px-4 py-3 rounded-lg text-left font-medium transition-all ${
                  experience === opt.value ? 'bg-[#5D755D] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
            <Button
              onClick={handleComplete}
              disabled={!experience || loading}
              className="w-full mt-4 bg-[#5D755D] hover:bg-[#4a5e4a]"
            >
              {loading ? 'Saving...' : 'Complete'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
