import type { FormEvent } from 'react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useCart } from '@/context/CartProvider'
import {
  hasAddressErrors,
  validateCheckoutAddress,
  type AddressFieldErrors,
} from '@/lib/formValidation'
import { formatInr } from '@/lib/format'
import { INDIAN_STATES_AND_UT } from '@/lib/indianStates'
import { storefrontApiPath } from '@/lib/storefrontApi'
import { buildWhatsAppOrderUrl } from '@/lib/whatsappOrder'
import type { Address, Order, OrderItem } from '@/types'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { Link, useNavigate } from 'react-router-dom'

export function CheckoutPage() {
  useDocumentTitle('Checkout')
  const navigate = useNavigate()
  const { items, subtotal, clear } = useCart()

  const shipping = subtotal > 0 ? (subtotal >= 1999 ? 0 : 99) : 0
  const total = subtotal + shipping

  const [address, setAddress] = useState<Address>({
    email: '',
    fullName: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    pincode: '',
    phone: '',
  })

  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [loggedInEmail, setLoggedInEmail] = useState('')

  const [pay, setPay] = useState<'upi' | 'cod'>('upi')
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [addressErrors, setAddressErrors] = useState<AddressFieldErrors>({})

  const fieldBase =
    'w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-orange-500 dark:bg-zinc-950 dark:text-white'
  const fieldOk = 'border-zinc-200 dark:border-zinc-700'
  const fieldErr = 'border-red-500 focus:border-red-500 dark:border-red-500'
  const fieldClass = (key: keyof Address) =>
    `${fieldBase} ${addressErrors[key] ? fieldErr : fieldOk}`

  const clearAddrErr = (key: keyof Address) => {
    setAddressErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!items.length) return

    const normalized: Address = {
      ...address,
      email: address.email.trim(),
      fullName: address.fullName.trim(),
      line1: address.line1.trim(),
      line2: address.line2.trim(),
      city: address.city.trim(),
      state: address.state.trim(),
      pincode: address.pincode.replace(/\D/g, '').slice(0, 6),
      phone: address.phone.trim(),
    }
    const errs = validateCheckoutAddress(normalized)
    setAddressErrors(errs)
    if (hasAddressErrors(errs)) return

    const waDigits = (import.meta.env.VITE_WHATSAPP_NUMBER ?? '').replace(/\D/g, '')
    if (!waDigits) {
      setSubmitError('WhatsApp number is not configured (set VITE_WHATSAPP_NUMBER in .env).')
      return
    }

    setSubmitError(null)
    setBusy(true)

    const orderItems: OrderItem[] = items.map((i) => ({
      productId: i.productId,
      name: i.name,
      size: i.size,
      ...(i.color ? { color: i.color } : {}),
      quantity: i.quantity,
      price: i.price,
    }))

    const order: Order = {
      id: `PV-${Date.now().toString(36).toUpperCase()}`,
      date: new Date().toISOString(),
      total,
      status: 'processing',
      items: orderItems,
    }

    try {
      const res = await fetch(storefrontApiPath('/api/orders'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order, address: normalized, payment: pay }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        setSubmitError(
          err.error === 'INVALID_EMAIL'
            ? 'Please check your email address.'
            : err.error === 'INVALID_ADDRESS'
              ? 'Please complete all shipping fields.'
              : err.error === 'PERSIST_FAILED'
                ? 'Could not save your order. Try again in a moment.'
                : err.error === 'INTERNAL_ERROR'
                  ? 'Server error while saving your order. Try again.'
                  : 'Could not submit your order. Try again.',
        )
        setBusy(false)
        return
      }
    } catch {
      setSubmitError('Network error — could not reach the order API. Try again.')
      setBusy(false)
      return
    }

    clear()
    setBusy(false)

    const waUrl = buildWhatsAppOrderUrl(waDigits, order, normalized, pay)
    window.location.assign(waUrl)
  }

  if (!items.length) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-zinc-600 dark:text-zinc-400">
        Cart empty.{' '}
        <button
          type="button"
          className="font-semibold text-orange-500"
          onClick={() => navigate('/shop')}
        >
          Shop
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="type-page-title">Checkout</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Review your order and shipping details. We will open WhatsApp to confirm and submit your order.
      </p>
      <form onSubmit={submit} className="mt-10 grid gap-10 lg:grid-cols-[1fr_380px]" noValidate>
        <div className="space-y-8">
          <section>
            <h2 className="type-label">Contact &amp; shipping</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                {isLoggedIn ? (
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white">
                    <div className="font-semibold">Logged in as</div>
                    <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                      {loggedInEmail || 'your email'}
                    </div>
                  </div>
                ) : (
                  <>
                    <input
                      type="email"
                      autoComplete="email"
                      className={`${fieldClass('email')} w-full`}
                      placeholder="Email"
                      value={address.email}
                      onChange={(e) => {
                        setAddress({ ...address, email: e.target.value })
                        clearAddrErr('email')
                      }}
                    />
                    {addressErrors.email ? (
                      <p className="text-xs text-red-600 dark:text-red-400">{addressErrors.email}</p>
                    ) : null}
                  </>
                )}
              </div>
              <div className="space-y-1 sm:col-span-2">
                <input
                  autoComplete="name"
                  className={`${fieldClass('fullName')} w-full`}
                  placeholder="Full name"
                  value={address.fullName}
                  onChange={(e) => {
                    setAddress({ ...address, fullName: e.target.value })
                    clearAddrErr('fullName')
                  }}
                />
                {addressErrors.fullName ? (
                  <p className="text-xs text-red-600 dark:text-red-400">{addressErrors.fullName}</p>
                ) : null}
              </div>
              <div className="space-y-1 sm:col-span-2">
                <input
                  autoComplete="address-line1"
                  className={`${fieldClass('line1')} w-full`}
                  placeholder="Address line 1"
                  value={address.line1}
                  onChange={(e) => {
                    setAddress({ ...address, line1: e.target.value })
                    clearAddrErr('line1')
                  }}
                />
                {addressErrors.line1 ? (
                  <p className="text-xs text-red-600 dark:text-red-400">{addressErrors.line1}</p>
                ) : null}
              </div>
              <input
                autoComplete="address-line2"
                className={`${fieldBase} ${fieldOk} sm:col-span-2`}
                placeholder="Address line 2 (optional)"
                value={address.line2}
                onChange={(e) => setAddress({ ...address, line2: e.target.value })}
              />
              <div className="space-y-1">
                <input
                  autoComplete="address-level2"
                  className={`${fieldClass('city')} w-full`}
                  placeholder="City"
                  value={address.city}
                  onChange={(e) => {
                    setAddress({ ...address, city: e.target.value })
                    clearAddrErr('city')
                  }}
                />
                {addressErrors.city ? (
                  <p className="text-xs text-red-600 dark:text-red-400">{addressErrors.city}</p>
                ) : null}
              </div>
              <div className="space-y-1">
                <label htmlFor="checkout-state" className="sr-only">
                  State
                </label>
                <select
                  id="checkout-state"
                  autoComplete="address-level1"
                  className={`${fieldClass('state')} w-full cursor-pointer`}
                  value={address.state}
                  onChange={(e) => {
                    setAddress({ ...address, state: e.target.value })
                    clearAddrErr('state')
                  }}
                >
                  <option value="">Select state / UT</option>
                  {INDIAN_STATES_AND_UT.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                {addressErrors.state ? (
                  <p className="text-xs text-red-600 dark:text-red-400">{addressErrors.state}</p>
                ) : null}
              </div>
              <div className="space-y-1">
                <input
                  autoComplete="postal-code"
                  inputMode="numeric"
                  maxLength={8}
                  className={`${fieldClass('pincode')} w-full`}
                  placeholder="PIN code (6 digits)"
                  value={address.pincode}
                  onChange={(e) => {
                    setAddress({ ...address, pincode: e.target.value })
                    clearAddrErr('pincode')
                  }}
                />
                {addressErrors.pincode ? (
                  <p className="text-xs text-red-600 dark:text-red-400">{addressErrors.pincode}</p>
                ) : null}
              </div>
              <div className="space-y-1">
                <input
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  className={`${fieldClass('phone')} w-full`}
                  placeholder="Phone"
                  value={address.phone}
                  onChange={(e) => {
                    setAddress({ ...address, phone: e.target.value })
                    clearAddrErr('phone')
                  }}
                />
                {addressErrors.phone ? (
                  <p className="text-xs text-red-600 dark:text-red-400">{addressErrors.phone}</p>
                ) : null}
              </div>
            </div>
          </section>

          <section>
            <h2 className="type-label">Payment (UI)</h2>
            <div className="mt-4 space-y-2">
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                <input
                  type="radio"
                  name="pay"
                  checked={pay === 'upi'}
                  onChange={() => setPay('upi')}
                  className="accent-orange-500"
                />
                <span className="text-sm text-zinc-800 dark:text-zinc-100">UPI / Cards (Stripe-ready)</span>
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                <input
                  type="radio"
                  name="pay"
                  checked={pay === 'cod'}
                  onChange={() => setPay('cod')}
                  className="accent-orange-500"
                />
                <span className="text-sm text-zinc-800 dark:text-zinc-100">Cash on delivery</span>
              </label>
            </div>
            <p className="mt-2 text-[11px] text-zinc-500">
              After submit you will open WhatsApp with this order prefilled — no live payment yet.
            </p>
          </section>

          {submitError ? (
            <p className="text-sm font-medium text-red-600 dark:text-red-400" role="alert">
              {submitError}
            </p>
          ) : null}

          <Button size="lg" type="submit" disabled={busy} className="w-full sm:w-auto">
            {busy ? 'Saving…' : 'Submit order'}
          </Button>
        </div>

        <aside className="h-fit rounded-3xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900/60">
          <p className="type-label">Order summary</p>
          <ul className="mt-4 max-h-48 space-y-2 overflow-y-auto text-sm text-zinc-600 dark:text-zinc-400">
            {items.map((i) => (
              <li key={i.key} className="flex justify-between gap-2">
                <span className="truncate">
                  {i.name} ×{i.quantity}
                </span>
                <span>{formatInr(i.price * i.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 space-y-1 border-t border-zinc-200 pt-4 text-sm dark:border-zinc-800">
            <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
              <span>Subtotal</span>
              <span>{formatInr(subtotal)}</span>
            </div>
            <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
              <span>Shipping</span>
              <span>{shipping === 0 ? 'Free' : formatInr(shipping)}</span>
            </div>
            <div className="flex justify-between pt-2 text-lg font-bold text-zinc-900 dark:text-white">
              <span>Total</span>
              <span>{formatInr(total)}</span>
            </div>
          </div>
          <p className="mt-4 text-[11px] text-zinc-500">
            Need help first?{' '}
            <Link to="/contact" className="font-semibold text-orange-600 dark:text-orange-400">
              Contact
            </Link>
          </p>
        </aside>
      </form>
    </div>
  )
}
