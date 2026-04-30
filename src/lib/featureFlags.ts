/**
 * Feature flags for temporarily disabling product surfaces without
 * deleting their code. To re-enable later, just flip the boolean.
 */

/**
 * When false, all paid checkout flows are disabled:
 *  - "Upgrade", "Buy", "Pay", "Donate", "Boost" buttons show a friendly
 *    "Payments are temporarily unavailable" toast instead of opening Stripe.
 *  - The /checkout route shows a placeholder card instead of mounting
 *    the Stripe Embedded Checkout.
 *
 * NOTE: This is a UI-only gate. The Stripe edge functions, products,
 * webhook handlers, and database tables are all left intact, so
 * re-enabling is a one-line change.
 */
export const PAYMENTS_ENABLED = false;
