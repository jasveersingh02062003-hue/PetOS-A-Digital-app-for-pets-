import { supabase } from "@/integrations/supabase/client";

/**
 * Pet-native reactions. The first 5 are legacy generic emoji.
 * The new pet-native ones (boop, treat, yummy, strong, cute) are what
 * we lead with in the UI — they own the language of the platform.
 */
export type ReactionKind =
  | "love"
  | "paw"
  | "laugh"
  | "wow"
  | "sad"
  | "boop"
  | "treat"
  | "yummy"
  | "strong"
  | "cute";

/**
 * Add a reaction to a post if the user hasn't already reacted with it.
 * Returns true if a new reaction was inserted, false if it already existed.
 */
export async function addReaction(
  postId: string,
  userId: string,
  kind: ReactionKind = "boop",
) {
  const { data: existing } = await supabase
    .from("post_reactions")
    .select("kind")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .eq("kind", kind)
    .maybeSingle();
  if (existing) return false;
  const { error } = await supabase
    .from("post_reactions")
    .insert({ post_id: postId, user_id: userId, kind });
  if (error) throw error;
  return true;
}
