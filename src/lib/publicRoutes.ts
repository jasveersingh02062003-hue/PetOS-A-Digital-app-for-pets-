export const PUBLIC_ROUTES = [
  "/",
  "/auth",
  "/welcome",
  "/v/",
  "/breeds",
  "/quiz",
  "/cost-calculator",
  "/care-guide",
  "/mates",
  "/services",
  "/vets",
  "/shelters",
  "/missing",
  "/ask-vet",
  "/adopt",
  "/explore",
  "/pet/",
  "/how-it-works",
  "/find-my-pet"
];

export const isPublicRoute = (pathname: string): boolean => {
  // Allow root to be public? 
  // No, the default app redirects to welcome or auth. But if the user lands on an inner public route, it's fine.
  // Actually, wait, if root "/" is a landing page for public users, we might want to make it public eventually.
  // But for now, we follow the list.
  return PUBLIC_ROUTES.some(p => pathname.startsWith(p));
};
