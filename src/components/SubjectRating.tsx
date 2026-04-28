import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RatingStars } from "./RatingStars";
import type { Database } from "@/integrations/supabase/types";

type SubjectType = Database["public"]["Enums"]["review_subject"];

export const SubjectRating = ({
  type,
  id,
  size = "sm",
}: {
  type: SubjectType;
  id: string;
  size?: "sm" | "md" | "lg";
}) => {
  const { data } = useQuery({
    queryKey: ["rating", type, id],
    queryFn: async () => {
      const { data } = await supabase
        .from("subject_ratings")
        .select("avg_rating, review_count")
        .eq("subject_type", type)
        .eq("subject_id", id)
        .maybeSingle();
      return data;
    },
  });
  if (!data) return null;
  return <RatingStars rating={Number(data.avg_rating) || 0} count={data.review_count} size={size} />;
};
