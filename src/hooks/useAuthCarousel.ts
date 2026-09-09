import { useEffect, useState } from 'react'
import { getActiveAuthCarouselImages } from '@/api/authCarousel'
import type { AuthCarouselDto } from '@/types/api/AuthCarouselDto'

/**
 * Shared customer-facing source for the auth carousel — the single place Home, Login and
 * Signup get their slides from, so the fetch/filter/order logic exists exactly once.
 *
 * Already active-only and ordered by `display_order` ascending when it arrives here; see
 * `getActiveAuthCarouselImages`.
 *
 * Failure is deliberately silent for customers: the slides are decorative, so a failed
 * request leaves an empty list and the carousel renders nothing rather than showing a
 * broken image or leaking an API error onto a storefront page.
 */
export function useAuthCarousel(): { images: AuthCarouselDto[]; loading: boolean } {
  const [images, setImages] = useState<AuthCarouselDto[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    getActiveAuthCarouselImages()
      .then((rows) => {
        if (active) setImages(rows)
      })
      .catch(() => {
        // Decorative content: fail closed to "no slides", never break the page.
        if (active) setImages([])
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  return { images, loading }
}
