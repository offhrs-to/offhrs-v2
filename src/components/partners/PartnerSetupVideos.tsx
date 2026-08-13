'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const VIDEOS = [
  {
    id: 'Dxaxl6acDP8',
    title: 'Account set up',
    description: 'Create your offhrs Partners account and get ready to go live.',
  },
  {
    id: 'P2hIUMgjfmQ',
    title: 'Getting started',
    description: 'Walk through the partner dashboard and your first setup steps.',
  },
] as const

export function PartnerSetupVideos() {
  const [index, setIndex] = useState(0)
  const video = VIDEOS[index]
  const total = VIDEOS.length

  const go = (next: number) => {
    setIndex(((next % total) + total) % total)
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-10">
        <h2 className="font-playfair text-3xl font-bold mb-4">Video guides</h2>
        <p className="text-[#555] text-sm max-w-md mx-auto">
          Short walkthroughs for setting up your partner account and getting started on offhrs.
        </p>
      </div>

      <div className="space-y-5">
        <div>
          <p className="text-sm font-semibold text-[#5D755D] uppercase tracking-wide mb-1">
            {index + 1} of {total}
          </p>
          <h3 className="font-semibold text-[#1a1a1a] text-lg">{video.title}</h3>
          <p className="text-sm text-[#555] mt-1">{video.description}</p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-[#E8E6E0] bg-black shadow-sm aspect-video">
          <iframe
            key={video.id}
            className="absolute inset-0 h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${video.id}?rel=0`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => go(index - 1)}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#D9D7CF] bg-white px-4 py-2 text-sm font-medium text-[#1a1a1a] hover:bg-[#F0EDE8] transition-colors"
            aria-label="Previous video"
          >
            <ChevronLeft className="size-4" />
            Previous
          </button>

          <div className="flex items-center gap-2" role="tablist" aria-label="Video slides">
            {VIDEOS.map((v, i) => (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Show ${v.title}`}
                onClick={() => setIndex(i)}
                className={`h-2.5 rounded-full transition-all ${
                  i === index ? 'w-6 bg-[#5D755D]' : 'w-2.5 bg-[#D9D7CF] hover:bg-[#B8B5AD]'
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => go(index + 1)}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#D9D7CF] bg-white px-4 py-2 text-sm font-medium text-[#1a1a1a] hover:bg-[#F0EDE8] transition-colors"
            aria-label="Next video"
          >
            Next
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
