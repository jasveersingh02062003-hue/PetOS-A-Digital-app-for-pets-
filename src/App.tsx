import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { CartProvider } from "@/hooks/useCart";
import { AppShell } from "@/components/AppShell";
import Home from "./pages/Home";
import Discover from "./pages/Discover";
import Health from "./pages/Health";
import Services from "./pages/Services";
import Profile from "./pages/Profile";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import AiChat from "./pages/AiChat";
import VaultView from "./pages/VaultView";
import VetConsult from "./pages/VetConsult";
import MatesNew from "./pages/MatesNew";
import MateListing from "./pages/MateListing";
import MatesManage from "./pages/MatesManage";
import ServiceDetail from "./pages/ServiceDetail";
import ServiceNew from "./pages/ServiceNew";
import ServicesManage from "./pages/ServicesManage";
import Shop from "./pages/Shop";
import ShopNew from "./pages/ShopNew";
import Cart from "./pages/Cart";
import Orders from "./pages/Orders";
import Vet from "./pages/Vet";
import VetApply from "./pages/VetApply";
import Notifications from "./pages/Notifications";
import Admin from "./pages/Admin";
import Settings from "./pages/Settings";
import AboutYou from "./pages/settings/AboutYou";
import NotificationsPrefs from "./pages/settings/Notifications";
import EmergencyVet from "./pages/settings/EmergencyVet";
import Privacy from "./pages/settings/Privacy";
import GoalsPage from "./pages/settings/Goals";
import PetEditor from "./pages/settings/PetEditor";
import Billing from "./pages/settings/Billing";
import Plus from "./pages/Plus";
import PlusSuccess from "./pages/PlusSuccess";
import MissingFeed from "./pages/MissingFeed";
import MissingDetail from "./pages/MissingDetail";
import MissingNew from "./pages/MissingNew";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Terms from "./pages/legal/Terms";
import LegalPrivacy from "./pages/legal/Privacy";
import Refunds from "./pages/legal/Refunds";
import NotFound from "./pages/NotFound";
import DeleteAccount from "./pages/DeleteAccount";
import AdminErrors from "./pages/admin/Errors";
import Welcome from "./pages/Welcome";
import Timeline from "./pages/health/Timeline";
import VetOnboarding from "./pages/vet/Onboarding";
import VetDashboard from "./pages/vet/Dashboard";
import VetVerifications from "./pages/vet/Verifications";
import BookAppointment from "./pages/BookAppointment";
import AccessRequests from "./pages/AccessRequests";
import AppointmentRoom from "./pages/AppointmentRoom";
import MyAppointments from "./pages/MyAppointments";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Splash } from "./components/Splash";
import { logError } from "./lib/logError";
import { Navigate } from "react-router-dom";
import { FirstRunGate } from "./components/FirstRunGate";
import UserProfile from "./pages/UserProfile";
import PetProfile from "./pages/PetProfile";
import Groups from "./pages/Groups";
import GroupDetail from "./pages/GroupDetail";
import Meetups from "./pages/Meetups";
import MeetupNew from "./pages/MeetupNew";
import MeetupDetail from "./pages/MeetupDetail";
import AskVet from "./pages/AskVet";
import AskVetNew from "./pages/AskVetNew";
import AskVetDetail from "./pages/AskVetDetail";
import Daily from "./pages/Daily";
import Hashtag from "./pages/Hashtag";
import WalkSession from "./pages/WalkSession";
import WalkLive from "./pages/WalkLive";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
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
            <Routes>
              <Route path="/welcome" element={<Welcome />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/legal/terms" element={<Terms />} />
              <Route path="/legal/privacy" element={<LegalPrivacy />} />
              <Route path="/legal/refunds" element={<Refunds />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/ai" element={<AiChat />} />
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
              <Route path="/admin" element={<Admin />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/settings/about" element={<AboutYou />} />
              <Route path="/settings/notifications" element={<NotificationsPrefs />} />
              <Route path="/settings/emergency" element={<EmergencyVet />} />
              <Route path="/settings/privacy" element={<Privacy />} />
              <Route path="/settings/goals" element={<GoalsPage />} />
              <Route path="/settings/pet/:id" element={<PetEditor />} />
              <Route path="/settings/billing" element={<Billing />} />
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
          </CartProvider>
        </AuthProvider>
        </Splash>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
