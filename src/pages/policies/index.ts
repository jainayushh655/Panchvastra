/**
 * One entry point for the three policy pages, so they share a single lazy chunk.
 *
 * Each is a few kilobytes of static copy and is almost never opened. Splitting them into
 * three chunks would mean three separate requests for less than one request's worth of
 * content — and anyone reading the refund policy is reasonably likely to open the privacy
 * one next, by which point it is already cached.
 */
export { RefundPolicyPage } from './RefundPolicyPage'
export { PrivacyPolicyPage } from './PrivacyPolicyPage'
export { TermsOfServicePage } from './TermsOfServicePage'
