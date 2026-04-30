import { lazy, Suspense } from "react";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { queryClient, idbPersister, PERSIST_BUSTER, shouldPersistQuery } from "@/lib/queryClient";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { CartProvider } from "@/hooks/useCart";
import { PresenceProvider } from "@/hooks/usePresence";
import { AppShell } from "@/components/AppShell";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Splash } from "./components/Splash";
import { RouteFallback } from "./components/RouteFallback";
import { logError } from "./lib/logError";
import { FirstRunGate } from "./components/FirstRunGate";
import { RouteErrorBoundary } from "./components/RouteErrorBoundary";
import { RouteTracker } from "./components/RouteTracker";
import { NetworkStatus } from "./components/NetworkStatus";
import { ConsentBanner } from "./components/ConsentBanner";
import { DeferredMount } from "./components/DeferredMount";

// Heavy non-critical: realtime subscriptions, intent replay, install nudge — load after first paint
const RealtimeBridge = lazy(() => import("./components/RealtimeBridge").then(m => ({ default: m.RealtimeBridge })));
const IntentReplay = lazy(() => import("./components/IntentReplay").then(m => ({ default: m.IntentReplay })));
const InstallNudgeSheet = lazy(() => import("./components/InstallNudgeSheet").then(m => ({ default: m.InstallNudgeSheet })));

// Eager — only the entry route the user sees first.
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import Welcome from "./pages/Welcome";
import NotFound from "./pages/NotFound";
import PostAuth from "./pages/PostAuth";

// Lazy — every other route, code-split into separate chunks
const Discover = lazy(() => import("./pages/Discover"));
const Mates = lazy(() => import("./pages/Mates"));
const Health = lazy(() => import("./pages/Health"));
const HealthAlerts = lazy(() => import("./pages/HealthAlerts"));
const HealthCompare = lazy(() => import("./pages/HealthCompare"));
const Services = lazy(() => import("./pages/Services"));
const Profile = lazy(() => import("./pages/Profile"));
const Explore = lazy(() => import("./pages/Explore"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const AiChat = lazy(() => import("./pages/AiChat"));
const VaultView = lazy(() => import("./pages/VaultView"));
const RescueJourneyDetail = lazy(() => import("./pages/RescueJourneyDetail"));
const VetConsult = lazy(() => import("./pages/VetConsult"));
const MatesNew = lazy(() => import("./pages/MatesNew"));
const MateListing = lazy(() => import("./pages/MateListing"));
const MatesManage = lazy(() => import("./pages/MatesManage"));
const AdoptListingNew = lazy(() => import("./pages/AdoptListingNew"));
const AdoptionInbox = lazy(() => import("./pages/AdoptionInbox"));
const AdoptListingDetail = lazy(() => import("./pages/AdoptListingDetail"));
const Shelters = lazy(() => import("./pages/Shelters"));
const ServiceDetail = lazy(() => import("./pages/ServiceDetail"));
const ServiceNew = lazy(() => import("./pages/ServiceNew"));
const ServicesManage = lazy(() => import("./pages/ServicesManage"));
const RecurringBookings = lazy(() => import("./pages/RecurringBookings"));
const BookingDetail = lazy(() => import("./pages/BookingDetail"));
const Pregnancies = lazy(() => import("./pages/Pregnancies"));
const OrgDonations = lazy(() => import("./pages/OrgDonations"));
const ProviderTrust = lazy(() => import("./pages/ProviderTrust"));
const Shop = lazy(() => import("./pages/Shop"));
const ShopNew = lazy(() => import("./pages/ShopNew"));
const ShopReminders = lazy(() => import("./pages/ShopReminders"));
const Taxi = lazy(() => import("./pages/Taxi"));
const TaxiNew = lazy(() => import("./pages/TaxiNew"));
const TaxiDetail = lazy(() => import("./pages/TaxiDetail"));
const Cart = lazy(() => import("./pages/Cart"));
const Wishlist = lazy(() => import("./pages/Wishlist"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Orders = lazy(() => import("./pages/Orders"));
const Vet = lazy(() => import("./pages/Vet"));
const VetApply = lazy(() => import("./pages/VetApply"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Admin = lazy(() => import("./pages/Admin"));
const Settings = lazy(() => import("./pages/Settings"));
const AboutYou = lazy(() => import("./pages/settings/AboutYou"));
const NotificationsPrefs = lazy(() => import("./pages/settings/Notifications"));
const EmergencyVet = lazy(() => import("./pages/settings/EmergencyVet"));
const Privacy = lazy(() => import("./pages/settings/Privacy"));
const GoalsPage = lazy(() => import("./pages/settings/Goals"));
const PetEditor = lazy(() => import("./pages/settings/PetEditor"));
const Billing = lazy(() => import("./pages/settings/Billing"));
const Plus = lazy(() => import("./pages/Plus"));
const PlusSuccess = lazy(() => import("./pages/PlusSuccess"));
const Checkout = lazy(() => import("./pages/Checkout"));
const CheckoutReturn = lazy(() => import("./pages/CheckoutReturn"));
const Receipt = lazy(() => import("./pages/Receipt"));
const DonationReceipt = lazy(() => import("./pages/DonationReceipt"));
const Rewards = lazy(() => import("./pages/Rewards"));
const Breeders = lazy(() => import("./pages/Breeders"));
const MissingFeed = lazy(() => import("./pages/MissingFeed"));
const MissingDetail = lazy(() => import("./pages/MissingDetail"));
const MissingNew = lazy(() => import("./pages/MissingNew"));
const NewLitter = lazy(() => import("./pages/NewLitter"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Terms = lazy(() => import("./pages/legal/Terms"));
const LegalPrivacy = lazy(() => import("./pages/legal/Privacy"));
const Refunds = lazy(() => import("./pages/legal/Refunds"));
const DeleteAccount = lazy(() => import("./pages/DeleteAccount"));
const AdminErrors = lazy(() => import("./pages/admin/Errors"));
const AdminStatus = lazy(() => import("./pages/admin/Status"));
const Timeline = lazy(() => import("./pages/health/Timeline"));
const VetOnboarding = lazy(() => import("./pages/vet/Onboarding"));
const VetDashboard = lazy(() => import("./pages/vet/Dashboard"));
const VetVerifications = lazy(() => import("./pages/vet/Verifications"));
const BookAppointment = lazy(() => import("./pages/BookAppointment"));
const AccessRequests = lazy(() => import("./pages/AccessRequests"));
const AppointmentRoom = lazy(() => import("./pages/AppointmentRoom"));
const MyAppointments = lazy(() => import("./pages/MyAppointments"));
const UserProfile = lazy(() => import("./pages/UserProfile"));
const PetProfile = lazy(() => import("./pages/PetProfile"));
const PetTracker = lazy(() => import("./pages/PetTracker"));
const Groups = lazy(() => import("./pages/Groups"));
const GroupDetail = lazy(() => import("./pages/GroupDetail"));
const Meetups = lazy(() => import("./pages/Meetups"));
const MeetupNew = lazy(() => import("./pages/MeetupNew"));
const MeetupDetail = lazy(() => import("./pages/MeetupDetail"));
const AskVet = lazy(() => import("./pages/AskVet"));
const AskVetNew = lazy(() => import("./pages/AskVetNew"));
const AskVetDetail = lazy(() => import("./pages/AskVetDetail"));
const Daily = lazy(() => import("./pages/Daily"));
const Hashtag = lazy(() => import("./pages/Hashtag"));
const WalkSession = lazy(() => import("./pages/WalkSession"));
const WalkLive = lazy(() => import("./pages/WalkLive"));
const Messages = lazy(() => import("./pages/Messages"));
const MessageThread = lazy(() => import("./pages/MessageThread"));
const PhotoVet = lazy(() => import("./pages/PhotoVet"));
const Install = lazy(() => import("./pages/Install"));
const Search = lazy(() => import("./pages/Search"));
const BlockedAccounts = lazy(() => import("./pages/settings/BlockedAccounts"));
const ModerationQueue = lazy(() => import("./pages/admin/Moderation"));
const AccountTypeChooser = lazy(() => import("./pages/AccountTypeChooser"));
const OrgOnboarding = lazy(() => import("./pages/OrgOnboarding"));
const OrgProfile = lazy(() => import("./pages/OrgProfile"));
const OrgReview = lazy(() => import("./pages/admin/OrgReview"));
const HowItWorks = lazy(() => import("./pages/HowItWorks"));
const AddFirstPet = lazy(() => import("./pages/onboarding/AddFirstPet"));
const AddAnotherPet = lazy(() => import("./pages/onboarding/AddAnotherPet"));
const OnboardingDone = lazy(() => import("./pages/onboarding/Done"));
const BuyerPrefs = lazy(() => import("./pages/onboarding/BuyerPrefs"));
const DiscoverServices = lazy(() => import("./pages/DiscoverServices"));
const ServiceCategoryPage = lazy(() => import("./pages/ServiceCategory"));
const VetTriage = lazy(() => import("./pages/VetTriage"));
const Vets = lazy(() => import("./pages/Vets"));
const ProviderPicker = lazy(() => import("./pages/onboarding/provider/Picker"));
const ProviderWizard = lazy(() => import("./pages/onboarding/provider/Wizard"));
const ProviderDashboard = lazy(() => import("./pages/provider/Dashboard"));
const JobsFeed = lazy(() => import("./pages/jobs/JobsFeed"));
const JobNew = lazy(() => import("./pages/jobs/JobNew"));
const JobDetail = lazy(() => import("./pages/jobs/JobDetail"));
const ProviderReview = lazy(() => import("./pages/admin/ProviderReview"));
const AdoptCategory = lazy(() => import("./pages/discover/AdoptCategory"));
const ServiceCategoryCity = lazy(() => import("./pages/discover/ServiceCategoryCity"));
const DriverTaxiInbox = lazy(() => import("./pages/driver/TaxiInbox"));

const App = () => (
  <ErrorBoundary>
  <PersistQueryClientProvider
    client={queryClient}
    persistOptions={{
      persister: idbPersister,
      maxAge: 24 * 60 * 60 * 1000,
      buster: PERSIST_BUSTER,
      dehydrateOptions: {
        shouldDehydrateQuery: shouldPersistQuery,
      },
    }}
  >
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-center" />
      <BrowserRouter>
        <RouteTracker />
        <NetworkStatus />
        <ConsentBanner />
        <Splash>
        <AuthProvider>
          <PresenceProvider>
          <CartProvider>
            <DeferredMount>
              <Suspense fallback={null}>
                <RealtimeBridge />
                <IntentReplay />
                <InstallNudgeSheet />
              </Suspense>
            </DeferredMount>
            <RouteErrorBoundary>
            <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/welcome" element={<Welcome />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/post-auth" element={<PostAuth />} />
              <Route path="/explore" element={<Explore />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/legal/terms" element={<Terms />} />
              <Route path="/legal/privacy" element={<LegalPrivacy />} />
              <Route path="/legal/refunds" element={<Refunds />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/ai" element={<AiChat />} />
              <Route path="/vet-triage" element={<VetTriage />} />
              <Route path="/vets" element={<Vets />} />
              <Route path="/photo-vet" element={<PhotoVet />} />
              <Route path="/install" element={<Install />} />
              <Route path="/search" element={<Search />} />
              <Route path="/vet" element={<VetDashboard />} />
              <Route path="/vet/verifications" element={<VetVerifications />} />
              <Route path="/vet/legacy" element={<Vet />} />
              <Route path="/vet/apply" element={<VetApply />} />
              <Route path="/vet/onboarding" element={<VetOnboarding />} />
              <Route path="/vet/consult/:id" element={<VetConsult />} />
              <Route path="/book-vet" element={<BookAppointment />} />
              <Route path="/access-requests" element={<AccessRequests />} />
              <Route path="/appointments" element={<MyAppointments />} />
              <Route path="/appointment/:id" element={<AppointmentRoom />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/messages/:id" element={<MessageThread />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/settings/about" element={<AboutYou />} />
              <Route path="/settings/notifications" element={<NotificationsPrefs />} />
              <Route path="/settings/emergency" element={<EmergencyVet />} />
              <Route path="/settings/privacy" element={<Privacy />} />
              <Route path="/settings/goals" element={<GoalsPage />} />
              <Route path="/settings/pet/:id" element={<PetEditor />} />
              <Route path="/settings/billing" element={<Billing />} />
              <Route path="/settings/blocked" element={<BlockedAccounts />} />
              <Route path="/admin/moderation" element={<ModerationQueue />} />
              <Route path="/admin/orgs" element={<OrgReview />} />
              <Route path="/admin/org-review" element={<OrgReview />} />
              <Route path="/admin/providers" element={<ProviderReview />} />
              <Route path="/onboarding/account-type" element={<AccountTypeChooser />} />
              <Route path="/onboarding/org" element={<OrgOnboarding />} />
              <Route path="/onboarding/provider" element={<ProviderPicker />} />
              <Route path="/onboarding/provider/:category" element={<ProviderWizard />} />
              <Route path="/provider" element={<ProviderDashboard />} />
              <Route path="/jobs" element={<JobsFeed />} />
              <Route path="/jobs/new" element={<JobNew />} />
              <Route path="/jobs/:id" element={<JobDetail />} />
              <Route path="/onboarding/add-pet" element={<AddFirstPet />} />
              <Route path="/onboarding/add-another-pet" element={<AddAnotherPet />} />
              <Route path="/onboarding/done" element={<OnboardingDone />} />
              <Route path="/onboarding/buyer-prefs" element={<BuyerPrefs />} />
              <Route path="/org/:userId" element={<OrgProfile />} />
              <Route path="/how-it-works" element={<HowItWorks />} />
              <Route path="/plus" element={<Plus />} />
              <Route path="/plus/success" element={<PlusSuccess />} />
              <Route path="/checkout/return" element={<CheckoutReturn />} />
              <Route path="/checkout/:priceId" element={<Checkout />} />
              <Route path="/receipt/:intentId" element={<Receipt />} />
              <Route path="/rewards" element={<Rewards />} />
              <Route path="/breeders" element={<Breeders />} />
              <Route path="/missing" element={<MissingFeed />} />
              <Route path="/missing/new" element={<MissingNew />} />
              <Route path="/missing/:id" element={<MissingDetail />} />
              <Route path="/litters/new" element={<NewLitter />} />
              <Route path="/mates/new" element={<MatesNew />} />
              <Route path="/mates/listing/:id" element={<MateListing />} />
              <Route path="/mates/manage" element={<MatesManage />} />
              <Route path="/mates/adopt/new" element={<AdoptListingNew />} />
              <Route path="/adoption-inbox" element={<AdoptionInbox />} />
              <Route path="/mates/adopt/:id" element={<AdoptListingDetail />} />
              <Route path="/shelters" element={<Shelters />} />
              <Route path="/services/new" element={<ServiceNew />} />
              <Route path="/services/manage" element={<ServicesManage />} />
              <Route path="/bookings/recurring" element={<RecurringBookings />} />
              <Route path="/pregnancies" element={<Pregnancies />} />
              <Route path="/org/donations" element={<OrgDonations />} />
              <Route path="/donations/:donationId/receipt" element={<DonationReceipt />} />
              <Route path="/shop/reminders" element={<ShopReminders />} />
              <Route path="/taxi" element={<Taxi />} />
              <Route path="/taxi/new" element={<TaxiNew />} />
              <Route path="/taxi/:id" element={<TaxiDetail />} />
              <Route path="/driver/taxi" element={<DriverTaxiInbox />} />
              <Route path="/services/trust/:providerId" element={<ProviderTrust />} />
              <Route path="/services/category/:category" element={<ServiceCategoryPage />} />
              <Route path="/discover/services" element={<DiscoverServices />} />
              {/* Phase B — public, geo-targeted category hubs */}
              <Route path="/adopt" element={<AdoptCategory />} />
              <Route path="/adopt/:species" element={<AdoptCategory />} />
              <Route path="/adopt/:species/:breed" element={<AdoptCategory />} />
              <Route path="/adopt/:species/:breed/:city" element={<AdoptCategory />} />
              <Route path="/services/:category/:city" element={<ServiceCategoryCity />} />
              <Route path="/services/:id" element={<ServiceDetail />} />
              <Route path="/shop" element={<Shop />} />
              <Route path="/shop/new" element={<ShopNew />} />
              <Route path="/shop/:id" element={<ProductDetail />} />
              <Route path="/wishlist" element={<Wishlist />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/account/delete" element={<DeleteAccount />} />
              <Route path="/admin/errors" element={<AdminErrors />} />
              <Route path="/admin/status" element={<AdminStatus />} />
              <Route path="/health/:petId/timeline" element={<Timeline />} />
              <Route path="/v/:code" element={<VaultView />} />
              <Route path="/rescue/:id" element={<RescueJourneyDetail />} />
              <Route path="/u/:userId" element={<UserProfile />} />
              <Route path="/pet/:publicId" element={<PetProfile />} />
              <Route path="/pets/:petId/tracker" element={<PetTracker />} />
              <Route path="/groups" element={<Groups />} />
              <Route path="/g/:slug" element={<GroupDetail />} />
              <Route path="/meetups" element={<Meetups />} />
              <Route path="/meetups/new" element={<MeetupNew />} />
              <Route path="/meetups/:id" element={<MeetupDetail />} />
              <Route path="/askvet" element={<AskVet />} />
              <Route path="/askvet/new" element={<AskVetNew />} />
              <Route path="/askvet/:id" element={<AskVetDetail />} />
              <Route path="/daily" element={<Daily />} />
              <Route path="/t/:tag" element={<Hashtag />} />
              <Route path="/walk/:id" element={<WalkSession />} />
              <Route path="/walk-live/:token" element={<WalkLive />} />
              <Route element={<FirstRunGate><AppShell /></FirstRunGate>}>
                <Route path="/" element={<Home />} />
                <Route path="/discover" element={<Discover />} />
                <Route path="/mates" element={<Mates />} />
                <Route path="/health" element={<Health />} />
                <Route path="/health/alerts" element={<HealthAlerts />} />
                <Route path="/health/compare" element={<HealthCompare />} />
                <Route path="/services" element={<Services />} />
                <Route path="/profile" element={<Profile />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
            </RouteErrorBoundary>
          </CartProvider>
          </PresenceProvider>
        </AuthProvider>
        </Splash>
      </BrowserRouter>
    </TooltipProvider>
  </PersistQueryClientProvider>
  </ErrorBoundary>
);

export default App;
