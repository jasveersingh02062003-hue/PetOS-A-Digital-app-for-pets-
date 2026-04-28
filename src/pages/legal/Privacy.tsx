import { LegalLayout } from "@/components/LegalLayout";

const Privacy = () => (
  <LegalLayout title="Privacy Policy" lastUpdated="April 2026">
    <p>Your data, your pet, your rules. This policy explains what we collect and why, in line with India's <strong>Digital Personal Data Protection Act, 2023</strong>.</p>

    <h2 className="font-display text-xl mt-6">1. What we collect</h2>
    <ul className="list-disc pl-5 space-y-1">
      <li><strong>Account:</strong> name, email, phone (optional), city.</li>
      <li><strong>Pet data:</strong> profiles, vaccination records, symptoms, photos you upload.</li>
      <li><strong>Usage:</strong> which screens you visit, errors, basic device info — to improve the app.</li>
      <li><strong>Location:</strong> only if you share a missing-pet sighting or request nearby services.</li>
    </ul>

    <h2 className="font-display text-xl mt-6">2. Why we collect it</h2>
    <p>To run the service: keep your records, send health reminders, alert neighbours about missing pets, connect you with vets and providers.</p>

    <h2 className="font-display text-xl mt-6">3. Who can see it</h2>
    <ul className="list-disc pl-5 space-y-1">
      <li>You — always.</li>
      <li>Vets you grant temporary access to via a vault code.</li>
      <li>Service providers — only the booking details you submit.</li>
      <li>Other users — only what you choose to make public (posts, mating-discoverable pet profiles).</li>
    </ul>
    <p>We <strong>never sell</strong> your data.</p>

    <h2 className="font-display text-xl mt-6">4. AI processing</h2>
    <p>When you use Petos AI, your message and the relevant pet context are sent to our AI provider for processing. The provider does not retain it for training. We log the request for safety review for 30 days, then delete.</p>

    <h2 className="font-display text-xl mt-6">5. Your rights (DPDP Act)</h2>
    <ul className="list-disc pl-5 space-y-1">
      <li><strong>Access</strong> — download your data from Profile → Export.</li>
      <li><strong>Correct</strong> — edit anything in Settings.</li>
      <li><strong>Erase</strong> — delete your account from Profile → Delete account. We remove personal data within 30 days.</li>
      <li><strong>Withdraw consent</strong> — for notifications, marketing, location.</li>
    </ul>

    <h2 className="font-display text-xl mt-6">6. Storage and security</h2>
    <p>Data is stored on encrypted servers. Access is gated by row-level security so users can only read their own records. Only authorised admins can review reports and moderation queues.</p>

    <h2 className="font-display text-xl mt-6">7. Children</h2>
    <p>Petos is not intended for users under 18.</p>

    <h2 className="font-display text-xl mt-6">8. Grievance contact</h2>
    <p>Per the DPDP Act, our Grievance Officer can be reached at <a className="underline" href="mailto:privacy@petos.app">privacy@petos.app</a>. We aim to respond within 7 days.</p>
  </LegalLayout>
);

export default Privacy;
