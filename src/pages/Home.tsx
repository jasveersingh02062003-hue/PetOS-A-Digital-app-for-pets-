import { lazy, Suspense } from "react";
import { useProfile } from "@/hooks/useProfile";

// Eager: most users land here as pet_parent — avoid an extra round-trip on first paint
import PetParentHome from "./home/PetParentHome";

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

/** Skeleton matching the PetParent layout — fills the viewport so the user sees structure, not a blank screen. */
const HomeSkeleton = () => (
  <div className="container-app pad-top-safe animate-pulse">
    <div className="pt-6 pb-4">
      <div className="h-3 w-20 bg-muted rounded" />
      <div className="h-7 w-40 bg-muted rounded mt-2" />
    </div>
    <div className="h-32 rounded-2xl bg-muted mb-3" />
    <div className="h-12 rounded-2xl bg-muted mb-3" />
    <div className="h-20 rounded-2xl bg-muted mb-3" />
    <div className="flex gap-3 mb-4">
      {[0,1,2,3].map(i => <div key={i} className="h-16 w-16 rounded-2xl bg-muted" />)}
    </div>
    <div className="h-11 rounded-2xl bg-muted mb-4" />
    <div className="h-72 rounded-2xl bg-muted" />
  </div>
);

const Home = () => {
  const { data: profile, isLoading } = useProfile();
  if (isLoading) return <HomeSkeleton />;

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
