import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";

/**
 * Home is a thin router by `profiles.account_type`.
 * Each dashboard is data-backed (real Supabase queries — no mock data) and
 * code-split so we don't pay for siblings on first render.
 */
const PetParentHome = lazy(() => import("./home/PetParentHome"));
const BreederHome = lazy(() => import("./home/BreederHome"));
const ShelterHome = lazy(() => import("./home/ShelterHome"));
const KennelHome = lazy(() => import("./home/KennelHome"));
const GaushalaHome = lazy(() => import("./home/GaushalaHome"));
const BuyerHome = lazy(() => import("./home/BuyerHome"));
const ZooHome = lazy(() => import("./home/ZooHome"));
// Fallback for any unknown role.
const RoleHome = lazy(() => import("./home/RoleHome"));

const Spinner = () => (
  <div className="min-h-[60vh] grid place-items-center">
    <Loader2 className="h-5 w-5 animate-spin text-primary" />
  </div>
);

const Home = () => {
  const { data: profile, isLoading } = useProfile();
  if (isLoading) return <Spinner />;

  const accountType = profile?.account_type ?? "pet_parent";

  return (
    <Suspense fallback={<Spinner />}>
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
