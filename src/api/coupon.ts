import api from './axios'

export type CouponResult =
  | { ok: true; discountAmount: number; message?: string }
  | { ok: false; message: string }

type CouponApiEnvelope = {
  success?: boolean
  message?: string
  data?: { discount_amount?: number; discount?: number } | null
}

/**
 * Calls the real backend coupon endpoint. `/v1/coupon_management/` is confirmed to exist —
 * unauthenticated requests return `401 "Authorization token missing."`, the exact signal
 * every other real endpoint in this backend returns (cart_management, products_management,
 * categories_management), unlike a genuinely absent route, which returns a plain 404. An
 * OPTIONS preflight also confirms it accepts GET/HEAD/PUT/PATCH/POST/DELETE.
 *
 * What is NOT confirmed: the exact request/response field names below (`code`,
 * `cart_total`, `data.discount_amount`) are a best-effort inference from this backend's
 * established `_management` REST + `{ success, message, data }` envelope conventions —
 * no authenticated test request could be made in this environment to confirm them. Every
 * call here is a genuine network request; nothing is faked locally. Confirm/adjust the
 * field names against real backend/QA credentials before relying on this in production.
 */
export async function applyCoupon(code: string, cartTotal: number): Promise<CouponResult> {
  try {
    const response = await api.post<CouponApiEnvelope>('/v1/coupon_management/', {
      code,
      cart_total: cartTotal,
    })

    const body = response.data
    if (body?.success) {
      const discountAmount = body.data?.discount_amount ?? body.data?.discount ?? 0
      return { ok: true, discountAmount, message: body.message }
    }

    return { ok: false, message: body?.message ?? 'Coupon is not valid.' }
  } catch (error) {
    const message =
      typeof error === 'object' && error && 'response' in error
        ? ((error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Coupon is not valid.')
        : 'Could not validate coupon. Try again.'

    return { ok: false, message }
  }
}
