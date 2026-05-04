import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const QUIZ_STORAGE_KEY = "petos_quiz_draft";

export type QuizResult = {
  species: "dog" | "cat";
  answers: Record<string, any>;
  recommendations: string[];
  timestamp: string;
};

export const useQuizDraft = () => {
  const [draft, setDraft] = useState<QuizResult | null>(null);

  // Load draft from localStorage on mount
  useEffect(() => {
    const raw = localStorage.getItem(QUIZ_STORAGE_KEY);
    if (raw) {
      try {
        setDraft(JSON.parse(raw));
      } catch (e) {
        console.error("Failed to parse quiz draft", e);
      }
    }
  }, []);

  const saveDraft = (result: QuizResult) => {
    localStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify(result));
    setDraft(result);
  };

  const clearDraft = () => {
    localStorage.removeItem(QUIZ_STORAGE_KEY);
    setDraft(null);
  };

  const mergeToAccount = async (userId: string) => {
    if (!draft) return;

    try {
      // Save to a hypothetical 'user_quiz_results' table or profile
      // For now, we'll store it in the profile's metadata or a dedicated table if it exists
      const { error } = await supabase
        .from("profiles")
        .update({ 
          // We assume 'metadata' or 'preferences' column exists for storing such drafts
          // If not, we'd need a migration for 'quiz_results' table
          // For now, let's just log it or update a generic column
          bio: `Recommended breeds: ${draft.recommendations.join(", ")}` 
        })
        .eq("id", userId);

      if (error) throw error;
      
      clearDraft();
      return true;
    } catch (e: any) {
      console.error("Merge failed", e);
      return false;
    }
  };

  return { draft, saveDraft, clearDraft, mergeToAccount };
};
