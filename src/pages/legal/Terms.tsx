import { LegalLayout } from "@/components/LegalLayout";

const Terms = () => (
  <LegalLayout title="Terms of Service" lastUpdated="April 2026">
    <p>Welcome to Petos. By creating an account you agree to these terms. Please read them — they are written in plain English.</p>

    <h2 className="font-display text-xl mt-6">1. What Petos is</h2>
    <p>Petos is a pet-care app for Indian pet parents. We help you keep health records, find services, log symptoms, and connect with vets. Petos is currently in <strong>invite-only beta</strong>.</p>

    <h2 className="font-display text-xl mt-6">2. Not a substitute for veterinary care</h2>
    <p>Petos AI and any guidance shown in the app provide <strong>general information only</strong>. They are not a medical diagnosis. For any urgent issue — bleeding, breathing trouble, seizures, suspected poisoning — contact a licensed veterinarian or your nearest emergency clinic immediately.</p>

    <h2 className="font-display text-xl mt-6">3. Your account</h2>
    <ul className="list-disc pl-5 space-y-1">
      <li>You must be 18 or older.</li>
      <li>You're responsible for keeping your password safe.</li>
      <li>One account per person. You can delete it any time from Profile → Delete account.</li>
    </ul>

    <h2 className="font-display text-xl mt-6">4. Content you post</h2>
    <p>You own what you post. By posting, you give Petos a non-exclusive licence to display it within the app. Don't post anything illegal, hateful, deceptive, or that infringes someone else's rights. We may remove content that violates these terms.</p>

    <h2 className="font-display text-xl mt-6">5. Marketplace and bookings</h2>
    <p>Petos lets independent service providers and sellers list services and products. We are <strong>not a party</strong> to those transactions. Disputes are between you and the provider, but report misconduct and we will act.</p>

    <h2 className="font-display text-xl mt-6">6. Petos Plus</h2>
    <p>Plus is currently in pre-launch. No charges are taken until you opt in after launch.</p>

    <h2 className="font-display text-xl mt-6">7. Changes</h2>
    <p>We may update these terms. Material changes will be notified in-app at least 7 days before they take effect.</p>

    <h2 className="font-display text-xl mt-6">8. Contact</h2>
    <p>Questions? Email <a className="underline" href="mailto:hello@petos.app">hello@petos.app</a>.</p>
  </LegalLayout>
);

export default Terms;
