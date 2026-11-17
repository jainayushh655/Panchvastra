import { Link } from 'react-router-dom'
import { PolicyPageLayout, PolicyPending, PolicySection } from '@/components/policy/PolicyPageLayout'

/**
 * Terms of Service.
 *
 * Kept to terms the storefront actually supports — accounts via email/OTP, orders, the
 * payment methods checkout offers, stock behaviour, and the exchange window shown on
 * product pages. Governing law, the registered entity and any liability cap are flagged
 * rather than asserted, since none of them appear anywhere in this project.
 */
export function TermsOfServicePage() {
  return (
    <PolicyPageLayout
      title="Terms of Service"
      intro="These terms apply when you browse or buy from the Panchvastra website. By placing an order you agree to them."
      lastUpdated="19 September 2026"
    >
      <PolicySection heading="Using This Website">
        <p>
          You may browse and shop for your own personal, non-commercial use. Please do not
          attempt to disrupt the site, access areas you are not authorised to use, or copy the
          site for a competing service.
        </p>
      </PolicySection>

      <PolicySection heading="Your Account">
        <p>
          You sign in with a one-time code sent to your email address. Keep access to that
          inbox secure — anyone who can read the code can sign in as you. Tell us promptly if
          you think someone else has used your account.
        </p>
        <p>
          You are responsible for keeping the details on your account, including your delivery
          address and phone number, accurate and up to date.
        </p>
      </PolicySection>

      <PolicySection heading="Products and Product Information">
        <p>
          We describe our products — fabric, GSM, fit, colour and size — as accurately as we
          can. Photographs are taken to represent the product faithfully, but colours can look
          different between screens, and small variation is normal in garments.
        </p>
        <p>
          We try to keep stock accurate. If a size is unavailable you can ask to be notified
          when it returns, and we will email you once it is back.
        </p>
      </PolicySection>

      <PolicySection heading="Orders">
        <p>
          An order is an offer to buy. We confirm it once it has been accepted, and you can
          follow its progress under{' '}
          <Link to="/orders" className="font-semibold text-zinc-900 underline underline-offset-2 dark:text-white">
            My Orders
          </Link>{' '}
          as it moves from placed through confirmed, packed, shipped and out for delivery to
          delivered.
        </p>
        <p>
          We may decline or cancel an order — for example where an item is out of stock, where
          there has been an obvious pricing error, or where we cannot verify the delivery
          details. If you have already paid for a cancelled order, we refund it.
        </p>
      </PolicySection>

      <PolicySection heading="Pricing and Payment">
        <p>
          Prices are shown in Indian Rupees. We accept payment online through our payment
          provider, and Cash on Delivery where it is offered at checkout. Any discount applied
          by a coupon is shown before you confirm the order.
        </p>
        <p>
          We take reasonable care with pricing, but if an item is listed at an obviously
          incorrect price we may cancel the order and refund you rather than fulfil it.
        </p>
        <PolicyPending>
          Whether prices are inclusive of GST, and how shipping charges are calculated, are not
          defined in the project. Confirm both and state them here before publishing.
        </PolicyPending>
      </PolicySection>

      <PolicySection heading="Delivery">
        <p>
          We ship across India. Delivery timelines depend on your location and our delivery
          partner, and are estimates rather than guarantees.
        </p>
        <PolicyPending>
          Specific delivery timelines, serviceable pin codes and any free-shipping threshold
          are not defined in the project. Confirm before publishing.
        </PolicyPending>
      </PolicySection>

      <PolicySection heading="Returns and Refunds">
        <p>
          Returns, exchanges and refunds are covered by our{' '}
          <Link to="/policies/refund-policy" className="font-semibold text-zinc-900 underline underline-offset-2 dark:text-white">
            Refund Policy
          </Link>
          , which forms part of these terms.
        </p>
      </PolicySection>

      <PolicySection heading="Intellectual Property">
        <p>
          The Panchvastra name, logo, product photography, graphics and site content belong to
          Panchvastra and may not be reproduced, sold or used commercially without our written
          permission.
        </p>
      </PolicySection>

      <PolicySection heading="Privacy">
        <p>
          How we handle your information is set out in our{' '}
          <Link to="/policies/privacy-policy" className="font-semibold text-zinc-900 underline underline-offset-2 dark:text-white">
            Privacy Policy
          </Link>
          .
        </p>
      </PolicySection>

      <PolicySection heading="General">
        <p>
          The site is provided on an as-is basis, and we do not promise it will always be
          available or entirely free of errors. Nothing in these terms limits any right you
          have under applicable consumer law.
        </p>
        <p>
          We may update these terms as the store changes. The date at the top of this page
          shows when they were last revised.
        </p>
        <PolicyPending>
          The registered business entity behind Panchvastra, its registered address, GSTIN, the
          governing law and jurisdiction for disputes, and any limitation of liability are not
          recorded anywhere in this project. These need to be supplied by Panchvastra — ideally
          reviewed by a lawyer — before these terms are relied on.
        </PolicyPending>
      </PolicySection>
    </PolicyPageLayout>
  )
}
