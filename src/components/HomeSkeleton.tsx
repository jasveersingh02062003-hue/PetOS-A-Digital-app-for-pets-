/**
 * Skeleton matching the PetParent home layout. Shown while auth/profile/pets
 * resolve so the user sees structure immediately instead of a blank screen.
 * Shared by FirstRunGate (pre-render) and Home (post-render, role decision).
 */
export const HomeSkeleton = () => (
  <div className="container-app pad-top-safe animate-pulse">
    <div className="pt-6 pb-4">
      <div className="h-3 w-20 bg-muted rounded" />
      <div className="h-7 w-40 bg-muted rounded mt-2" />
    </div>
    <div className="h-32 rounded-2xl bg-muted mb-3" />
    <div className="h-12 rounded-2xl bg-muted mb-3" />
    <div className="h-20 rounded-2xl bg-muted mb-3" />
    <div className="flex gap-3 mb-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-16 w-16 rounded-2xl bg-muted" />
      ))}
    </div>
    <div className="h-11 rounded-2xl bg-muted mb-4" />
    <div className="h-72 rounded-2xl bg-muted" />
  </div>
);

export default HomeSkeleton;
