import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type VetCategory = "behavior" | "nutrition" | "medical" | "training" | "other";

export const useVetQuestions = (category?: VetCategory | "all") =>
  useQuery({
    queryKey: ["vet-questions", category ?? "all"],
    queryFn: async () => {
      let q = supabase.from("vet_questions").select("*").order("created_at", { ascending: false }).limit(50);
      if (category && category !== "all") q = q.eq("category", category);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

/** Questions asked by the current user (for "My questions" inbox). */
export const useMyVetQuestions = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-vet-questions", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vet_questions")
        .select("*")
        .eq("asker_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
};

export const useVetQuestion = (id?: string) =>
  useQuery({
    queryKey: ["vet-question", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("vet_questions").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const useVetAnswers = (questionId?: string) =>
  useQuery({
    queryKey: ["vet-answers", questionId],
    enabled: !!questionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vet_answers")
        .select("*")
        .eq("question_id", questionId!)
        .order("helpful_count", { ascending: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

export const useCreateVetQuestion = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (q: { title: string; body: string; category: VetCategory; species?: string; pet_id?: string }) => {
      if (!user) throw new Error("Sign in first");
      const { data, error } = await supabase
        .from("vet_questions")
        .insert({ ...q, asker_id: user.id })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vet-questions"] });
      toast.success("Question posted");
    },
    onError: (e: any) => toast.error(e.message || "Could not post"),
  });
};

export const useCreateVetAnswer = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ questionId, body }: { questionId: string; body: string }) => {
      if (!user) throw new Error("Sign in first");
      const { error } = await supabase.from("vet_answers").insert({ question_id: questionId, vet_id: user.id, body });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["vet-answers", vars.questionId] });
      qc.invalidateQueries({ queryKey: ["vet-question", vars.questionId] });
      qc.invalidateQueries({ queryKey: ["vet-questions"] });
      toast.success("Answer posted");
    },
    onError: (e: any) => toast.error(e.message || "Could not post answer"),
  });
};

export const useIsHelpful = (answerId?: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["answer-helpful", answerId, user?.id],
    enabled: !!answerId && !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("vet_answer_helpful")
        .select("answer_id")
        .eq("answer_id", answerId!)
        .eq("user_id", user!.id)
        .maybeSingle();
      return !!data;
    },
  });
};

export const useToggleHelpful = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ answerId, isHelpful, questionId }: { answerId: string; isHelpful: boolean; questionId: string }) => {
      if (!user) throw new Error("Sign in first");
      if (isHelpful) {
        const { error } = await supabase.from("vet_answer_helpful").delete().eq("answer_id", answerId).eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("vet_answer_helpful").insert({ answer_id: answerId, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["answer-helpful", vars.answerId] });
      qc.invalidateQueries({ queryKey: ["vet-answers", vars.questionId] });
    },
    onError: (e: any) => toast.error(e.message || "Could not update"),
  });
};

export const useIsVet = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["is-vet", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id).eq("role", "vet").maybeSingle();
      return !!data;
    },
  });
};
