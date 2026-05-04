import { lazy, Suspense } from "react";
import { useProfile } from "@/hooks/useProfile";
import { HomeSkeleton } from "@/components/HomeSkeleton";

// Eager: most users land here as pet_parent — avoid an extra round-trip on first paint
import PetParentHome from "./home/PetParentHome";
import { useAuth } from "@/hooks/useAuth";
import { LandingPage } from "./LandingPage";

/**
 * Home is a thin router by `profiles.account_type`.
 * Each dashboard is data-backed (real Supabase queries — no mock data) and
 * code-split so we don't pay for siblings on first render.
 */
const BreederHome = lazy(() => import("./home/BreederHome"));
const ShelterHome = lazy(() => import("./home/ShelterHome"));
const KennelHome = lazy(() => import("./home/KennelHome"));
const GaushalaHome = lazy(() => import("./home/GaushalaHome"));
const BuyerHome = lazy(() => import("./home/BuyerHome"));
const ZooHome = lazy(() => import("./home/ZooHome"));
// Fallback for any unknown role.
const RoleHome = lazy(() => import("./home/RoleHome"));

const Home = () => {
  const { user, loading: authLoading } = useAuth();
  const { data: profile, isLoading } = useProfile();
  
  if (authLoading || (user && isLoading)) return <HomeSkeleton />;

  if (!user) return <LandingPage />;

  const accountType = profile?.account_type ?? "pet_parent";

  return (
    <Suspense fallback={<HomeSkeleton />}>
      {accountType === "pet_parent" ? (
        <PetParentHome />
      ) : accountType === "breeder" ? (
        <BreederHome />
      ) : accountType === "shelter" ? (
        <ShelterHome variant="shelter" />
      ) : accountType === "rescuer" ? (
        <ShelterHome variant="rescuer" />
      ) : accountType === "kennel" ? (
        <KennelHome />
      ) : accountType === "sanctuary" ? (
        <GaushalaHome />
      ) : accountType === "buyer" ? (
        <BuyerHome />
      ) : accountType === "zoo" ? (
        <ZooHome />
      ) : (
        <RoleHome accountType={accountType} />
      )}
    </Suspense>
  );
};

export default Home;
