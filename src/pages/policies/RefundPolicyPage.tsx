import { Link } from 'react-router-dom'
import {
  PolicyList,
  PolicyPageLayout,
  PolicyPending,
  PolicySection,
} from '@/components/policy/PolicyPageLayout'

/**
 * Refund Policy.
 *
 * Every concrete commitment here is one the project already makes elsewhere — the 7-day
 * exchange shown on each product page, the COD and online payment methods the checkout
 * supports, and the order statuses the backend defines. Anything not established in the
 * project (windows, fees, who pays return shipping) is flagged rather than invented.
 */
export function RefundPolicyPage() {
  return (
    <PolicyPageLayout
      title="Refund Policy"
      intro="We want you to be happy with what you wear. This page explains how returns, exchanges and refunds work on orders placed at Panchvastra."
      lastUpdated="19 September 2026"
    >
      <PolicySection heading="Overview">
        <p>
          Panchvastra sells directly to customers across India. If something is not right with
          your order, contact us and we will work with you to resolve it — whether that is an
          exchange, a replacement or a refund.
        </p>
        <p>
          Each product page lists a <strong>7 Days Exchange Policy</strong> in its highlights.
          That window runs from the date your order is delivered.
        </p>
      </PolicySection>

      <PolicySection heading="Eligibility">
        <p>To be considered for a return or exchange, an item should generally be:</p>
        <PolicyList
          items={[
            'Unused, unwashed and in the same condition in which you received it',
            'In its original packaging with any tags still attached',
            'Accompanied by the order number shown in your account under Orders',
          ]}
        />
        <PolicyPending>
          Whether items bought on discount, during a sale, or as part of a bundle are eligible
          for return has not been defined for Panchvastra. Confirm this before publishing.
        </PolicyPending>
      </PolicySection>

      <PolicySection heading="How to Start a Return or Exchange">
        <p>
          Raise a request within the exchange window by contacting us on WhatsApp, by phone or
          by email — all listed at the bottom of this page. Please include:
        </p>
        <PolicyList
          items={[
            'Your order number',
            'The item and size concerned',
            'What you would like — an exchange, a replacement, or a refund',
            'Photographs, if the item arrived damaged or is not what you ordered',
          ]}
        />
        <p>
          You can find your order number and its current status at any time under{' '}
          <Link to="/orders" className="font-semibold text-zinc-900 underline underline-offset-2 dark:text-white">
            My Orders
          </Link>
          .
        </p>
        <PolicyPending>
          The pickup/reverse-logistics arrangement — whether Panchvastra collects the item or
          you ship it back, and who bears that cost — is not defined in the project. Confirm
          before publishing.
        </PolicyPending>
      </PolicySection>

      <PolicySection heading="Items We Cannot Accept Back">
        <p>
          For hygiene and safety reasons, items that have been worn, washed, altered or damaged
          after delivery cannot be accepted, and neither can items returned without their
          original tags or packaging.
        </p>
        <PolicyPending>
          Any further non-returnable categories Panchvastra wishes to declare — for example
          innerwear, accessories or final-sale items — need to be confirmed and listed here.
        </PolicyPending>
      </PolicySection>

      <PolicySection heading="Damaged, Defective or Incorrect Items">
        <p>
          If your parcel arrives damaged, or the item inside is defective or not the one you
          ordered, tell us as soon as you can and send photographs of the item and the
          packaging. We will arrange a replacement or a refund at no additional cost to you.
        </p>
      </PolicySection>

      <PolicySection heading="Refund Processing">
        <p>
          Once a return is approved, refunds are issued to the original payment method:
        </p>
        <PolicyList
          items={[
            'Orders paid online are refunded to the account or instrument used at checkout, through our payment provider.',
            'Cash on Delivery orders are refunded to a bank account you confirm with us, since there is no original online payment to reverse.',
          ]}
        />
        <p>
          After a refund is issued, the time it takes to appear on your statement is determined
          by your bank or payment provider, not by Panchvastra.
        </p>
        <PolicyPending>
          The number of days Panchvastra commits to for approving a return and initiating a
          refund is not defined in the project. Confirm the exact turnaround before publishing.
        </PolicyPending>
      </PolicySection>

      <PolicySection heading="Cancellations">
        <p>
          An order can be cancelled before it is dispatched. Order status is visible under My
          Orders and moves through placed, confirmed, packed, shipped and out for delivery
          before it is marked delivered. Once an order has been shipped it can no longer be
          cancelled, and the return process above applies instead.
        </p>
      </PolicySection>
    </PolicyPageLayout>
  )
}
