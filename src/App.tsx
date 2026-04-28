import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { CartProvider } from "@/hooks/useCart";
import { AppShell } from "@/components/AppShell";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Splash } from "./components/Splash";
import { RouteFallback } from "./components/RouteFallback";
import { logError } from "./lib/logError";
import { FirstRunGate } from "./components/FirstRunGate";

// Eager — main tab-bar pages, loaded immediately after auth
import Home from "./pages/Home";
import Discover from "./pages/Discover";
import Health from "./pages/Health";
import Services from "./pages/Services";
import Profile from "./pages/Profile";
import Auth from "./pages/Auth";
import Welcome from "./pages/Welcome";
import NotFound from "./pages/NotFound";
import Explore from "./pages/Explore";

// Lazy — every other route, code-split into separate chunks
const Onboarding = lazy(() => import("./pages/Onboarding"));
const AiChat = lazy(() => import("./pages/AiChat"));
const VaultView = lazy(() => import("./pages/VaultView"));
const VetConsult = lazy(() => import("./pages/VetConsult"));
const MatesNew = lazy(() => import("./pages/MatesNew"));
const MateListing = lazy(() => import("./pages/MateListing"));
const MatesManage = lazy(() => import("./pages/MatesManage"));
const ServiceDetail = lazy(() => import("./pages/ServiceDetail"));
const ServiceNew = lazy(() => import("./pages/ServiceNew"));
const ServicesManage = lazy(() => import("./pages/ServicesManage"));
const Shop = lazy(() => import("./pages/Shop"));
const ShopNew = lazy(() => import("./pages/ShopNew"));
const Cart = lazy(() => import("./pages/Cart"));
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
const MissingFeed = lazy(() => import("./pages/MissingFeed"));
const MissingDetail = lazy(() => import("./pages/MissingDetail"));
const MissingNew = lazy(() => import("./pages/MissingNew"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Terms = lazy(() => import("./pages/legal/Terms"));
const LegalPrivacy = lazy(() => import("./pages/legal/Privacy"));
const Refunds = lazy(() => import("./pages/legal/Refunds"));
const DeleteAccount = lazy(() => import("./pages/DeleteAccount"));
const AdminErrors = lazy(() => import("./pages/admin/Errors"));
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      onError: (err) => logError(err, { source: "client:mutation" }),
    },
  },
});

const App = () => (
  <ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-center" />
      <BrowserRouter>
        <Splash>
        <AuthProvider>
          <CartProvider>
            <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/welcome" element={<Welcome />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/explore" element={<Explore />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/legal/terms" element={<Terms />} />
              <Route path="/legal/privacy" element={<LegalPrivacy />} />
              <Route path="/legal/refunds" element={<Refunds />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/ai" element={<AiChat />} />
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
              <Route path="/plus" element={<Plus />} />
              <Route path="/plus/success" element={<PlusSuccess />} />
              <Route path="/missing" element={<MissingFeed />} />
              <Route path="/missing/new" element={<MissingNew />} />
              <Route path="/missing/:id" element={<MissingDetail />} />
              <Route path="/mates/new" element={<MatesNew />} />
              <Route path="/mates/listing/:id" element={<MateListing />} />
              <Route path="/mates/manage" element={<MatesManage />} />
              <Route path="/services/new" element={<ServiceNew />} />
              <Route path="/services/manage" element={<ServicesManage />} />
              <Route path="/services/:id" element={<ServiceDetail />} />
              <Route path="/shop" element={<Shop />} />
              <Route path="/shop/new" element={<ShopNew />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/account/delete" element={<DeleteAccount />} />
              <Route path="/admin/errors" element={<AdminErrors />} />
              <Route path="/health/:petId/timeline" element={<Timeline />} />
              <Route path="/v/:code" element={<VaultView />} />
              <Route path="/u/:userId" element={<UserProfile />} />
              <Route path="/pet/:publicId" element={<PetProfile />} />
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
                <Route path="/health" element={<Health />} />
                <Route path="/services" element={<Services />} />
                <Route path="/profile" element={<Profile />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
          </CartProvider>
        </AuthProvider>
        </Splash>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
