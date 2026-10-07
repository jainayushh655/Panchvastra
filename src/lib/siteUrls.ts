/**
 * Panchvastra's business number in international format: digits only, country code first,
 * no `+` and no spaces. Shared by the WhatsApp chat link and click-to-call, which the
 * helpers below have always treated as the same number.
 */
const BUSINESS_PHONE_NUMBER = '919343356697'

/**
 * Storefront WhatsApp chat (same number as checkout when configured).
 *
 * Falls back to the business number so the link always opens a real chat — without one,
 * an unset `VITE_WHATSAPP_NUMBER` produced a bare `https://wa.me/` that opened nothing.
 * This mirrors how `instagramPageUrl` already defaults.
 */
export function whatsAppPageUrl(): string {
  const n = (import.meta.env.VITE_WHATSAPP_NUMBER ?? '').replace(/\D/g, '')
  return `https://wa.me/${n || BUSINESS_PHONE_NUMBER}`
}

/**
 * Click-to-call — uses the same number as WhatsApp when configured.
 *
 * Falls back to the business number so the icon always opens the device dialer. Without
 * one, an unset `VITE_WHATSAPP_NUMBER` sent the phone icon to the Contact page instead.
 */
export function phoneCallUrl(): string {
  const n = (import.meta.env.VITE_WHATSAPP_NUMBER ?? '').replace(/\D/g, '')
  return `tel:+${n || BUSINESS_PHONE_NUMBER}`
}

/** Panchvastra Instagram — override with VITE_INSTAGRAM_URL if the handle differs. */
export function instagramPageUrl(): string {
  const u = import.meta.env.VITE_INSTAGRAM_URL?.trim()
  if (u) return u
  return 'https://www.instagram.com/panchvastra_'
}

/**
 * Panchvastra's support inbox.
 *
 * The same address the policy pages publish, kept here so the Help Desk and anything added
 * later read it from one place rather than each repeating the literal. Overridable with
 * `VITE_SUPPORT_EMAIL` for a staging inbox.
 */
const SUPPORT_EMAIL = 'panchvastra9@gmail.com'

export function supportEmail(): string {
  return import.meta.env.VITE_SUPPORT_EMAIL?.trim() || SUPPORT_EMAIL
}

export function supportEmailUrl(): string {
  return `mailto:${supportEmail()}`
}

/** The Instagram handle shown beside the link, derived from the profile URL. */
export function instagramHandle(): string {
  const path = instagramPageUrl().replace(/\/+$/, '').split('/').pop()
  return path ? `@${path}` : '@panchvastra_'
}
