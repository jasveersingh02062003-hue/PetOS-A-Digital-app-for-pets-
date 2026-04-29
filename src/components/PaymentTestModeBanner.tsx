const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

export function PaymentTestModeBanner() {
  if (!clientToken?.startsWith("pk_test_")) return null;
  return (
    <div className="w-full bg-amber-100 border-b border-amber-300 px-4 py-2 text-center text-xs sm:text-sm text-amber-900">
      🧪 Test mode — use card <span className="font-mono font-semibold">4242 4242 4242 4242</span>, any future expiry, any CVC. No real money charged.
    </div>
  );
}