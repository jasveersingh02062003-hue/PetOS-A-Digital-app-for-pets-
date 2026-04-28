import { LegalLayout } from "@/components/LegalLayout";

const Refunds = () => (
  <LegalLayout title="Refunds & Cancellations" lastUpdated="April 2026">
    <p>Petos is currently in invite-only beta. <strong>No subscription charges are taken</strong> at this time.</p>

    <h2 className="font-display text-xl mt-6">When real billing begins</h2>
    <ul className="list-disc pl-5 space-y-1">
      <li><strong>Petos Plus subscription:</strong> cancel any time from Settings → Billing. You keep Plus until the end of the current billing period; no pro-rata refund.</li>
      <li><strong>First-time Plus signup:</strong> 7-day full refund if you change your mind, no questions asked. Email <a className="underline" href="mailto:hello@petos.app">hello@petos.app</a>.</li>
      <li><strong>Service bookings:</strong> handled directly with the provider per their cancellation policy. Petos can mediate but is not a party to the booking.</li>
      <li><strong>Marketplace orders:</strong> sellers set their own return policy, displayed on the product page. Defective items can be reported in-app within 7 days of delivery.</li>
      <li><strong>Vet consults:</strong> if a vet does not respond within the SLA, the consult fee is auto-refunded.</li>
    </ul>

    <p className="mt-6">All refunds are processed to the original payment method within 7 working days of approval.</p>
  </LegalLayout>
);

export default Refunds;
