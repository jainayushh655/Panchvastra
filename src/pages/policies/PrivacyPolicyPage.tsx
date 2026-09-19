import { Link } from 'react-router-dom'
import {
  PolicyList,
  PolicyPageLayout,
  PolicyPending,
  PolicySection,
} from '@/components/policy/PolicyPageLayout'

/**
 * Privacy Policy.
 *
 * Describes only data the storefront actually handles: the email/OTP sign-in, the profile
 * and address details the account pages collect, order history, wishlist and cart, the
 * restock notification email, and the browser storage the session uses. No compliance
 * certification is claimed and no retention period is invented.
 */
export function PrivacyPolicyPage() {
  return (
    <PolicyPageLayout
      title="Privacy Policy"
      intro="This page explains what information Panchvastra collects when you shop with us, why we collect it, and the choices you have."
      lastUpdated="19 September 2026"
    >
      <PolicySection heading="Information We Collect">
        <p>We collect only what we need to run the store and fulfil your orders.</p>
        <PolicyList
          items={[
            <>
              <strong>Account information</strong> — your email address, and the name and phone
              number you provide when you register or update your profile.
            </>,
            <>
              <strong>Order information</strong> — the items, sizes and colours you order, your
              delivery address, and the status and history of each order.
            </>,
            <>
              <strong>Payment information</strong> — the payment method you choose and whether
              a payment succeeded. Card and banking details are entered with our payment
              provider and are never stored by Panchvastra.
            </>,
            <>
              <strong>Things you save</strong> — items in your cart and wishlist, and any
              request to be notified when a size is back in stock.
            </>,
            <>
              <strong>Messages you send us</strong> — what you write to us by email, WhatsApp,
              phone or the contact form.
            </>,
          ]}
        />
      </PolicySection>

      <PolicySection heading="Signing In and OTP">
        <p>
          Panchvastra signs you in with a one-time password sent to your email address, so you
          do not create or store a password with us. The code is short-lived and is only used
          to confirm that the email address belongs to you.
        </p>
        <p>
          Once you are signed in, your browser keeps a session token so you stay signed in
          between visits. Signing out removes it.
        </p>
      </PolicySection>

      <PolicySection heading="Browser Storage">
        <p>
          We use your browser&apos;s local storage to keep your session token and small
          conveniences such as your cart. This information stays on your device and is not
          shared with other visitors.
        </p>
        <PolicyPending>
          Whether Panchvastra uses analytics or advertising cookies through any third-party
          tool is not established in the project. Confirm this and list those tools here if
          they are in use.
        </PolicyPending>
      </PolicySection>

      <PolicySection heading="How We Use Your Information">
        <PolicyList
          items={[
            'To create and manage your account and keep you signed in',
            'To process, pack, ship and track your orders',
            'To take payment and, where necessary, issue a refund',
            'To email you when a size you asked about is back in stock',
            'To answer your questions and provide customer support',
          ]}
        />
        <p>We do not sell your personal information.</p>
      </PolicySection>

      <PolicySection heading="Who We Share It With">
        <p>
          We share information only with the service providers needed to complete your order —
          our payment provider to take payment, and delivery partners to get your parcel to
          you. They receive only what their part of the job requires.
        </p>
        <p>
          We may also disclose information where we are required to do so by law or by a valid
          request from a public authority.
        </p>
      </PolicySection>

      <PolicySection heading="Security">
        <p>
          Traffic between your browser and Panchvastra is encrypted, access to customer data is
          restricted to the people who need it to operate the store, and payment details are
          handled by our payment provider rather than stored by us. No method of transmission
          or storage is completely secure, so we cannot guarantee absolute security.
        </p>
      </PolicySection>

      <PolicySection heading="Your Choices">
        <PolicyList
          items={[
            <>
              View and update your name, phone number and saved addresses at any time from your{' '}
              <Link to="/profile" className="font-semibold text-zinc-900 underline underline-offset-2 dark:text-white">
                profile
              </Link>
              .
            </>,
            'Ask us for a copy of the personal information we hold about you.',
            'Ask us to correct information that is wrong.',
            'Ask us to delete your account and associated personal information.',
          ]}
        />
        <p>
          Write to us using any of the contact routes below and we will respond. We may need to
          keep certain order records where we are legally required to.
        </p>
        <PolicyPending>
          How long Panchvastra retains order and account records, and the legal basis for doing
          so, is not defined in the project. Confirm retention periods before publishing.
        </PolicyPending>
      </PolicySection>

      <PolicySection heading="Children">
        <p>
          Panchvastra is intended for adults. We do not knowingly collect personal information
          from children. If you believe a child has provided us with information, contact us
          and we will remove it.
        </p>
      </PolicySection>

      <PolicySection heading="Changes to This Policy">
        <p>
          We may update this policy as the store changes. The date at the top of this page
          shows when it was last revised.
        </p>
      </PolicySection>
    </PolicyPageLayout>
  )
}
