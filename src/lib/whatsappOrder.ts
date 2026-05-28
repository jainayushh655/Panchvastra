import { formatInr } from '@/lib/format'
import type { Address, Order } from '@/types'

const MAX_LEN = 1700

function buildMessage(order: Order, address: Address, payment: 'upi' | 'cod'): string {
  const payLabel = payment === 'cod' ? 'Cash on delivery' : 'UPI / Cards (as discussed)'
  const lines = order.items.map(
    (it) =>
      `• ${it.name} — ${it.size}${it.color ? ` · ${it.color}` : ''} ×${it.quantity} (${formatInr(it.price)} each)`,
  )
  const body = [
    `*New order ${order.id}*`,
    '',
    `Total: *${formatInr(order.total)}*`,
    `Payment: ${payLabel}`,
    '',
    '*Customer*',
    address.fullName.trim(),
    address.email.trim(),
    address.phone.trim(),
    '',
    '*Shipping address*',
    address.line1.trim(),
    address.line2.trim() || '—',
    `${address.city.trim()}, ${address.state.trim()} ${address.pincode}`,
    '',
    '*Items*',
    ...lines,
  ].join('\n')
  if (body.length <= MAX_LEN) return body
  return `${body.slice(0, MAX_LEN - 24)}\n…(message trimmed)`
}

/** `digits` = WhatsApp business number with country code, digits only (e.g. 919876543210). */
export function buildWhatsAppOrderUrl(
  digits: string,
  order: Order,
  address: Address,
  payment: 'upi' | 'cod',
): string {
  const n = digits.replace(/\D/g, '')
  const text = buildMessage(order, address, payment)
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`
}
