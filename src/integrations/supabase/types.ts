export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      health_records: {
        Row: {
          created_at: string
          document_path: string | null
          id: string
          notes: string | null
          occurred_on: string
          pet_id: string
          record_type: Database["public"]["Enums"]["health_record_type"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          document_path?: string | null
          id?: string
          notes?: string | null
          occurred_on?: string
          pet_id: string
          record_type?: Database["public"]["Enums"]["health_record_type"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          document_path?: string | null
          id?: string
          notes?: string | null
          occurred_on?: string
          pet_id?: string
          record_type?: Database["public"]["Enums"]["health_record_type"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_records_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      mating_agreements: {
        Row: {
          created_at: string
          from_signature: string | null
          from_signed_at: string | null
          id: string
          request_id: string
          terms_text: string
          to_signature: string | null
          to_signed_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          from_signature?: string | null
          from_signed_at?: string | null
          id?: string
          request_id: string
          terms_text: string
          to_signature?: string | null
          to_signed_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          from_signature?: string | null
          from_signed_at?: string | null
          id?: string
          request_id?: string
          terms_text?: string
          to_signature?: string | null
          to_signed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mating_agreements_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "mating_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      mating_listings: {
        Row: {
          active: boolean
          city: string | null
          created_at: string
          description: string | null
          fee_inr: number | null
          id: string
          intent: Database["public"]["Enums"]["mating_intent"]
          owner_id: string
          pet_id: string
          requirements: string | null
          travel_km: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          city?: string | null
          created_at?: string
          description?: string | null
          fee_inr?: number | null
          id?: string
          intent?: Database["public"]["Enums"]["mating_intent"]
          owner_id: string
          pet_id: string
          requirements?: string | null
          travel_km?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          city?: string | null
          created_at?: string
          description?: string | null
          fee_inr?: number | null
          id?: string
          intent?: Database["public"]["Enums"]["mating_intent"]
          owner_id?: string
          pet_id?: string
          requirements?: string | null
          travel_km?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mating_listings_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: true
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      mating_requests: {
        Row: {
          created_at: string
          from_owner_id: string
          from_pet_id: string
          id: string
          message: string | null
          status: Database["public"]["Enums"]["request_status"]
          to_owner_id: string
          to_pet_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          from_owner_id: string
          from_pet_id: string
          id?: string
          message?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          to_owner_id: string
          to_pet_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          from_owner_id?: string
          from_pet_id?: string
          id?: string
          message?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          to_owner_id?: string
          to_pet_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mating_requests_from_pet_id_fkey"
            columns: ["from_pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mating_requests_to_pet_id_fkey"
            columns: ["to_pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrition_logs: {
        Row: {
          created_at: string
          fed_at: string
          food: string
          id: string
          notes: string | null
          pet_id: string
          portion: string | null
        }
        Insert: {
          created_at?: string
          fed_at?: string
          food: string
          id?: string
          notes?: string | null
          pet_id: string
          portion?: string | null
        }
        Update: {
          created_at?: string
          fed_at?: string
          food?: string
          id?: string
          notes?: string | null
          pet_id?: string
          portion?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nutrition_logs_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      pets: {
        Row: {
          avatar_url: string | null
          bio: string | null
          breed: string | null
          city: string | null
          created_at: string
          date_of_birth: string | null
          discoverable_for_mating: boolean
          gender: Database["public"]["Enums"]["pet_gender"] | null
          id: string
          name: string
          neutered: boolean | null
          owner_id: string
          species: Database["public"]["Enums"]["pet_species"]
          updated_at: string
          vaccination_verified: boolean
          weight_kg: number | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          breed?: string | null
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          discoverable_for_mating?: boolean
          gender?: Database["public"]["Enums"]["pet_gender"] | null
          id?: string
          name: string
          neutered?: boolean | null
          owner_id: string
          species: Database["public"]["Enums"]["pet_species"]
          updated_at?: string
          vaccination_verified?: boolean
          weight_kg?: number | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          breed?: string | null
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          discoverable_for_mating?: boolean
          gender?: Database["public"]["Enums"]["pet_gender"] | null
          id?: string
          name?: string
          neutered?: boolean | null
          owner_id?: string
          species?: Database["public"]["Enums"]["pet_species"]
          updated_at?: string
          vaccination_verified?: boolean
          weight_kg?: number | null
        }
        Relationships: []
      }
      post_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          post_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          post_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string
          caption: string | null
          comment_count: number
          created_at: string
          id: string
          image_url: string | null
          like_count: number
          pet_id: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          caption?: string | null
          comment_count?: number
          created_at?: string
          id?: string
          image_url?: string | null
          like_count?: number
          pet_id?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          caption?: string | null
          comment_count?: number
          created_at?: string
          id?: string
          image_url?: string | null
          like_count?: number
          pet_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          city: string | null
          created_at: string
          full_name: string | null
          id: string
          interests: string[] | null
          onboarded: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          interests?: string[] | null
          onboarded?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          interests?: string[] | null
          onboarded?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      symptom_logs: {
        Row: {
          created_at: string
          id: string
          logged_at: string
          notes: string | null
          pet_id: string
          severity: number
          symptom: string
        }
        Insert: {
          created_at?: string
          id?: string
          logged_at?: string
          notes?: string | null
          pet_id: string
          severity?: number
          symptom: string
        }
        Update: {
          created_at?: string
          id?: string
          logged_at?: string
          notes?: string | null
          pet_id?: string
          severity?: number
          symptom?: string
        }
        Relationships: [
          {
            foreignKeyName: "symptom_logs_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vaccinations: {
        Row: {
          administered_on: string
          batch_number: string | null
          created_at: string
          document_path: string | null
          id: string
          next_due_on: string | null
          notes: string | null
          pet_id: string
          updated_at: string
          vaccine_name: string
          vet_name: string | null
        }
        Insert: {
          administered_on: string
          batch_number?: string | null
          created_at?: string
          document_path?: string | null
          id?: string
          next_due_on?: string | null
          notes?: string | null
          pet_id: string
          updated_at?: string
          vaccine_name: string
          vet_name?: string | null
        }
        Update: {
          administered_on?: string
          batch_number?: string | null
          created_at?: string
          document_path?: string | null
          id?: string
          next_due_on?: string | null
          notes?: string | null
          pet_id?: string
          updated_at?: string
          vaccine_name?: string
          vet_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vaccinations_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      vault_documents: {
        Row: {
          category: string | null
          created_at: string
          file_path: string
          id: string
          mime_type: string | null
          pet_id: string
          size_bytes: number | null
          title: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          file_path: string
          id?: string
          mime_type?: string | null
          pet_id: string
          size_bytes?: number | null
          title: string
        }
        Update: {
          category?: string | null
          created_at?: string
          file_path?: string
          id?: string
          mime_type?: string | null
          pet_id?: string
          size_bytes?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "vault_documents_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      vet_access_grants: {
        Row: {
          clinic_name: string | null
          code: string
          created_at: string
          created_by: string
          expires_at: string
          id: string
          pet_id: string
          revoked: boolean
          vet_name: string | null
        }
        Insert: {
          clinic_name?: string | null
          code: string
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          pet_id: string
          revoked?: boolean
          vet_name?: string | null
        }
        Update: {
          clinic_name?: string | null
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          pet_id?: string
          revoked?: boolean
          vet_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vet_access_grants_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      vet_consults: {
        Row: {
          ai_summary: string | null
          completed_at: string | null
          created_at: string
          id: string
          notes: string | null
          owner_id: string
          pet_id: string
          prescription: string | null
          severity: Database["public"]["Enums"]["consult_severity"]
          status: Database["public"]["Enums"]["consult_status"]
          symptoms: string[] | null
          updated_at: string
          vet_id: string | null
        }
        Insert: {
          ai_summary?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          owner_id: string
          pet_id: string
          prescription?: string | null
          severity?: Database["public"]["Enums"]["consult_severity"]
          status?: Database["public"]["Enums"]["consult_status"]
          symptoms?: string[] | null
          updated_at?: string
          vet_id?: string | null
        }
        Update: {
          ai_summary?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          owner_id?: string
          pet_id?: string
          prescription?: string | null
          severity?: Database["public"]["Enums"]["consult_severity"]
          status?: Database["public"]["Enums"]["consult_status"]
          symptoms?: string[] | null
          updated_at?: string
          vet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vet_consults_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "user"
        | "pet_pal"
        | "boarding_provider"
        | "vet"
        | "ngo"
        | "moderator"
        | "finance"
        | "super_admin"
      consult_severity: "mild" | "moderate" | "severe"
      consult_status:
        | "awaiting_vet"
        | "assigned"
        | "in_progress"
        | "completed"
        | "cancelled"
      health_record_type:
        | "visit"
        | "diagnostic"
        | "prescription"
        | "surgery"
        | "allergy"
        | "other"
      mating_intent: "stud" | "dam" | "either"
      pet_gender: "male" | "female"
      pet_species: "dog" | "cat" | "bird" | "rabbit" | "other"
      request_status:
        | "pending"
        | "accepted"
        | "declined"
        | "withdrawn"
        | "agreed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "user",
        "pet_pal",
        "boarding_provider",
        "vet",
        "ngo",
        "moderator",
        "finance",
        "super_admin",
      ],
      consult_severity: ["mild", "moderate", "severe"],
      consult_status: [
        "awaiting_vet",
        "assigned",
        "in_progress",
        "completed",
        "cancelled",
      ],
      health_record_type: [
        "visit",
        "diagnostic",
        "prescription",
        "surgery",
        "allergy",
        "other",
      ],
      mating_intent: ["stud", "dam", "either"],
      pet_gender: ["male", "female"],
      pet_species: ["dog", "cat", "bird", "rabbit", "other"],
      request_status: [
        "pending",
        "accepted",
        "declined",
        "withdrawn",
        "agreed",
      ],
    },
  },
} as const
