import api from './axios'

import type {
  WishlistItemDto,
  WishlistPaginationDto,
} from '@/types/api/WishlistDto'

/**
 * Wishlist service — `/v1/wishlist/`.
 *
 * Every call here is authenticated: the backend refuses a guest, so callers check for a
 * session first rather than letting a 401 drive the UI. The shared `api` client attaches
 * the customer token, so nothing special is needed beyond that.
 *
 * ERROR SEMANTICS, which are what make the optimistic toggle in `WishlistProvider` safe:
 *   - `POST` answers 201 when it added the product and 200 when it was already saved.
 *     Both mean "it is in the wishlist now", so both are success.
 *   - `DELETE` answers 404 when the product was not in the wishlist. The caller wanted it
 *     gone and it is gone, so that is success too.
 * Treating either of those as a failure would make the heart flicker back on a perfectly
 * correct outcome.
 */

const PATH = '/v1/wishlist/'

type Envelope<T> = {
  success?: boolean
  message?: string | Record<string, string[]>
  data?: T
  pagination?: WishlistPaginationDto | null
}

/** Flattens this backend's two `message` shapes into one displayable line. */
export function readWishlistApiMessage(message: unknown, fallback: string): string {
  if (typeof message === 'string' && message.trim()) return message.trim()

  if (message && typeof message === 'object') {
    const parts: string[] = []
    for (const value of Object.values(message as Record<string, unknown>)) {
      if (Array.isArray(value)) parts.push(...value.filter((v): v is string => typeof v === 'string'))
      else if (typeof value === 'string') parts.push(value)
    }
    if (parts.length) return parts.join(' ')
  }

  return fallback
}

/** Turns a thrown request error into a message that is safe to show. */
export function readWishlistApiError(error: unknown, fallback: string): string {
  const response = (error as { response?: { status?: number; data?: Envelope<unknown> } }).response
  if (!response) return 'Unable to connect to the server. Check your connection and try again.'

  const status = response.status
  // 5xx bodies can carry raw exception text — never surface it.
  if (status && status >= 500) return 'The server is temporarily unavailable. Please try again shortly.'
  if (status === 401) return 'Please sign in to use your wishlist.'

  return readWishlistApiMessage(response.data?.message, fallback)
}

/**
 * `GET /v1/wishlist/?ids_only=true` — just the saved product ids.
 *
 * Called ONCE on load (and again after sign-in) to fill every heart on every page and the
 * header count. Deliberately separate from the paginated read: a heart on a 20-card shop
 * grid needs membership, not product records, and paging through the whole wishlist to
 * answer "is this one saved?" would be both slow and wrong past page one.
 *
 * Returns numbers, filtering anything unusable rather than trusting the array blindly.
 */
export async function getWishlistProductIds(): Promise<number[]> {
  const response = await api.get<Envelope<unknown>>(PATH, { params: { ids_only: true } })
  const data = response.data?.data

  if (!Array.isArray(data)) return []

  return data
    .map((entry) => (typeof entry === 'number' ? entry : Number(entry)))
    .filter((id): id is number => Number.isFinite(id))
}

export interface WishlistPage {
  items: WishlistItemDto[]
  /** null when the response carried no pagination block — never fabricated. */
  pagination: WishlistPaginationDto | null
}

/** `GET /v1/wishlist/?page=&page_size=` — the wishlist page's cards, newest first. */
export async function getWishlistPage(
  { page = 1, pageSize = 20 }: { page?: number; pageSize?: number } = {},
): Promise<WishlistPage> {
  const response = await api.get<Envelope<WishlistItemDto[]>>(PATH, {
    params: { page, page_size: pageSize },
  })

  return {
    items: Array.isArray(response.data?.data) ? response.data.data : [],
    pagination: response.data?.pagination ?? null,
  }
}

/**
 * `POST /v1/wishlist/` — saves a product.
 *
 * 201 (added) and 200 (already saved) are both success; axios only throws from 4xx up, so
 * simply returning normally covers both. A 404 means the product is no longer available,
 * which the caller surfaces and rolls back for.
 */
export async function addToWishlist(productId: number): Promise<void> {
  await api.post<Envelope<unknown>>(PATH, { product_id: productId })
}

/**
 * `DELETE /v1/wishlist/?product_id=` — removes a product.
 *
 * A 404 is swallowed: it means the product was not in the wishlist, and the caller's
 * intent — that it should not be — is already satisfied. Anything else is re-thrown.
 */
export async function removeFromWishlist(productId: number): Promise<void> {
  try {
    await api.delete<Envelope<unknown>>(PATH, { params: { product_id: productId } })
  } catch (error) {
    const status = (error as { response?: { status?: number } }).response?.status
    if (status === 404) return
    throw error
  }
}
