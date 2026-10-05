import { formatOrderTimelineStamp } from '@/lib/format'
import type { OrderTimelineStep } from '@/types/orderManagement'

/**
 * The order progress bar, in the admin design system.
 *
 * Same rules as the storefront's `OrderProgress`: it renders the response's `timeline`
 * array and nothing else — one node per entry in array order, each node's state taken
 * from its own `completed` flag, and a connector filled only when both of the steps it
 * joins are completed. Nothing is computed from `order_status` or the `*_at` fields, and
 * the array length is never assumed (a cancelled order legitimately returns two or three
 * entries, with `CANCELLED` last rather than `DELIVERED`).
 *
 * `compact` is the list-table rendering: dots only, with the label and timestamp moved
 * into each node's tooltip so a nine-column table row stays readable.
 */
export function AdminOrderTimeline({
  steps,
  compact = false,
}: {
  steps: OrderTimelineStep[]
  compact?: boolean
}) {
  if (steps.length === 0) return null

  return (
    <ol className={compact ? 'admin-timeline admin-timeline--compact' : 'admin-timeline'} aria-label="Order progress">
      {steps.map((step, index) => {
        const previous = steps[index - 1]
        const next = steps[index + 1]
        const stamp = formatOrderTimelineStamp(step.at)

        const before = !previous ? 'hidden' : previous.completed && step.completed ? 'done' : 'todo'
        const after = !next ? 'hidden' : step.completed && next.completed ? 'done' : 'todo'

        return (
          <li className="admin-timeline__step" key={`${step.status}-${index}`}>
            <span className="admin-timeline__rail">
              <span className={`admin-timeline__line admin-timeline__line--${before}`} />
              <span
                className={`admin-timeline__dot${step.completed ? ' admin-timeline__dot--done' : ''}`}
                // In compact mode the dot carries the only copy of the label, so the
                // tooltip is the accessible name rather than decoration.
                title={compact ? [step.label, stamp].filter(Boolean).join(' · ') : undefined}
              >
                <span className="sr-only">
                  {step.label}
                  {step.completed ? ' — completed' : ' — pending'}
                </span>
              </span>
              <span className={`admin-timeline__line admin-timeline__line--${after}`} />
            </span>

            {compact ? null : (
              <>
                <span className={`admin-timeline__label${step.completed ? ' is-done' : ''}`}>{step.label}</span>
                {/* Only a completed step carries a timestamp. */}
                {stamp ? <span className="admin-timeline__stamp">{stamp}</span> : null}
              </>
            )}
          </li>
        )
      })}
    </ol>
  )
}
