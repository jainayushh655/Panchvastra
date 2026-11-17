import { getCustomerOrderDetail, getOrders, readOrderApiError } from './order'

/**
 * Can this customer review this product, and through which order item?
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS
 * ──────────────────────────────────────────────────────────────────────────────
 * The backend attaches a review to an **order item**, not to a product, and accepts one
 * only for an order that has been DELIVERED. That is what makes "Verified Purchase" true
 * by construction and limits each purchase to a single review — and it means a
 * product-page "Add Review" button has nothing to submit on its own: it has no
 * `order_item_id`.
 *
 * So the button resolves one. This walks the signed-in customer's orders, finds a
 * delivered one containing the product, and reports either the order item to review or a
 * reason there isn't one. Without this the button would open a form that fails with a 403
 * on submit, which reads as a bug rather than as a rule.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * COST
 * ──────────────────────────────────────────────────────────────────────────────
 * Two requests, and only ever on a click — never on page load. The list is scanned first
 * because it already carries `items`; the detail read that follows is what supplies
 * `review_id`, which is a detail-only field and is the difference between opening the
 * form blank and opening it on an existing review.
 */

/** How many orders back to look. Deep enough to cover a real history, bounded so an
 *  account with hundreds of orders cannot turn one click into a slow scan. */
const ORDER_SCAN_PAGE_SIZE = 50

/** The status the backend requires. Anything else is refused with a 403. */
const DELIVERED_STATUS = 'DELIVERED'

export type ReviewEligibility =
  /** Delivered and not yet reviewed — open the form on this order item. */
  | { status: 'eligible'; orderItemId: number; size: string | null; color: string | null }
  /** Delivered and already reviewed — open the form in edit mode instead. */
  | { status: 'already-reviewed'; reviewId: number; size: string | null; color: string | null }
  /** No delivered order contains this product. The button explains rather than failing. */
  | { status: 'not-purchased' }
  /** The lookup itself failed. Distinct from "not purchased", which is a real answer. */
  | { status: 'error'; message: string }

export async function resolveReviewEligibility(productId: number | string): Promise<ReviewEligibility> {
  const wanted = String(productId)

  try {
    // No `order_type` filter: the Completed bucket is the obvious place to look, but the
    // backend owns that grouping and a delivered order sitting outside it would make this
    // silently answer "not purchased". The status is checked explicitly below instead.
    const { orders } = await getOrders({ page: 1, page_size: ORDER_SCAN_PAGE_SIZE })

    for (const order of orders) {
      if ((order.status ?? '').toUpperCase() !== DELIVERED_STATUS) continue

      const line = order.items.find(
        // `orderItemId` is null when the response carried no line id, and a review cannot
        // be attached without one — such a line is skipped rather than offered.
        (item) => item.productId === wanted && item.orderItemId !== null,
      )
      if (!line || line.orderItemId === null) continue

      /*
       * Re-read the order in full. The list's `review_id` may be absent — it is documented
       * on the detail response — and guessing "not reviewed" from a missing field would
       * send the customer into a create that answers 409.
       */
      let reviewId = line.reviewId
      try {
        const detail = await getCustomerOrderDetail(order.id)
        const detailLine = detail?.items.find((item) => item.orderItemId === line.orderItemId)
        if (detailLine) reviewId = detailLine.reviewId
      } catch {
        // The detail read is an enhancement, not a gate. Falling back to the list's own
        // value still opens a usable form, and a stale "not reviewed" is recoverable: the
        // create answers 409 with the real id and the form switches to editing it.
      }

      if (reviewId !== null) {
        return { status: 'already-reviewed', reviewId, size: line.size, color: line.color }
      }

      return {
        status: 'eligible',
        orderItemId: line.orderItemId,
        size: line.size,
        color: line.color,
      }
    }

    return { status: 'not-purchased' }
  } catch (error) {
    return {
      status: 'error',
      message: readOrderApiError(error, 'Could not check your orders. Please try again.'),
    }
  }
}
