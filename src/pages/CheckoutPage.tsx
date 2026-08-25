import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { CouponSection, type AppliedCoupon } from '@/components/checkout/CouponSection'
import { DeliveryAddressSection } from '@/components/checkout/DeliveryAddressSection'
import { useAddresses } from '@/context/AddressProvider'
import { useCart } from '@/context/CartProvider'
import { hasAddressErrors, validateCheckoutAddress } from '@/lib/formValidation'
import { formatInr } from '@/lib/format'
import { storefrontApiPath } from '@/lib/storefrontApi'
import { buildWhatsAppOrderUrl } from '@/lib/whatsappOrder'
import type { Address, Order, OrderItem } from '@/types'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useAuth } from '@/context/AuthProvider'
import { Link, useNavigate } from 'react-router-dom'

export function CheckoutPage() {
  useDocumentTitle('Checkout')
  const navigate = useNavigate()
  const { items, subtotal, totalDiscount, clear } = useCart()
  const { user } = useAuth()
  const {
    addresses,
    loading: addressesLoading,
    error: addressesError,
    refresh: refreshAddresses,
    addAddress,
    updateAddress,
  } = useAddresses()

  // Existing calculation, unchanged.
  const shipping = subtotal > 0 ? (subtotal >= 1999 ? 0 : 99) : 0

  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  const [addressError, setAddressError] = useState<string | null>(null)
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null)

  const [pay, setPay] = useState<'upi' | 'cod'>('upi')
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Default to the default address, else the first saved one, whenever the currently
  // selected id becomes invalid (initial load, or the selected address was deleted).
  useEffect(() => {
    if (selectedAddressId && addresses.some((a) => a.id === selectedAddressId)) return
    const fallback = addresses.find((a) => a.isDefault) ?? addresses[0]
    setSelectedAddressId(fallback?.id ?? null)
  }, [addresses, selectedAddressId])

  // `subtotal` already reflects the backend's real per-item discount (cart item selling
  // price). `totalDiscount` (cart.summary.total_discount) is shown for transparency only
  // and is NOT subtracted again here — doing so would double-count it.
  const couponDiscount = appliedCoupon?.discountAmount ?? 0
  const total = subtotal + shipping - couponDiscount

  const submit = async () => {
    if (!items.length) return

    const selectedAddress = addresses.find((a) => a.id === selectedAddressId)
    if (!selectedAddress) {
      setAddressError('Please select a delivery address.')
      return
    }

    // Adapts the selected address-book entry to the existing order API's address shape —
    // that contract predates the Profile Address Book and has no id/type/landmark/country
    // fields, so those aren't sent; the flow this endpoint already validates is preserved.
    const normalized: Address = {
      email: (user?.email ?? '').trim(),
      fullName: selectedAddress.fullName.trim(),
      line1: selectedAddress.addressLine1.trim(),
      line2: [selectedAddress.addressLine2, selectedAddress.landmark].filter(Boolean).join(', '),
      city: selectedAddress.city.trim(),
      state: selectedAddress.state.trim(),
      pincode: selectedAddress.postalCode.replace(/\D/g, '').slice(0, 6),
      phone: selectedAddress.phone.trim(),
    }
    const errs = validateCheckoutAddress(normalized)
    if (hasAddressErrors(errs)) {
      setAddressError('Please check your saved address details and try again.')
      return
    }
    setAddressError(null)

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
          className="font-semibold text-black underline underline-offset-2 dark:text-white"
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
        Review your delivery address and order. We will open WhatsApp to confirm and submit your order.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <DeliveryAddressSection
            addresses={addresses}
            loading={addressesLoading}
            loadError={addressesError}
            onRetry={refreshAddresses}
            selectedAddressId={selectedAddressId}
            onSelectAddress={setSelectedAddressId}
            onAddAddress={addAddress}
            onUpdateAddress={updateAddress}
            error={addressError}
          />

          <section className="border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="type-section-title">Your Order</h2>
            <ul className="mt-5 divide-y divide-zinc-100 dark:divide-zinc-900">
              {items.map((i) => (
                <li key={i.key} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                  <img
                    src={i.image}
                    alt=""
                    className="h-20 w-16 shrink-0 border border-zinc-200 object-cover dark:border-zinc-800"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-sans text-sm font-semibold text-black dark:text-white">{i.name}</p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      Size {i.size}
                      {i.color ? ` · ${i.color}` : ''} · Qty {i.quantity}
                    </p>
                  </div>
                  <p className="shrink-0 font-sans text-sm font-semibold text-black dark:text-white">
                    {formatInr(i.price * i.quantity)}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          {submitError ? (
            <p className="text-sm font-medium text-red-600 dark:text-red-400" role="alert">
              {submitError}
            </p>
          ) : null}
        </div>

        <aside className="h-fit space-y-6 border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <div>
            <h2 className="type-section-title">Order Summary</h2>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>Subtotal</span>
                <span>{formatInr(subtotal)}</span>
              </div>
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>Shipping</span>
                <span>{shipping === 0 ? 'Free' : formatInr(shipping)}</span>
              </div>
              {totalDiscount > 0 ? (
                <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                  <span>Discount</span>
                  <span>-{formatInr(totalDiscount)}</span>
                </div>
              ) : null}
              {couponDiscount > 0 ? (
                <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                  <span>Coupon</span>
                  <span>-{formatInr(couponDiscount)}</span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="border-t border-zinc-200 pt-5 dark:border-zinc-800">
            <CouponSection
              cartTotal={subtotal}
              appliedCoupon={appliedCoupon}
              onApplied={setAppliedCoupon}
              onRemoved={() => setAppliedCoupon(null)}
            />
          </div>

          <div className="flex justify-between border-t border-zinc-200 pt-4 text-lg font-bold text-zinc-900 dark:border-zinc-800 dark:text-white">
            <span>Total</span>
            <span>{formatInr(total)}</span>
          </div>

          <div className="border-t border-zinc-200 pt-5 dark:border-zinc-800">
            <p className="type-label">Payment</p>
            <div className="mt-3 space-y-2">
              <label className="flex cursor-pointer items-center gap-3 border border-zinc-200 p-3 dark:border-zinc-800">
                <input
                  type="radio"
                  name="pay"
                  checked={pay === 'upi'}
                  onChange={() => setPay('upi')}
                  className="accent-black"
                />
                <span className="text-sm text-zinc-800 dark:text-zinc-100">UPI / Cards</span>
              </label>
              <label className="flex cursor-pointer items-center gap-3 border border-zinc-200 p-3 dark:border-zinc-800">
                <input
                  type="radio"
                  name="pay"
                  checked={pay === 'cod'}
                  onChange={() => setPay('cod')}
                  className="accent-black"
                />
                <span className="text-sm text-zinc-800 dark:text-zinc-100">Cash on delivery</span>
              </label>
            </div>
            <p className="mt-2 text-[11px] text-zinc-500">
              After submit you will open WhatsApp with this order prefilled — no live payment yet.
            </p>
          </div>

          <Button size="lg" type="button" onClick={submit} disabled={busy} className="w-full">
            {busy ? 'Saving…' : 'Place Order'}
          </Button>

          <p className="text-[11px] text-zinc-500">
            Need help first?{' '}
            <Link to="/contact" className="font-semibold text-black underline underline-offset-2 dark:text-white">
              Contact
            </Link>
          </p>
        </aside>
      </div>
    </div>
  )
}
