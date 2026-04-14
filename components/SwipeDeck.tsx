'use client'

import { useRef, useCallback, useEffect } from 'react'
import {
  motion,
  useMotionValue,
  useTransform,
  useAnimation,
  AnimatePresence,
} from 'framer-motion'
import LeadCard from './LeadCard'
import type { Lead } from '@/lib/types'

interface SwipeDeckProps {
  leads: Lead[]
  onSwipe: (leadId: string, direction: 'right' | 'left' | 'down') => void
  onEmpty: () => void
  isLoading: boolean
  isGenerating: boolean
}

function TopCard({
  lead,
  onSwiped,
}: {
  lead: Lead
  onSwiped: (id: string, dir: 'right' | 'left' | 'down') => void
}) {
  const controls = useAnimation()
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rotate = useTransform(x, [-220, 220], [-18, 18])
  const matchOpacity = useTransform(x, [20, 100], [0, 1])
  const passOpacity = useTransform(x, [-100, -20], [1, 0])
  const snoozeOpacity = useTransform(y, [20, 100], [0, 1])
  const animating = useRef(false)

  const swipe = useCallback(
    async (dir: 'right' | 'left' | 'down') => {
      if (animating.current) return
      animating.current = true

      const exits: Record<string, object> = {
        right: { x: 1000, y: 0, rotate: 25, opacity: 0 },
        left: { x: -1000, y: 0, rotate: -25, opacity: 0 },
        down: { x: 0, y: 700, rotate: 0, opacity: 0 },
      }

      await controls.start({
        ...exits[dir],
        transition: { duration: 0.28, ease: 'easeIn' },
      })
      onSwiped(lead.id, dir)
    },
    [controls, lead.id, onSwiped]
  )

  // Expose swipe method via data attribute (parent reads it)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (ref.current) {
      // Attach swipe function to DOM node for parent buttons
      ;(ref.current as HTMLDivElement & { swipe?: typeof swipe }).swipe = swipe
    }
  }, [swipe])

  return (
    <motion.div
      ref={ref}
      data-card-id={lead.id}
      animate={controls}
      style={{ x, y, rotate }}
      drag
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.85}
      whileDrag={{ cursor: 'grabbing' }}
      onDragEnd={(_, info) => {
        const { offset } = info
        if (offset.x > 100) swipe('right')
        else if (offset.x < -100) swipe('left')
        else if (offset.y > 100) swipe('down')
      }}
      className="absolute inset-0 cursor-grab"
    >
      {/* MATCH indicator */}
      <motion.div
        style={{ opacity: matchOpacity }}
        className="absolute top-8 left-6 z-10 px-4 py-2 rounded-xl bg-emerald-500 text-white font-bold text-lg rotate-[-20deg] pointer-events-none"
      >
        MATCH
      </motion.div>

      {/* PASS indicator */}
      <motion.div
        style={{ opacity: passOpacity }}
        className="absolute top-8 right-6 z-10 px-4 py-2 rounded-xl bg-red-500 text-white font-bold text-lg rotate-[20deg] pointer-events-none"
      >
        PASS
      </motion.div>

      {/* SNOOZE indicator */}
      <motion.div
        style={{ opacity: snoozeOpacity }}
        className="absolute top-8 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded-xl bg-amber-400 text-white font-bold text-lg pointer-events-none"
      >
        SNOOZE
      </motion.div>

      <LeadCard lead={lead} />
    </motion.div>
  )
}

export default function SwipeDeck({
  leads,
  onSwipe,
  onEmpty,
  isLoading,
  isGenerating,
}: SwipeDeckProps) {
  const deckRef = useRef<HTMLDivElement>(null)

  const handleSwiped = useCallback(
    (id: string, dir: 'right' | 'left' | 'down') => {
      onSwipe(id, dir)
    },
    [onSwipe]
  )

  const triggerButtonSwipe = (dir: 'right' | 'left' | 'down') => {
    if (!deckRef.current) return
    const card = deckRef.current.querySelector('[data-card-id]') as HTMLDivElement & {
      swipe?: (dir: 'right' | 'left' | 'down') => void
    }
    card?.swipe?.(dir)
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowRight' || e.key === 'd') triggerButtonSwipe('right')
      else if (e.key === 'ArrowLeft' || e.key === 'a') triggerButtonSwipe('left')
      else if (e.key === 'ArrowDown' || e.key === 's') triggerButtonSwipe('down')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const currentLead = leads[0]

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[520px] gap-3">
        <div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-400">Loading leads...</p>
      </div>
    )
  }

  if (!currentLead) {
    return (
      <div className="flex flex-col items-center justify-center h-[520px] gap-3">
        {isGenerating ? (
          <>
            <div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-400">Finding more leads...</p>
          </>
        ) : (
          <>
            <p className="text-3xl">✓</p>
            <p className="text-gray-700 font-medium">All caught up</p>
            <p className="text-sm text-gray-400">New leads arrive overnight</p>
            <button
              onClick={onEmpty}
              className="mt-2 px-4 py-2 text-sm bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors"
            >
              Load more now
            </button>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center">
      {/* Card stack */}
      <div ref={deckRef} className="relative w-full max-w-sm" style={{ height: 520 }}>
        {/* Background cards */}
        {leads.slice(1, 3).map((lead, i) => (
          <div
            key={lead.id}
            className="absolute inset-0 pointer-events-none"
            style={{
              transform: `scale(${1 - (i + 1) * 0.03}) translateY(${(i + 1) * 10}px)`,
              zIndex: -(i + 1),
            }}
          >
            <LeadCard lead={lead} dimmed />
          </div>
        ))}

        {/* Top card */}
        <AnimatePresence mode="popLayout">
          <TopCard key={currentLead.id} lead={currentLead} onSwiped={handleSwiped} />
        </AnimatePresence>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-5 mt-8">
        <button
          onClick={() => triggerButtonSwipe('left')}
          title="Pass (←)"
          className="w-14 h-14 rounded-full bg-white border-2 border-red-200 text-red-400 text-xl flex items-center justify-center hover:border-red-400 hover:text-red-500 hover:scale-110 transition-all shadow-sm"
        >
          ✕
        </button>
        <button
          onClick={() => triggerButtonSwipe('down')}
          title="Snooze 7 days (↓)"
          className="w-12 h-12 rounded-full bg-white border-2 border-amber-200 text-amber-400 text-lg flex items-center justify-center hover:border-amber-400 hover:text-amber-500 hover:scale-110 transition-all shadow-sm"
        >
          ⏸
        </button>
        <button
          onClick={() => triggerButtonSwipe('right')}
          title="Match (→)"
          className="w-14 h-14 rounded-full bg-white border-2 border-emerald-200 text-emerald-400 text-xl flex items-center justify-center hover:border-emerald-400 hover:text-emerald-500 hover:scale-110 transition-all shadow-sm"
        >
          ♥
        </button>
      </div>

      {/* Hints */}
      <p className="mt-3 text-xs text-gray-300">← pass · ↓ snooze 7d · → match</p>
      {isGenerating && (
        <p className="mt-1 text-xs text-gray-400">Finding more leads in the background...</p>
      )}
    </div>
  )
}
