import { formatOrderTimelineStamp } from '@/lib/format'
import type { OrderTimelineStep } from '@/types/orderManagement'

/**
 * The order progress bar.
 *
 * Driven ENTIRELY by the response's `timeline` array — never by `order_status` and never
 * by the individual `*_at` fields. That matters because the array is not a fixed shape:
 * a cancelled order returns only the steps it actually reached plus a `CANCELLED` step,
 * so it may arrive with two or three entries. Whatever length arrives is what renders;
 * nothing is padded back to five and `DELIVERED` is never assumed to be last.
 *
 * Each node's state comes from its own `completed` flag, and a connector is filled only
 * when the steps on BOTH sides of it are completed.
 *
 * Two layouts, one data source: a vertical rail on phones, where five labels side by side
 * would be unreadable, and the horizontal rail from `sm` up.
 */

/** A completed step is green per the contract; everything else stays on the site's greys. */
const DONE_DOT = 'border-emerald-600 bg-emerald-600 text-white'
const TODO_DOT = 'border-zinc-300 bg-white text-zinc-400'
const DONE_LINE = 'bg-emerald-600'
const TODO_LINE = 'bg-zinc-200'

function Tick({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="m5 13 4 4L19 7" />
    </svg>
  )
}

function Dot({ step, size }: { step: OrderTimelineStep; size: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'size-6' : 'size-7'
  return (
    <span
      className={`flex ${box} shrink-0 items-center justify-center rounded-full border-2 ${step.completed ? DONE_DOT : TODO_DOT}`}
    >
      {step.completed ? <Tick className="size-3.5" /> : <span className="size-1.5 rounded-full bg-current" />}
    </span>
  )
}

export function OrderProgress({ steps }: { steps: OrderTimelineStep[] }) {
  // No timeline in the payload means no progress bar — not an empty or invented one.
  if (steps.length === 0) return null

  return (
    <div aria-label="Order progress">
      {/* Phones: a vertical rail. Labels get a full line each, so nothing truncates. */}
      <ol className="flex flex-col sm:hidden">
        {steps.map((step, index) => {
          const next = steps[index + 1]
          // The segment below this node belongs to the gap between it and the next one.
          const linkDone = step.completed && next?.completed === true
          const stamp = formatOrderTimelineStamp(step.at)

          return (
            <li key={`${step.status}-${index}`} className="flex gap-3">
              <div className="flex flex-col items-center">
                <Dot step={step} size="sm" />
                {next ? <span className={`w-0.5 flex-1 ${linkDone ? DONE_LINE : TODO_LINE}`} /> : null}
              </div>
              <div className={next ? 'pb-4' : ''}>
                <p className={`text-xs font-semibold ${step.completed ? 'text-black' : 'text-zinc-400'}`}>
                  {step.label}
                </p>
                {/* A stamp is shown only for a completed step; an incomplete one has none. */}
                {stamp ? <p className="mt-0.5 text-[11px] text-zinc-500">{stamp}</p> : null}
              </div>
            </li>
          )
        })}
      </ol>

      {/* Tablet and up: the horizontal rail. */}
      <ol className="hidden sm:flex sm:items-start">
        {steps.map((step, index) => {
          const previous = steps[index - 1]
          const next = steps[index + 1]
          const stamp = formatOrderTimelineStamp(step.at)

          return (
            <li key={`${step.status}-${index}`} className="flex min-w-0 flex-1 flex-col items-center">
              {/*
                The rail is split into a left and a right half around the node, so each
                half can be coloured by the pair it actually joins. The outer halves on
                the first and last nodes are invisible rather than absent, which keeps
                every node centred on the same horizontal line.
              */}
              <div className="flex w-full items-center">
                <span
                  className={`h-0.5 flex-1 ${!previous ? 'bg-transparent' : previous.completed && step.completed ? DONE_LINE : TODO_LINE}`}
                />
                <Dot step={step} size="md" />
                <span
                  className={`h-0.5 flex-1 ${!next ? 'bg-transparent' : step.completed && next.completed ? DONE_LINE : TODO_LINE}`}
                />
              </div>
              <p
                className={`mt-2 px-1 text-center text-[11px] font-semibold leading-tight ${step.completed ? 'text-black' : 'text-zinc-400'}`}
              >
                {step.label}
              </p>
              {stamp ? <p className="mt-0.5 px-1 text-center text-[10px] text-zinc-500">{stamp}</p> : null}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
