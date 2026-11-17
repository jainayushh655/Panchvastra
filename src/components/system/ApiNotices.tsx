import { useEffect } from 'react'
import { onRateLimited, rateLimitMessage } from '@/api/rateLimit'
import { useToast } from '@/context/ToastProvider'

/**
 * Turns API-layer signals into the toasts a shopper actually sees.
 *
 * Renders nothing. It exists because the axios interceptors run outside React and cannot
 * reach the toast stack: they raise a signal, and this subscriber — mounted once, inside
 * `ToastProvider` — is the single place that signal becomes UI.
 *
 * Only the rate limiter is handled here. A stale token is deliberately NOT announced: the
 * backend answers public GETs as a guest and flags the dead token in a header, so the page
 * content is valid and the only correct response is to log out quietly. Telling someone
 * "you were signed out" over a product page they are reading is noise, not information.
 */
export function ApiNotices() {
  const { showToast } = useToast()

  useEffect(
    () =>
      onRateLimited((retryAfterSeconds) => {
        showToast('Too many requests', {
          variant: 'warning',
          description: rateLimitMessage(retryAfterSeconds),
          // Longer than the default so it outlives a short retry window and the shopper
          // does not tap straight into a second refusal.
          duration: 5000,
        })
      }),
    [showToast],
  )

  return null
}
