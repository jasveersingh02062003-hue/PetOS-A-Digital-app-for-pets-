import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";

/**
 * Home is a thin router by `profiles.account_type`.
 * - pet_parent → original PetParentHome (hero pet card, SOS, alerts, feed)
 * - breeder/kennel/shelter/rescuer/sanctuary/zoo/buyer → role-aware RoleHome
 *
 * Each role-specific dashboard is code-split so we don't pay for siblings.
 */
const PetParentHome = lazy(() => import("./home/PetParentHome"));
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
      ) : (
        <RoleHome accountType={accountType} />
      )}
    </Suspense>
  );
};

export default Home;
