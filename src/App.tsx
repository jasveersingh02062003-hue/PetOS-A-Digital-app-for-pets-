import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000 } },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-center" />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/ai" element={<AiChat />} />
            <Route path="/vet/consult/:id" element={<VetConsult />} />
            <Route path="/mates/new" element={<MatesNew />} />
            <Route path="/mates/listing/:id" element={<MateListing />} />
            <Route path="/mates/manage" element={<MatesManage />} />
            <Route path="/v/:code" element={<VaultView />} />
            <Route element={<AppShell />}>
              <Route path="/" element={<Home />} />
              <Route path="/discover" element={<Discover />} />
              <Route path="/health" element={<Health />} />
              <Route path="/services" element={<Services />} />
              <Route path="/profile" element={<Profile />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
