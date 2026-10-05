import { ADDRESS_LOCKED_STATUSES } from '@/types/api/OrderDto'

/**
 * Display helpers shared by the customer list, admin list and admin detail screens.
 *
 * Deliberately NARROW in scope. Order status text is never produced here: every response
 * carries `status_label` for the badge and `timeline[].label` for each progress node, and
 * the screens render those directly. What IS here is the two mappings the contract
 * requires but the payload does not carry a label for — payment status and payment
 * method — plus the one rule that decides whether the address is still editable.
 */

/** Last-resort text for an enum value no mapping covers: `OUT_FOR_DELIVERY` → "Out for delivery". */
function humanise(value: string): string {
  const spaced = value.replace(/_/g, ' ').toLowerCase()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/**
 * Text for one option in the admin's status <select>.
 *
 * The contract's rule — never hardcode status labels, the response carries them — is
 * about the badge and the progress bar, and it holds: both read `status_label` and
 * `timeline[].label`. A <select> is the one place with no response to read from, because
 * its options are statuses the order has NOT reached yet. Rather than copying the
 * contract's label table (which would be exactly the hardcoding the rule guards against,
 * and would drift the moment the backend adds a status), the enum value is derived into
 * readable text. An unrecognised value from the backend therefore still reads correctly.
 */
export function statusOptionLabel(status: string): string {
  return humanise(status)
}

/**
 * Payment status → badge text.
 *
 * `SUCCESS` reads as "Paid": the contract is explicit that there is no `PAID` value in
 * the payload and that the green badge for a settled payment says "Paid".
 */
export function paymentStatusLabel(status: string | null): string | null {
  if (!status) return null
  switch (status) {
    case 'SUCCESS':
      return 'Paid'
    case 'PENDING':
      return 'Pending'
    case 'FAILED':
      return 'Failed'
    default:
      return humanise(status)
  }
}

export type PaymentTone = 'success' | 'pending' | 'failed' | 'neutral'

/** Tone for the payment badge. An unrecognised value stays neutral rather than guessing. */
export function paymentStatusTone(status: string | null): PaymentTone {
  switch (status) {
    case 'SUCCESS':
      return 'success'
    case 'PENDING':
      return 'pending'
    case 'FAILED':
      return 'failed'
    default:
      return 'neutral'
  }
}

/**
 * Payment method → display text.
 *
 * `RAZORPAY` reads as "Online", never "UPI": the contract states the specific instrument
 * is not stored, so naming one would be asserting something the backend never said.
 */
export function paymentMethodLabel(method: string | null): string | null {
  if (!method) return null
  switch (method) {
    case 'RAZORPAY':
      return 'Online'
    case 'COD':
      return 'Cash on Delivery'
    default:
      return humanise(method)
  }
}

/**
 * Whether `PUT /v1/orders/address/` will still be accepted for this order.
 *
 * The endpoint returns 400 once an order is DELIVERED or CANCELLED, so the Edit Address
 * control is disabled for those two statuses instead of offering an action that is
 * guaranteed to fail. It stays available through SHIPPED and OUT_FOR_DELIVERY.
 */
export function isAddressEditable(status: string | null): boolean {
  if (!status) return false
  return !ADDRESS_LOCKED_STATUSES.includes(status)
}
