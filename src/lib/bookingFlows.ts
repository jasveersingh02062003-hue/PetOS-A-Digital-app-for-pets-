// Canonical step orders + labels for every booking lifecycle in Petos.
// Used by <StatusProgress /> so progress bars look identical across surfaces.

export const TAXI_FLOW = [
  "requested", "accepted", "en_route_pickup", "picked_up", "en_route_drop", "dropped_off",
] as const;
export const TAXI_LABELS: Record<(typeof TAXI_FLOW)[number] | "cancelled", string> = {
  requested: "Looking for driver",
  accepted: "Driver accepted",
  en_route_pickup: "On the way to pickup",
  picked_up: "Pet picked up",
  en_route_drop: "On the way to drop-off",
  dropped_off: "Dropped off safely",
  cancelled: "Cancelled",
};

export const APPOINTMENT_FLOW = [
  "requested", "confirmed", "in_progress", "completed",
] as const;
export const APPOINTMENT_LABELS: Record<(typeof APPOINTMENT_FLOW)[number] | "cancelled" | "no_show", string> = {
  requested: "Requested",
  confirmed: "Confirmed",
  in_progress: "In consultation",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No show",
};

export const SERVICE_BOOKING_FLOW = [
  "pending", "confirmed", "in_progress", "completed",
] as const;
export const SERVICE_BOOKING_LABELS: Record<string, string> = {
  pending: "Awaiting confirmation",
  confirmed: "Confirmed — see you soon",
  in_progress: "In progress",
  completed: "Completed",
  declined: "Declined",
  cancelled: "Cancelled",
};

export const WALK_FLOW = ["confirmed", "on_the_way", "in_progress", "completed"] as const;
export const WALK_LABELS: Record<(typeof WALK_FLOW)[number], string> = {
  confirmed: "Walk confirmed",
  on_the_way: "Walker on the way",
  in_progress: "Walk in progress",
  completed: "Walk completed",
};
