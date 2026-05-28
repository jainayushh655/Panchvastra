/** Storefront WhatsApp chat (same number as checkout when configured). */
export function whatsAppPageUrl(): string {
  const n = (import.meta.env.VITE_WHATSAPP_NUMBER ?? '').replace(/\D/g, '')
  return n ? `https://wa.me/${n}` : 'https://wa.me/'
}

/** Click-to-call — uses the same number as WhatsApp when configured. */
export function phoneCallUrl(): string {
  const n = (import.meta.env.VITE_WHATSAPP_NUMBER ?? '').replace(/\D/g, '')
  return n ? `tel:+${n}` : '/contact'
}

/** Panchvastra Instagram — override with VITE_INSTAGRAM_URL if the handle differs. */
export function instagramPageUrl(): string {
  const u = import.meta.env.VITE_INSTAGRAM_URL?.trim()
  if (u) return u
  return 'https://www.instagram.com/panchvastra_'
}
