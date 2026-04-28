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
      achievements: {
        Row: {
          earned_at: string
          id: string
          kind: string
          pet_id: string | null
          user_id: string
        }
        Insert: {
          earned_at?: string
          id?: string
          kind: string
          pet_id?: string | null
          user_id: string
        }
        Update: {
          earned_at?: string
          id?: string
          kind?: string
          pet_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      activity_logs: {
        Row: {
          appetite: number | null
          created_at: string
          energy: number | null
          id: string
          logged_for: string
          mood: string[] | null
          notes: string | null
          pet_id: string
          sleep_hours: number | null
          stool_score: number | null
          urine_frequency: number | null
          walk_minutes: number | null
          water_ml: number | null
        }
        Insert: {
          appetite?: number | null
          created_at?: string
          energy?: number | null
          id?: string
          logged_for?: string
          mood?: string[] | null
          notes?: string | null
          pet_id: string
          sleep_hours?: number | null
          stool_score?: number | null
          urine_frequency?: number | null
          walk_minutes?: number | null
          water_ml?: number | null
        }
        Update: {
          appetite?: number | null
          created_at?: string
          energy?: number | null
          id?: string
          logged_for?: string
          mood?: string[] | null
          notes?: string | null
          pet_id?: string
          sleep_hours?: number | null
          stool_score?: number | null
          urine_frequency?: number | null
          walk_minutes?: number | null
          water_ml?: number | null
        }
        Relationships: []
      }
      adoption_applications: {
        Row: {
          applicant_id: string
          city: string | null
          created_at: string
          decided_at: string | null
          family_size: number | null
          has_yard: boolean | null
          home_description: string | null
          id: string
          is_volunteer_interest: boolean
          listing_id: string | null
          other_pets: string | null
          phone: string | null
          prior_experience: string | null
          shelter_id: string
          shelter_note: string | null
          status: Database["public"]["Enums"]["adoption_application_status"]
          updated_at: string
        }
        Insert: {
          applicant_id: string
          city?: string | null
          created_at?: string
          decided_at?: string | null
          family_size?: number | null
          has_yard?: boolean | null
          home_description?: string | null
          id?: string
          is_volunteer_interest?: boolean
          listing_id?: string | null
          other_pets?: string | null
          phone?: string | null
          prior_experience?: string | null
          shelter_id: string
          shelter_note?: string | null
          status?: Database["public"]["Enums"]["adoption_application_status"]
          updated_at?: string
        }
        Update: {
          applicant_id?: string
          city?: string | null
          created_at?: string
          decided_at?: string | null
          family_size?: number | null
          has_yard?: boolean | null
          home_description?: string | null
          id?: string
          is_volunteer_interest?: boolean
          listing_id?: string | null
          other_pets?: string | null
          phone?: string | null
          prior_experience?: string | null
          shelter_id?: string
          shelter_note?: string | null
          status?: Database["public"]["Enums"]["adoption_application_status"]
          updated_at?: string
        }
        Relationships: []
      }
      appointment_messages: {
        Row: {
          appointment_id: string
          attachment_url: string | null
          body: string
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          appointment_id: string
          attachment_url?: string | null
          body: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          appointment_id?: string
          attachment_url?: string | null
          body?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          cancellation_reason: string | null
          created_at: string
          duration_min: number
          id: string
          mode: Database["public"]["Enums"]["appointment_mode"]
          notes: string | null
          owner_id: string
          pet_id: string
          prescription: string | null
          scheduled_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          triage_session_id: string | null
          updated_at: string
          vet_id: string
          video_provider: string | null
          video_room_name: string | null
          video_room_token_owner: string | null
          video_room_token_vet: string | null
          video_room_url: string | null
        }
        Insert: {
          cancellation_reason?: string | null
          created_at?: string
          duration_min?: number
          id?: string
          mode?: Database["public"]["Enums"]["appointment_mode"]
          notes?: string | null
          owner_id: string
          pet_id: string
          prescription?: string | null
          scheduled_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          triage_session_id?: string | null
          updated_at?: string
          vet_id: string
          video_provider?: string | null
          video_room_name?: string | null
          video_room_token_owner?: string | null
          video_room_token_vet?: string | null
          video_room_url?: string | null
        }
        Update: {
          cancellation_reason?: string | null
          created_at?: string
          duration_min?: number
          id?: string
          mode?: Database["public"]["Enums"]["appointment_mode"]
          notes?: string | null
          owner_id?: string
          pet_id?: string
          prescription?: string | null
          scheduled_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          triage_session_id?: string | null
          updated_at?: string
          vet_id?: string
          video_provider?: string | null
          video_room_name?: string | null
          video_room_token_owner?: string | null
          video_room_token_vet?: string | null
          video_room_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_triage_session_id_fkey"
            columns: ["triage_session_id"]
            isOneToOne: false
            referencedRelation: "vet_triage_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_users: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          reason: string | null
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          reason?: string | null
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          reason?: string | null
        }
        Relationships: []
      }
      boarding_services: {
        Row: {
          active: boolean
          city: string | null
          created_at: string
          description: string | null
          id: string
          owner_id: string
          photos: string[]
          price_inr_per_day: number | null
          service_type: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          city?: string | null
          created_at?: string
          description?: string | null
          id?: string
          owner_id: string
          photos?: string[]
          price_inr_per_day?: number | null
          service_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          city?: string | null
          created_at?: string
          description?: string | null
          id?: string
          owner_id?: string
          photos?: string[]
          price_inr_per_day?: number | null
          service_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      broadcasts: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          recipients_count: number | null
          sender_id: string
          target_city: string | null
          target_role: string | null
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          recipients_count?: number | null
          sender_id: string
          target_city?: string | null
          target_role?: string | null
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          recipients_count?: number | null
          sender_id?: string
          target_city?: string | null
          target_role?: string | null
          title?: string
        }
        Relationships: []
      }
      content_moderation_log: {
        Row: {
          author_id: string | null
          content_id: string | null
          content_type: string
          created_at: string
          excerpt: string | null
          id: string
          reasons: string[]
          score: number | null
          source: string
          verdict: Database["public"]["Enums"]["mod_verdict"]
        }
        Insert: {
          author_id?: string | null
          content_id?: string | null
          content_type: string
          created_at?: string
          excerpt?: string | null
          id?: string
          reasons?: string[]
          score?: number | null
          source?: string
          verdict: Database["public"]["Enums"]["mod_verdict"]
        }
        Update: {
          author_id?: string | null
          content_id?: string | null
          content_type?: string
          created_at?: string
          excerpt?: string | null
          id?: string
          reasons?: string[]
          score?: number | null
          source?: string
          verdict?: Database["public"]["Enums"]["mod_verdict"]
        }
        Relationships: []
      }
      conversation_members: {
        Row: {
          conversation_id: string
          joined_at: string
          last_read_at: string
          muted: boolean
          user_id: string
        }
        Insert: {
          conversation_id: string
          joined_at?: string
          last_read_at?: string
          muted?: boolean
          user_id: string
        }
        Update: {
          conversation_id?: string
          joined_at?: string
          last_read_at?: string
          muted?: boolean
          user_id?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_group: boolean
          last_message_at: string
          title: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_group?: boolean
          last_message_at?: string
          title?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_group?: boolean
          last_message_at?: string
          title?: string | null
        }
        Relationships: []
      }
      cron_health: {
        Row: {
          job_name: string
          last_error: string | null
          last_run_at: string
          last_status: string
          updated_at: string
        }
        Insert: {
          job_name: string
          last_error?: string | null
          last_run_at?: string
          last_status?: string
          updated_at?: string
        }
        Update: {
          job_name?: string
          last_error?: string | null
          last_run_at?: string
          last_status?: string
          updated_at?: string
        }
        Relationships: []
      }
      daily_moments: {
        Row: {
          id: string
          late_minutes: number
          on_time: boolean
          post_id: string
          posted_at: string
          prompt_id: string
          user_id: string
        }
        Insert: {
          id?: string
          late_minutes?: number
          on_time?: boolean
          post_id: string
          posted_at?: string
          prompt_id: string
          user_id: string
        }
        Update: {
          id?: string
          late_minutes?: number
          on_time?: boolean
          post_id?: string
          posted_at?: string
          prompt_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_moments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_moments_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "daily_prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_prompts: {
        Row: {
          created_at: string
          dropped_at: string
          id: string
          prompt_date: string
          prompt_text: string
          window_minutes: number
        }
        Insert: {
          created_at?: string
          dropped_at?: string
          id?: string
          prompt_date: string
          prompt_text: string
          window_minutes?: number
        }
        Update: {
          created_at?: string
          dropped_at?: string
          id?: string
          prompt_date?: string
          prompt_text?: string
          window_minutes?: number
        }
        Relationships: []
      }
      daily_streaks: {
        Row: {
          current_streak: number
          last_posted_date: string | null
          longest_streak: number
          updated_at: string
          user_id: string
        }
        Insert: {
          current_streak?: number
          last_posted_date?: string | null
          longest_streak?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          current_streak?: number
          last_posted_date?: string | null
          longest_streak?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      deletion_log: {
        Row: {
          deleted_at: string
          email_hash: string | null
          id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          deleted_at?: string
          email_hash?: string | null
          id?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          deleted_at?: string
          email_hash?: string | null
          id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      error_log: {
        Row: {
          created_at: string
          id: string
          message: string
          meta: Json | null
          route: string | null
          source: string
          stack: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          meta?: Json | null
          route?: string | null
          source: string
          stack?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          meta?: Json | null
          route?: string | null
          source?: string
          stack?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          description: string | null
          enabled: boolean
          key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          description?: string | null
          enabled?: boolean
          key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          description?: string | null
          enabled?: boolean
          key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: []
      }
      group_members: {
        Row: {
          group_id: string
          joined_at: string
          role: Database["public"]["Enums"]["group_member_role"]
          user_id: string
        }
        Insert: {
          group_id: string
          joined_at?: string
          role?: Database["public"]["Enums"]["group_member_role"]
          user_id: string
        }
        Update: {
          group_id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["group_member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_posts: {
        Row: {
          added_at: string
          added_by: string
          group_id: string
          post_id: string
        }
        Insert: {
          added_at?: string
          added_by: string
          group_id: string
          post_id: string
        }
        Update: {
          added_at?: string
          added_by?: string
          group_id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_posts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          cover_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          key: string
          kind: Database["public"]["Enums"]["group_kind"]
          member_count: number
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          key: string
          kind: Database["public"]["Enums"]["group_kind"]
          member_count?: number
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          key?: string
          kind?: Database["public"]["Enums"]["group_kind"]
          member_count?: number
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      health_insights: {
        Row: {
          data_signature: string | null
          generated_at: string
          id: string
          insights: Json
          model: string | null
          owner_id: string
          pet_id: string
          summary: string
        }
        Insert: {
          data_signature?: string | null
          generated_at?: string
          id?: string
          insights?: Json
          model?: string | null
          owner_id: string
          pet_id: string
          summary: string
        }
        Update: {
          data_signature?: string | null
          generated_at?: string
          id?: string
          insights?: Json
          model?: string | null
          owner_id?: string
          pet_id?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_insights_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: true
            referencedRelation: "pet_health_status"
            referencedColumns: ["pet_id"]
          },
          {
            foreignKeyName: "health_insights_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: true
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      health_records: {
        Row: {
          created_at: string
          document_path: string | null
          id: string
          notes: string | null
          occurred_on: string
          pet_id: string
          record_type: Database["public"]["Enums"]["health_record_type"]
          source_post_id: string | null
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
          source_post_id?: string | null
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
          source_post_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_records_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pet_health_status"
            referencedColumns: ["pet_id"]
          },
          {
            foreignKeyName: "health_records_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_leads: {
        Row: {
          commission_inr: number | null
          created_at: string
          id: string
          notes: string | null
          partner_id: string
          partner_ref: string | null
          pet_age_months_snapshot: number | null
          pet_breed_snapshot: string | null
          pet_id: string
          premium_inr: number | null
          status: Database["public"]["Enums"]["insurance_lead_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          commission_inr?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          partner_id: string
          partner_ref?: string | null
          pet_age_months_snapshot?: number | null
          pet_breed_snapshot?: string | null
          pet_id: string
          premium_inr?: number | null
          status?: Database["public"]["Enums"]["insurance_lead_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          commission_inr?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          partner_id?: string
          partner_ref?: string | null
          pet_age_months_snapshot?: number | null
          pet_breed_snapshot?: string | null
          pet_id?: string
          premium_inr?: number | null
          status?: Database["public"]["Enums"]["insurance_lead_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurance_leads_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "insurance_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_leads_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pet_health_status"
            referencedColumns: ["pet_id"]
          },
          {
            foreignKeyName: "insurance_leads_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_partners: {
        Row: {
          active: boolean
          blurb: string | null
          commission_pct: number
          country: string
          created_at: string
          id: string
          logo_url: string | null
          name: string
          plan_max_inr: number | null
          plan_min_inr: number | null
          redirect_url: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          blurb?: string | null
          commission_pct?: number
          country?: string
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          plan_max_inr?: number | null
          plan_min_inr?: number | null
          redirect_url: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          blurb?: string | null
          commission_pct?: number
          country?: string
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          plan_max_inr?: number | null
          plan_min_inr?: number | null
          redirect_url?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      litter_groups: {
        Row: {
          birth_date: string | null
          created_at: string
          created_by: string
          dam_pet_id: string | null
          id: string
          notes: string | null
          sire_pet_id: string | null
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          created_by: string
          dam_pet_id?: string | null
          id?: string
          notes?: string | null
          sire_pet_id?: string | null
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          created_by?: string
          dam_pet_id?: string | null
          id?: string
          notes?: string | null
          sire_pet_id?: string | null
        }
        Relationships: []
      }
      litter_pets: {
        Row: {
          added_at: string
          litter_id: string
          pet_id: string
        }
        Insert: {
          added_at?: string
          litter_id: string
          pet_id: string
        }
        Update: {
          added_at?: string
          litter_id?: string
          pet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "litter_pets_litter_id_fkey"
            columns: ["litter_id"]
            isOneToOne: false
            referencedRelation: "litter_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "litter_pets_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pet_health_status"
            referencedColumns: ["pet_id"]
          },
          {
            foreignKeyName: "litter_pets_pet_id_fkey"
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
          deal_type: string
          extra_terms: string | null
          from_signature: string | null
          from_signed_at: string | null
          id: string
          meeting_date: string | null
          meeting_location: string | null
          puppy_split_owner_pct: number | null
          puppy_split_partner_pct: number | null
          request_id: string
          stud_fee_inr: number | null
          terms_locked: boolean
          terms_text: string
          to_signature: string | null
          to_signed_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deal_type?: string
          extra_terms?: string | null
          from_signature?: string | null
          from_signed_at?: string | null
          id?: string
          meeting_date?: string | null
          meeting_location?: string | null
          puppy_split_owner_pct?: number | null
          puppy_split_partner_pct?: number | null
          request_id: string
          stud_fee_inr?: number | null
          terms_locked?: boolean
          terms_text: string
          to_signature?: string | null
          to_signed_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deal_type?: string
          extra_terms?: string | null
          from_signature?: string | null
          from_signed_at?: string | null
          id?: string
          meeting_date?: string | null
          meeting_location?: string | null
          puppy_split_owner_pct?: number | null
          puppy_split_partner_pct?: number | null
          request_id?: string
          stud_fee_inr?: number | null
          terms_locked?: boolean
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
          boosted_until: string | null
          city: string | null
          created_at: string
          description: string | null
          featured: boolean
          fee_inr: number | null
          id: string
          intent: Database["public"]["Enums"]["mating_intent"]
          owner_id: string
          paid_until: string | null
          pet_id: string
          requirements: string | null
          travel_km: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          boosted_until?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          featured?: boolean
          fee_inr?: number | null
          id?: string
          intent?: Database["public"]["Enums"]["mating_intent"]
          owner_id: string
          paid_until?: string | null
          pet_id: string
          requirements?: string | null
          travel_km?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          boosted_until?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          featured?: boolean
          fee_inr?: number | null
          id?: string
          intent?: Database["public"]["Enums"]["mating_intent"]
          owner_id?: string
          paid_until?: string | null
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
            referencedRelation: "pet_health_status"
            referencedColumns: ["pet_id"]
          },
          {
            foreignKeyName: "mating_listings_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: true
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      mating_payments: {
        Row: {
          amount_inr: number
          confirmed_at: string | null
          created_at: string
          id: string
          kind: string
          marked_paid_at: string | null
          method: string
          notes: string | null
          payee_id: string
          payer_id: string
          reference: string | null
          request_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount_inr: number
          confirmed_at?: string | null
          created_at?: string
          id?: string
          kind: string
          marked_paid_at?: string | null
          method?: string
          notes?: string | null
          payee_id: string
          payer_id: string
          reference?: string | null
          request_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount_inr?: number
          confirmed_at?: string | null
          created_at?: string
          id?: string
          kind?: string
          marked_paid_at?: string | null
          method?: string
          notes?: string | null
          payee_id?: string
          payer_id?: string
          reference?: string | null
          request_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mating_payments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "mating_requests"
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
            referencedRelation: "pet_health_status"
            referencedColumns: ["pet_id"]
          },
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
            referencedRelation: "pet_health_status"
            referencedColumns: ["pet_id"]
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
      medication_logs: {
        Row: {
          active: boolean
          appointment_id: string | null
          created_at: string
          dose: string | null
          end_on: string | null
          frequency: string | null
          id: string
          name: string
          pet_id: string
          prescribed_by_vet_id: string | null
          prescribing_vet: string | null
          reason: string | null
          route: string | null
          start_on: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          appointment_id?: string | null
          created_at?: string
          dose?: string | null
          end_on?: string | null
          frequency?: string | null
          id?: string
          name: string
          pet_id: string
          prescribed_by_vet_id?: string | null
          prescribing_vet?: string | null
          reason?: string | null
          route?: string | null
          start_on?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          appointment_id?: string | null
          created_at?: string
          dose?: string | null
          end_on?: string | null
          frequency?: string | null
          id?: string
          name?: string
          pet_id?: string
          prescribed_by_vet_id?: string | null
          prescribing_vet?: string | null
          reason?: string | null
          route?: string | null
          start_on?: string
          updated_at?: string
        }
        Relationships: []
      }
      meetup_rsvps: {
        Row: {
          created_at: string
          meetup_id: string
          pet_id: string | null
          status: Database["public"]["Enums"]["rsvp_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          meetup_id: string
          pet_id?: string | null
          status?: Database["public"]["Enums"]["rsvp_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          meetup_id?: string
          pet_id?: string | null
          status?: Database["public"]["Enums"]["rsvp_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetup_rsvps_meetup_id_fkey"
            columns: ["meetup_id"]
            isOneToOne: false
            referencedRelation: "meetups"
            referencedColumns: ["id"]
          },
        ]
      }
      meetups: {
        Row: {
          attending_count: number
          capacity: number | null
          city: string | null
          cover_url: string | null
          created_at: string
          description: string | null
          group_id: string | null
          host_id: string
          id: string
          lat: number | null
          lng: number | null
          starts_at: string
          status: Database["public"]["Enums"]["meetup_status"]
          title: string
          updated_at: string
          venue: string | null
        }
        Insert: {
          attending_count?: number
          capacity?: number | null
          city?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          group_id?: string | null
          host_id: string
          id?: string
          lat?: number | null
          lng?: number | null
          starts_at: string
          status?: Database["public"]["Enums"]["meetup_status"]
          title: string
          updated_at?: string
          venue?: string | null
        }
        Update: {
          attending_count?: number
          capacity?: number | null
          city?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          group_id?: string | null
          host_id?: string
          id?: string
          lat?: number | null
          lng?: number | null
          starts_at?: string
          status?: Database["public"]["Enums"]["meetup_status"]
          title?: string
          updated_at?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meetups_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_kind: string | null
          attachment_url: string | null
          body: string | null
          conversation_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          sender_id: string
        }
        Insert: {
          attachment_kind?: string | null
          attachment_url?: string | null
          body?: string | null
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          sender_id: string
        }
        Update: {
          attachment_kind?: string | null
          attachment_url?: string | null
          body?: string | null
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          sender_id?: string
        }
        Relationships: []
      }
      missing_pet_sightings: {
        Row: {
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          missing_pet_id: string
          note: string | null
          photo_url: string | null
          reporter_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          missing_pet_id: string
          note?: string | null
          photo_url?: string | null
          reporter_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          missing_pet_id?: string
          note?: string | null
          photo_url?: string | null
          reporter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "missing_pet_sightings_missing_pet_id_fkey"
            columns: ["missing_pet_id"]
            isOneToOne: false
            referencedRelation: "missing_pets"
            referencedColumns: ["id"]
          },
        ]
      }
      missing_pets: {
        Row: {
          created_at: string
          id: string
          last_seen_at: string
          last_seen_city: string | null
          last_seen_lat: number | null
          last_seen_lng: number | null
          note: string | null
          owner_id: string
          pet_id: string
          photo_url: string | null
          resolved_at: string | null
          reward_inr: number | null
          status: Database["public"]["Enums"]["missing_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_seen_at?: string
          last_seen_city?: string | null
          last_seen_lat?: number | null
          last_seen_lng?: number | null
          note?: string | null
          owner_id: string
          pet_id: string
          photo_url?: string | null
          resolved_at?: string | null
          reward_inr?: number | null
          status?: Database["public"]["Enums"]["missing_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_seen_at?: string
          last_seen_city?: string | null
          last_seen_lat?: number | null
          last_seen_lng?: number | null
          note?: string | null
          owner_id?: string
          pet_id?: string
          photo_url?: string | null
          resolved_at?: string | null
          reward_inr?: number | null
          status?: Database["public"]["Enums"]["missing_status"]
          updated_at?: string
        }
        Relationships: []
      }
      notification_jobs: {
        Row: {
          attempts: number
          created_at: string
          id: string
          kind: string
          last_error: string | null
          payload: Json
          processed_at: string | null
          status: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          kind: string
          last_error?: string | null
          payload: Json
          processed_at?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          kind?: string
          last_error?: string | null
          payload?: Json
          processed_at?: string | null
          status?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
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
            referencedRelation: "pet_health_status"
            referencedColumns: ["pet_id"]
          },
          {
            foreignKeyName: "nutrition_logs_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      org_profiles: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          description: string | null
          donation_upi: string | null
          donation_url: string | null
          facility_photos: string[]
          lat: number | null
          lng: number | null
          org_name: string
          org_type: Database["public"]["Enums"]["account_type"]
          phone: string | null
          pincode: string | null
          registration_doc_url: string | null
          registration_no: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          state: string | null
          status: string
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          donation_upi?: string | null
          donation_url?: string | null
          facility_photos?: string[]
          lat?: number | null
          lng?: number | null
          org_name: string
          org_type: Database["public"]["Enums"]["account_type"]
          phone?: string | null
          pincode?: string | null
          registration_doc_url?: string | null
          registration_no?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          donation_upi?: string | null
          donation_url?: string | null
          facility_photos?: string[]
          lat?: number | null
          lng?: number | null
          org_name?: string
          org_type?: Database["public"]["Enums"]["account_type"]
          phone?: string | null
          pincode?: string | null
          registration_doc_url?: string | null
          registration_no?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      ownership_transfers: {
        Row: {
          created_at: string
          decided_at: string | null
          from_user_id: string
          id: string
          listing_id: string
          note: string | null
          pet_id: string
          price_inr: number | null
          status: Database["public"]["Enums"]["transfer_status"]
          to_user_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          from_user_id: string
          id?: string
          listing_id: string
          note?: string | null
          pet_id: string
          price_inr?: number | null
          status?: Database["public"]["Enums"]["transfer_status"]
          to_user_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          from_user_id?: string
          id?: string
          listing_id?: string
          note?: string | null
          pet_id?: string
          price_inr?: number | null
          status?: Database["public"]["Enums"]["transfer_status"]
          to_user_id?: string
        }
        Relationships: []
      }
      parasite_preventatives: {
        Row: {
          batch_number: string | null
          created_at: string
          given_on: string
          id: string
          next_due_on: string | null
          notes: string | null
          parasite_type: Database["public"]["Enums"]["parasite_type"]
          pet_id: string
          product_name: string
        }
        Insert: {
          batch_number?: string | null
          created_at?: string
          given_on?: string
          id?: string
          next_due_on?: string | null
          notes?: string | null
          parasite_type?: Database["public"]["Enums"]["parasite_type"]
          pet_id: string
          product_name: string
        }
        Update: {
          batch_number?: string | null
          created_at?: string
          given_on?: string
          id?: string
          next_due_on?: string | null
          notes?: string | null
          parasite_type?: Database["public"]["Enums"]["parasite_type"]
          pet_id?: string
          product_name?: string
        }
        Relationships: []
      }
      payment_intents: {
        Row: {
          amount_inr: number
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["payment_kind"]
          provider_session_id: string | null
          ref_id: string | null
          status: Database["public"]["Enums"]["payment_intent_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_inr: number
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["payment_kind"]
          provider_session_id?: string | null
          ref_id?: string | null
          status?: Database["public"]["Enums"]["payment_intent_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_inr?: number
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["payment_kind"]
          provider_session_id?: string | null
          ref_id?: string | null
          status?: Database["public"]["Enums"]["payment_intent_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pet_access_requests: {
        Row: {
          created_at: string
          id: string
          message: string | null
          owner_id: string
          pet_id: string
          responded_at: string | null
          status: Database["public"]["Enums"]["access_request_status"]
          vet_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          owner_id: string
          pet_id: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["access_request_status"]
          vet_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          owner_id?: string
          pet_id?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["access_request_status"]
          vet_id?: string
        }
        Relationships: []
      }
      pet_care_team: {
        Row: {
          granted_at: string
          id: string
          pet_id: string
          revoked_at: string | null
          vet_id: string
        }
        Insert: {
          granted_at?: string
          id?: string
          pet_id: string
          revoked_at?: string | null
          vet_id: string
        }
        Update: {
          granted_at?: string
          id?: string
          pet_id?: string
          revoked_at?: string | null
          vet_id?: string
        }
        Relationships: []
      }
      pet_listings: {
        Row: {
          active: boolean
          age_weeks: number
          bred_on_petos: boolean
          breed: string | null
          breeder_cert_url: string | null
          city: string | null
          created_at: string
          description: string | null
          fee_inr: number | null
          gender: string | null
          id: string
          lat: number | null
          listing_type: Database["public"]["Enums"]["pet_listing_type"]
          litter_id: string | null
          lng: number | null
          microchip_id: string | null
          owner_id: string
          parents_info: Json | null
          pet_id: string | null
          photos: string[]
          seller_type: Database["public"]["Enums"]["account_type"] | null
          species: string | null
          status: Database["public"]["Enums"]["pet_listing_status"]
          title: string
          updated_at: string
          vaccination_doc_url: string
        }
        Insert: {
          active?: boolean
          age_weeks: number
          bred_on_petos?: boolean
          breed?: string | null
          breeder_cert_url?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          fee_inr?: number | null
          gender?: string | null
          id?: string
          lat?: number | null
          listing_type: Database["public"]["Enums"]["pet_listing_type"]
          litter_id?: string | null
          lng?: number | null
          microchip_id?: string | null
          owner_id: string
          parents_info?: Json | null
          pet_id?: string | null
          photos?: string[]
          seller_type?: Database["public"]["Enums"]["account_type"] | null
          species?: string | null
          status?: Database["public"]["Enums"]["pet_listing_status"]
          title: string
          updated_at?: string
          vaccination_doc_url: string
        }
        Update: {
          active?: boolean
          age_weeks?: number
          bred_on_petos?: boolean
          breed?: string | null
          breeder_cert_url?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          fee_inr?: number | null
          gender?: string | null
          id?: string
          lat?: number | null
          listing_type?: Database["public"]["Enums"]["pet_listing_type"]
          litter_id?: string | null
          lng?: number | null
          microchip_id?: string | null
          owner_id?: string
          parents_info?: Json | null
          pet_id?: string | null
          photos?: string[]
          seller_type?: Database["public"]["Enums"]["account_type"] | null
          species?: string | null
          status?: Database["public"]["Enums"]["pet_listing_status"]
          title?: string
          updated_at?: string
          vaccination_doc_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "pet_listings_litter_id_fkey"
            columns: ["litter_id"]
            isOneToOne: false
            referencedRelation: "litter_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_listings_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pet_health_status"
            referencedColumns: ["pet_id"]
          },
          {
            foreignKeyName: "pet_listings_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      pets: {
        Row: {
          activity_level: Database["public"]["Enums"]["activity_level"] | null
          allergies: string[]
          avatar_url: string | null
          avatar_url_feed: string | null
          avatar_url_full: string | null
          avatar_url_thumb: string | null
          bio: string | null
          blood_type: string | null
          breed: string | null
          city: string | null
          conditions: string[]
          created_at: string
          current_medications: string | null
          dam_pet_id: string | null
          date_of_birth: string | null
          diet_type: Database["public"]["Enums"]["diet_type"] | null
          discoverable_for_mating: boolean
          gender: Database["public"]["Enums"]["pet_gender"] | null
          id: string
          insurance_policy: string | null
          insurance_provider: string | null
          lat: number | null
          litter_id: string | null
          lng: number | null
          microchip_id: string | null
          name: string
          neutered: boolean | null
          owner_id: string
          primary_vet_id: string | null
          public_id: string | null
          sire_pet_id: string | null
          social_level: Database["public"]["Enums"]["social_level"] | null
          species: Database["public"]["Enums"]["pet_species"]
          status_chip: string | null
          temperament: string[]
          updated_at: string
          vaccination_verified: boolean
          weight_kg: number | null
        }
        Insert: {
          activity_level?: Database["public"]["Enums"]["activity_level"] | null
          allergies?: string[]
          avatar_url?: string | null
          avatar_url_feed?: string | null
          avatar_url_full?: string | null
          avatar_url_thumb?: string | null
          bio?: string | null
          blood_type?: string | null
          breed?: string | null
          city?: string | null
          conditions?: string[]
          created_at?: string
          current_medications?: string | null
          dam_pet_id?: string | null
          date_of_birth?: string | null
          diet_type?: Database["public"]["Enums"]["diet_type"] | null
          discoverable_for_mating?: boolean
          gender?: Database["public"]["Enums"]["pet_gender"] | null
          id?: string
          insurance_policy?: string | null
          insurance_provider?: string | null
          lat?: number | null
          litter_id?: string | null
          lng?: number | null
          microchip_id?: string | null
          name: string
          neutered?: boolean | null
          owner_id: string
          primary_vet_id?: string | null
          public_id?: string | null
          sire_pet_id?: string | null
          social_level?: Database["public"]["Enums"]["social_level"] | null
          species: Database["public"]["Enums"]["pet_species"]
          status_chip?: string | null
          temperament?: string[]
          updated_at?: string
          vaccination_verified?: boolean
          weight_kg?: number | null
        }
        Update: {
          activity_level?: Database["public"]["Enums"]["activity_level"] | null
          allergies?: string[]
          avatar_url?: string | null
          avatar_url_feed?: string | null
          avatar_url_full?: string | null
          avatar_url_thumb?: string | null
          bio?: string | null
          blood_type?: string | null
          breed?: string | null
          city?: string | null
          conditions?: string[]
          created_at?: string
          current_medications?: string | null
          dam_pet_id?: string | null
          date_of_birth?: string | null
          diet_type?: Database["public"]["Enums"]["diet_type"] | null
          discoverable_for_mating?: boolean
          gender?: Database["public"]["Enums"]["pet_gender"] | null
          id?: string
          insurance_policy?: string | null
          insurance_provider?: string | null
          lat?: number | null
          litter_id?: string | null
          lng?: number | null
          microchip_id?: string | null
          name?: string
          neutered?: boolean | null
          owner_id?: string
          primary_vet_id?: string | null
          public_id?: string | null
          sire_pet_id?: string | null
          social_level?: Database["public"]["Enums"]["social_level"] | null
          species?: Database["public"]["Enums"]["pet_species"]
          status_chip?: string | null
          temperament?: string[]
          updated_at?: string
          vaccination_verified?: boolean
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pets_litter_id_fkey"
            columns: ["litter_id"]
            isOneToOne: false
            referencedRelation: "litter_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      pharmacy_suggestions: {
        Row: {
          appointment_id: string | null
          created_at: string
          dose: string | null
          duration: string | null
          frequency: string | null
          id: string
          med_name: string
          medication_log_id: string | null
          notes: string | null
          owner_id: string
          pet_id: string
          status: string
          vet_id: string
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          dose?: string | null
          duration?: string | null
          frequency?: string | null
          id?: string
          med_name: string
          medication_log_id?: string | null
          notes?: string | null
          owner_id: string
          pet_id: string
          status?: string
          vet_id: string
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          dose?: string | null
          duration?: string | null
          frequency?: string | null
          id?: string
          med_name?: string
          medication_log_id?: string | null
          notes?: string | null
          owner_id?: string
          pet_id?: string
          status?: string
          vet_id?: string
        }
        Relationships: []
      }
      post_collaborators: {
        Row: {
          invited_at: string
          pet_id: string | null
          post_id: string
          responded_at: string | null
          status: Database["public"]["Enums"]["collab_status"]
          user_id: string
        }
        Insert: {
          invited_at?: string
          pet_id?: string | null
          post_id: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["collab_status"]
          user_id: string
        }
        Update: {
          invited_at?: string
          pet_id?: string | null
          post_id?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["collab_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_collaborators_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          pet_id: string | null
          post_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          pet_id?: string | null
          post_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          pet_id?: string | null
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
      post_hashtags: {
        Row: {
          created_at: string
          post_id: string
          tag: string
        }
        Insert: {
          created_at?: string
          post_id: string
          tag: string
        }
        Update: {
          created_at?: string
          post_id?: string
          tag?: string
        }
        Relationships: []
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
      post_reactions: {
        Row: {
          created_at: string
          id: string
          kind: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          post_id?: string
          user_id?: string
        }
        Relationships: []
      }
      post_saves: {
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
        Relationships: []
      }
      posts: {
        Row: {
          author_id: string
          caption: string | null
          comment_count: number
          created_at: string
          health_kind: string | null
          health_pet_id: string | null
          health_value: Json | null
          id: string
          image_url: string | null
          image_url_feed: string | null
          image_url_full: string | null
          image_url_thumb: string | null
          like_count: number
          pet_id: string | null
          reaction_counts: Json
          updated_at: string
        }
        Insert: {
          author_id: string
          caption?: string | null
          comment_count?: number
          created_at?: string
          health_kind?: string | null
          health_pet_id?: string | null
          health_value?: Json | null
          id?: string
          image_url?: string | null
          image_url_feed?: string | null
          image_url_full?: string | null
          image_url_thumb?: string | null
          like_count?: number
          pet_id?: string | null
          reaction_counts?: Json
          updated_at?: string
        }
        Update: {
          author_id?: string
          caption?: string | null
          comment_count?: number
          created_at?: string
          health_kind?: string | null
          health_pet_id?: string | null
          health_value?: Json | null
          id?: string
          image_url?: string | null
          image_url_feed?: string | null
          image_url_full?: string | null
          image_url_thumb?: string | null
          like_count?: number
          pet_id?: string | null
          reaction_counts?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pet_health_status"
            referencedColumns: ["pet_id"]
          },
          {
            foreignKeyName: "posts_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      proactive_alerts: {
        Row: {
          body: string
          created_at: string
          dedupe_key: string | null
          dismissed_at: string | null
          id: string
          kind: string
          link: string | null
          pet_id: string | null
          severity: number
          title: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          dedupe_key?: string | null
          dismissed_at?: string | null
          id?: string
          kind: string
          link?: string | null
          pet_id?: string | null
          severity?: number
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          dedupe_key?: string | null
          dismissed_at?: string | null
          id?: string
          kind?: string
          link?: string | null
          pet_id?: string | null
          severity?: number
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proactive_alerts_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pet_health_status"
            referencedColumns: ["pet_id"]
          },
          {
            foreignKeyName: "proactive_alerts_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          avatar_url: string | null
          avatar_url_feed: string | null
          avatar_url_full: string | null
          avatar_url_thumb: string | null
          bio: string | null
          breeder_cert_url: string | null
          breeder_verified: boolean
          city: string | null
          cover_url: string | null
          created_at: string
          emergency_vet: Json | null
          full_name: string | null
          goals: string[]
          handle: string | null
          id: string
          interests: string[] | null
          language: string | null
          lat: number | null
          lng: number | null
          looking_for: Json | null
          notif_prefs: Json
          notify_plus_launch: boolean
          onboarded: boolean
          phone: string | null
          units: Json
          updated_at: string
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["account_type"]
          avatar_url?: string | null
          avatar_url_feed?: string | null
          avatar_url_full?: string | null
          avatar_url_thumb?: string | null
          bio?: string | null
          breeder_cert_url?: string | null
          breeder_verified?: boolean
          city?: string | null
          cover_url?: string | null
          created_at?: string
          emergency_vet?: Json | null
          full_name?: string | null
          goals?: string[]
          handle?: string | null
          id: string
          interests?: string[] | null
          language?: string | null
          lat?: number | null
          lng?: number | null
          looking_for?: Json | null
          notif_prefs?: Json
          notify_plus_launch?: boolean
          onboarded?: boolean
          phone?: string | null
          units?: Json
          updated_at?: string
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          avatar_url?: string | null
          avatar_url_feed?: string | null
          avatar_url_full?: string | null
          avatar_url_thumb?: string | null
          bio?: string | null
          breeder_cert_url?: string | null
          breeder_verified?: boolean
          city?: string | null
          cover_url?: string | null
          created_at?: string
          emergency_vet?: Json | null
          full_name?: string | null
          goals?: string[]
          handle?: string | null
          id?: string
          interests?: string[] | null
          language?: string | null
          lat?: number | null
          lng?: number | null
          looking_for?: Json | null
          notif_prefs?: Json
          notify_plus_launch?: boolean
          onboarded?: boolean
          phone?: string | null
          units?: Json
          updated_at?: string
        }
        Relationships: []
      }
      provider_quiz_attempts: {
        Row: {
          answers: Json
          created_at: string
          id: string
          passed: boolean
          provider_id: string
          score: number
          total: number
          user_id: string
        }
        Insert: {
          answers?: Json
          created_at?: string
          id?: string
          passed: boolean
          provider_id: string
          score: number
          total: number
          user_id: string
        }
        Update: {
          answers?: Json
          created_at?: string
          id?: string
          passed?: boolean
          provider_id?: string
          score?: number
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_quiz_attempts_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_used_at: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_used_at?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_used_at?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      recurring_bookings: {
        Row: {
          created_at: string
          customer_id: string
          end_date: string | null
          frequency: string
          id: string
          notes: string | null
          pet_id: string | null
          provider_id: string
          start_date: string
          status: string
          time_of_day: string
          updated_at: string
          weekdays: number[]
        }
        Insert: {
          created_at?: string
          customer_id: string
          end_date?: string | null
          frequency?: string
          id?: string
          notes?: string | null
          pet_id?: string | null
          provider_id: string
          start_date: string
          status?: string
          time_of_day: string
          updated_at?: string
          weekdays?: number[]
        }
        Update: {
          created_at?: string
          customer_id?: string
          end_date?: string | null
          frequency?: string
          id?: string
          notes?: string | null
          pet_id?: string | null
          provider_id?: string
          start_date?: string
          status?: string
          time_of_day?: string
          updated_at?: string
          weekdays?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "recurring_bookings_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pet_health_status"
            referencedColumns: ["pet_id"]
          },
          {
            foreignKeyName: "recurring_bookings_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_log: {
        Row: {
          id: string
          kind: string
          ref_id: string | null
          sent_at: string
          vaccination_id: string | null
        }
        Insert: {
          id?: string
          kind: string
          ref_id?: string | null
          sent_at?: string
          vaccination_id?: string | null
        }
        Update: {
          id?: string
          kind?: string
          ref_id?: string | null
          sent_at?: string
          vaccination_id?: string | null
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          reason: string
          reporter_id: string
          resolved_at: string | null
          resolver_id: string | null
          resolver_notes: string | null
          status: Database["public"]["Enums"]["report_status"]
          subject_id: string
          subject_type: Database["public"]["Enums"]["report_subject"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reporter_id: string
          resolved_at?: string | null
          resolver_id?: string | null
          resolver_notes?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          subject_id: string
          subject_type: Database["public"]["Enums"]["report_subject"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          resolved_at?: string | null
          resolver_id?: string | null
          resolver_notes?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          subject_id?: string
          subject_type?: Database["public"]["Enums"]["report_subject"]
          updated_at?: string
        }
        Relationships: []
      }
      repro_logs: {
        Row: {
          created_at: string
          event_type: string
          id: string
          litter_count: number | null
          notes: string | null
          occurred_on: string
          partner_pet_id: string | null
          pet_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          litter_count?: number | null
          notes?: string | null
          occurred_on?: string
          partner_pet_id?: string | null
          pet_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          litter_count?: number | null
          notes?: string | null
          occurred_on?: string
          partner_pet_id?: string | null
          pet_id?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          body: string | null
          created_at: string
          id: string
          rating: number
          reviewer_id: string
          subject_id: string
          subject_type: Database["public"]["Enums"]["review_subject"]
          updated_at: string
          verified_purchase: boolean
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          rating: number
          reviewer_id: string
          subject_id: string
          subject_type: Database["public"]["Enums"]["review_subject"]
          updated_at?: string
          verified_purchase?: boolean
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          rating?: number
          reviewer_id?: string
          subject_id?: string
          subject_type?: Database["public"]["Enums"]["review_subject"]
          updated_at?: string
          verified_purchase?: boolean
        }
        Relationships: []
      }
      reward_accounts: {
        Row: {
          available_points: number
          created_at: string
          lifetime_earned: number
          lifetime_redeemed: number
          pending_points: number
          updated_at: string
          user_id: string
        }
        Insert: {
          available_points?: number
          created_at?: string
          lifetime_earned?: number
          lifetime_redeemed?: number
          pending_points?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          available_points?: number
          created_at?: string
          lifetime_earned?: number
          lifetime_redeemed?: number
          pending_points?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reward_ledger: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          kind: Database["public"]["Enums"]["reward_kind"]
          metadata: Json
          points: number
          reason: string
          reference_id: string | null
          reference_type: string | null
          release_after: string | null
          status: Database["public"]["Enums"]["reward_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          kind: Database["public"]["Enums"]["reward_kind"]
          metadata?: Json
          points: number
          reason: string
          reference_id?: string | null
          reference_type?: string | null
          release_after?: string | null
          status?: Database["public"]["Enums"]["reward_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["reward_kind"]
          metadata?: Json
          points?: number
          reason?: string
          reference_id?: string | null
          reference_type?: string | null
          release_after?: string | null
          status?: Database["public"]["Enums"]["reward_status"]
          user_id?: string
        }
        Relationships: []
      }
      reward_redemptions: {
        Row: {
          applied_to_reference_id: string | null
          applied_to_reference_type: string | null
          created_at: string
          id: string
          inr_value: number
          kind: Database["public"]["Enums"]["redemption_kind"]
          notes: string | null
          points_spent: number
          status: Database["public"]["Enums"]["redemption_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          applied_to_reference_id?: string | null
          applied_to_reference_type?: string | null
          created_at?: string
          id?: string
          inr_value?: number
          kind: Database["public"]["Enums"]["redemption_kind"]
          notes?: string | null
          points_spent: number
          status?: Database["public"]["Enums"]["redemption_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          applied_to_reference_id?: string | null
          applied_to_reference_type?: string | null
          created_at?: string
          id?: string
          inr_value?: number
          kind?: Database["public"]["Enums"]["redemption_kind"]
          notes?: string | null
          points_spent?: number
          status?: Database["public"]["Enums"]["redemption_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reward_rules: {
        Row: {
          active: boolean
          description: string | null
          escrow_days: number
          kind: string
          points: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          description?: string | null
          escrow_days?: number
          kind: string
          points: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          description?: string | null
          escrow_days?: number
          kind?: string
          points?: number
          updated_at?: string
        }
        Relationships: []
      }
      service_bookings: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          notes: string | null
          parent_recurring_id: string | null
          pet_id: string | null
          provider_id: string
          public_share_token: string | null
          scheduled_at: string
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          notes?: string | null
          parent_recurring_id?: string | null
          pet_id?: string | null
          provider_id: string
          public_share_token?: string | null
          scheduled_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          notes?: string | null
          parent_recurring_id?: string | null
          pet_id?: string | null
          provider_id?: string
          public_share_token?: string | null
          scheduled_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_bookings_parent_recurring_id_fkey"
            columns: ["parent_recurring_id"]
            isOneToOne: false
            referencedRelation: "recurring_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      service_providers: {
        Row: {
          active: boolean
          address_proof_path: string | null
          bio: string | null
          category: Database["public"]["Enums"]["service_category"]
          city: string | null
          contact_phone: string | null
          cover_url: string | null
          created_at: string
          hourly_rate_inr: number | null
          id: string
          id_proof_path: string | null
          lat: number | null
          lng: number | null
          name: string
          owner_id: string
          quiz_passed_at: string | null
          quiz_score: number | null
          trust_status: string
          updated_at: string
          verified: boolean
          years_experience: number | null
        }
        Insert: {
          active?: boolean
          address_proof_path?: string | null
          bio?: string | null
          category: Database["public"]["Enums"]["service_category"]
          city?: string | null
          contact_phone?: string | null
          cover_url?: string | null
          created_at?: string
          hourly_rate_inr?: number | null
          id?: string
          id_proof_path?: string | null
          lat?: number | null
          lng?: number | null
          name: string
          owner_id: string
          quiz_passed_at?: string | null
          quiz_score?: number | null
          trust_status?: string
          updated_at?: string
          verified?: boolean
          years_experience?: number | null
        }
        Update: {
          active?: boolean
          address_proof_path?: string | null
          bio?: string | null
          category?: Database["public"]["Enums"]["service_category"]
          city?: string | null
          contact_phone?: string | null
          cover_url?: string | null
          created_at?: string
          hourly_rate_inr?: number | null
          id?: string
          id_proof_path?: string | null
          lat?: number | null
          lng?: number | null
          name?: string
          owner_id?: string
          quiz_passed_at?: string | null
          quiz_score?: number | null
          trust_status?: string
          updated_at?: string
          verified?: boolean
          years_experience?: number | null
        }
        Relationships: []
      }
      shop_order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string
          qty: number
          seller_id: string
          title_snapshot: string
          unit_price_inr: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id: string
          qty: number
          seller_id: string
          title_snapshot: string
          unit_price_inr: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string
          qty?: number
          seller_id?: string
          title_snapshot?: string
          unit_price_inr?: number
        }
        Relationships: []
      }
      shop_orders: {
        Row: {
          contact_phone: string | null
          created_at: string
          customer_id: string
          id: string
          notes: string | null
          shipping_address: string | null
          status: Database["public"]["Enums"]["order_status"]
          total_inr: number
          updated_at: string
        }
        Insert: {
          contact_phone?: string | null
          created_at?: string
          customer_id: string
          id?: string
          notes?: string | null
          shipping_address?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total_inr?: number
          updated_at?: string
        }
        Update: {
          contact_phone?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          notes?: string | null
          shipping_address?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total_inr?: number
          updated_at?: string
        }
        Relationships: []
      }
      shop_products: {
        Row: {
          active: boolean
          category: Database["public"]["Enums"]["product_category"]
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          price_inr: number
          seller_id: string
          stock: number
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: Database["public"]["Enums"]["product_category"]
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          price_inr: number
          seller_id: string
          stock?: number
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: Database["public"]["Enums"]["product_category"]
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          price_inr?: number
          seller_id?: string
          stock?: number
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      signup_attempts: {
        Row: {
          attempted_at: string
          email_hash: string
          id: string
          ip_hash: string | null
        }
        Insert: {
          attempted_at?: string
          email_hash: string
          id?: string
          ip_hash?: string | null
        }
        Update: {
          attempted_at?: string
          email_hash?: string
          id?: string
          ip_hash?: string | null
        }
        Relationships: []
      }
      stories: {
        Row: {
          author_id: string
          caption: string | null
          created_at: string
          expires_at: string
          id: string
          image_url: string
          media_url_feed: string | null
          media_url_full: string | null
          media_url_thumb: string | null
          pet_id: string | null
          view_count: number
        }
        Insert: {
          author_id: string
          caption?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          image_url: string
          media_url_feed?: string | null
          media_url_full?: string | null
          media_url_thumb?: string | null
          pet_id?: string | null
          view_count?: number
        }
        Update: {
          author_id?: string
          caption?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          image_url?: string
          media_url_feed?: string | null
          media_url_full?: string | null
          media_url_thumb?: string | null
          pet_id?: string | null
          view_count?: number
        }
        Relationships: []
      }
      story_views: {
        Row: {
          story_id: string
          viewed_at: string
          viewer_id: string
        }
        Insert: {
          story_id: string
          viewed_at?: string
          viewer_id: string
        }
        Update: {
          story_id?: string
          viewed_at?: string
          viewer_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          provider: string | null
          provider_customer_id: string | null
          provider_subscription_id: string | null
          status: Database["public"]["Enums"]["sub_status"]
          tier: Database["public"]["Enums"]["sub_tier"]
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: Database["public"]["Enums"]["sub_status"]
          tier?: Database["public"]["Enums"]["sub_tier"]
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: Database["public"]["Enums"]["sub_status"]
          tier?: Database["public"]["Enums"]["sub_tier"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      symptom_logs: {
        Row: {
          ai_flag: string | null
          ai_reason: string | null
          created_at: string
          id: string
          logged_at: string
          notes: string | null
          pet_id: string
          photo_url: string | null
          severity: number
          symptom: string
        }
        Insert: {
          ai_flag?: string | null
          ai_reason?: string | null
          created_at?: string
          id?: string
          logged_at?: string
          notes?: string | null
          pet_id: string
          photo_url?: string | null
          severity?: number
          symptom: string
        }
        Update: {
          ai_flag?: string | null
          ai_reason?: string | null
          created_at?: string
          id?: string
          logged_at?: string
          notes?: string | null
          pet_id?: string
          photo_url?: string | null
          severity?: number
          symptom?: string
        }
        Relationships: [
          {
            foreignKeyName: "symptom_logs_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pet_health_status"
            referencedColumns: ["pet_id"]
          },
          {
            foreignKeyName: "symptom_logs_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      typing_indicators: {
        Row: {
          conversation_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      usage_counters: {
        Row: {
          count: number
          kind: string
          period: string
          user_id: string
          window_start: string
        }
        Insert: {
          count?: number
          kind: string
          period: string
          user_id: string
          window_start?: string
        }
        Update: {
          count?: number
          kind?: string
          period?: string
          user_id?: string
          window_start?: string
        }
        Relationships: []
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
            referencedRelation: "pet_health_status"
            referencedColumns: ["pet_id"]
          },
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
            referencedRelation: "pet_health_status"
            referencedColumns: ["pet_id"]
          },
          {
            foreignKeyName: "vault_documents_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_requests: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          owner_id: string
          pet_id: string
          reviewed_at: string | null
          reviewer_id: string | null
          reviewer_notes: string | null
          status: Database["public"]["Enums"]["verification_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          owner_id: string
          pet_id: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          owner_id?: string
          pet_id?: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          updated_at?: string
        }
        Relationships: []
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
            referencedRelation: "pet_health_status"
            referencedColumns: ["pet_id"]
          },
          {
            foreignKeyName: "vet_access_grants_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      vet_answer_helpful: {
        Row: {
          answer_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          answer_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          answer_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vet_answer_helpful_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: false
            referencedRelation: "vet_answers"
            referencedColumns: ["id"]
          },
        ]
      }
      vet_answers: {
        Row: {
          body: string
          created_at: string
          helpful_count: number
          id: string
          question_id: string
          updated_at: string
          vet_id: string
        }
        Insert: {
          body: string
          created_at?: string
          helpful_count?: number
          id?: string
          question_id: string
          updated_at?: string
          vet_id: string
        }
        Update: {
          body?: string
          created_at?: string
          helpful_count?: number
          id?: string
          question_id?: string
          updated_at?: string
          vet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vet_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "vet_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      vet_applications: {
        Row: {
          bio: string | null
          city: string | null
          clinic_name: string
          created_at: string
          id: string
          license_number: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["application_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          bio?: string | null
          city?: string | null
          clinic_name: string
          created_at?: string
          id?: string
          license_number: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          bio?: string | null
          city?: string | null
          clinic_name?: string
          created_at?: string
          id?: string
          license_number?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vet_availability: {
        Row: {
          created_at: string
          end_time: string
          id: string
          mode: Database["public"]["Enums"]["appointment_mode"]
          start_time: string
          vet_id: string
          weekday: number
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          mode?: Database["public"]["Enums"]["appointment_mode"]
          start_time: string
          vet_id: string
          weekday: number
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          mode?: Database["public"]["Enums"]["appointment_mode"]
          start_time?: string
          vet_id?: string
          weekday?: number
        }
        Relationships: []
      }
      vet_availability_overrides: {
        Row: {
          created_at: string
          end_time: string | null
          id: string
          is_blocked: boolean
          override_date: string
          reason: string | null
          start_time: string | null
          vet_id: string
        }
        Insert: {
          created_at?: string
          end_time?: string | null
          id?: string
          is_blocked?: boolean
          override_date: string
          reason?: string | null
          start_time?: string | null
          vet_id: string
        }
        Update: {
          created_at?: string
          end_time?: string | null
          id?: string
          is_blocked?: boolean
          override_date?: string
          reason?: string | null
          start_time?: string | null
          vet_id?: string
        }
        Relationships: []
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
            referencedRelation: "pet_health_status"
            referencedColumns: ["pet_id"]
          },
          {
            foreignKeyName: "vet_consults_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      vet_profiles: {
        Row: {
          active: boolean
          address: string | null
          bio: string | null
          city: string | null
          clinic_name: string | null
          consult_modes: Database["public"]["Enums"]["appointment_mode"][]
          created_at: string
          default_duration_min: number
          display_name: string
          id: string
          languages: string[]
          lat: number | null
          license_council: string | null
          license_doc_path: string | null
          license_number: string
          lng: number | null
          onboarded: boolean
          phone: string | null
          photo_url: string | null
          price_chat_inr: number
          price_clinic_inr: number
          price_video_inr: number
          rating_avg: number | null
          rating_count: number
          specialisations: string[]
          updated_at: string
          user_id: string
          year_qualified: number | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          bio?: string | null
          city?: string | null
          clinic_name?: string | null
          consult_modes?: Database["public"]["Enums"]["appointment_mode"][]
          created_at?: string
          default_duration_min?: number
          display_name: string
          id?: string
          languages?: string[]
          lat?: number | null
          license_council?: string | null
          license_doc_path?: string | null
          license_number: string
          lng?: number | null
          onboarded?: boolean
          phone?: string | null
          photo_url?: string | null
          price_chat_inr?: number
          price_clinic_inr?: number
          price_video_inr?: number
          rating_avg?: number | null
          rating_count?: number
          specialisations?: string[]
          updated_at?: string
          user_id: string
          year_qualified?: number | null
        }
        Update: {
          active?: boolean
          address?: string | null
          bio?: string | null
          city?: string | null
          clinic_name?: string | null
          consult_modes?: Database["public"]["Enums"]["appointment_mode"][]
          created_at?: string
          default_duration_min?: number
          display_name?: string
          id?: string
          languages?: string[]
          lat?: number | null
          license_council?: string | null
          license_doc_path?: string | null
          license_number?: string
          lng?: number | null
          onboarded?: boolean
          phone?: string | null
          photo_url?: string | null
          price_chat_inr?: number
          price_clinic_inr?: number
          price_video_inr?: number
          rating_avg?: number | null
          rating_count?: number
          specialisations?: string[]
          updated_at?: string
          user_id?: string
          year_qualified?: number | null
        }
        Relationships: []
      }
      vet_questions: {
        Row: {
          ai_summary: string | null
          ai_transcript: Json | null
          answer_count: number
          asker_id: string
          best_answer_id: string | null
          body: string
          category: Database["public"]["Enums"]["vet_q_category"]
          created_at: string
          id: string
          pet_id: string | null
          photo_urls: string[]
          source: string
          species: string | null
          status: Database["public"]["Enums"]["vet_q_status"]
          title: string
          updated_at: string
          view_count: number
        }
        Insert: {
          ai_summary?: string | null
          ai_transcript?: Json | null
          answer_count?: number
          asker_id: string
          best_answer_id?: string | null
          body: string
          category?: Database["public"]["Enums"]["vet_q_category"]
          created_at?: string
          id?: string
          pet_id?: string | null
          photo_urls?: string[]
          source?: string
          species?: string | null
          status?: Database["public"]["Enums"]["vet_q_status"]
          title: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          ai_summary?: string | null
          ai_transcript?: Json | null
          answer_count?: number
          asker_id?: string
          best_answer_id?: string | null
          body?: string
          category?: Database["public"]["Enums"]["vet_q_category"]
          created_at?: string
          id?: string
          pet_id?: string | null
          photo_urls?: string[]
          source?: string
          species?: string | null
          status?: Database["public"]["Enums"]["vet_q_status"]
          title?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: []
      }
      vet_triage_sessions: {
        Row: {
          ai_summary: string | null
          closed_at: string | null
          created_at: string
          escalated_to_appointment_id: string | null
          home_care: string[] | null
          id: string
          owner_id: string
          pet_id: string | null
          recommend_vet: boolean | null
          severity: Database["public"]["Enums"]["triage_severity"] | null
          transcript: Json
          updated_at: string
        }
        Insert: {
          ai_summary?: string | null
          closed_at?: string | null
          created_at?: string
          escalated_to_appointment_id?: string | null
          home_care?: string[] | null
          id?: string
          owner_id: string
          pet_id?: string | null
          recommend_vet?: boolean | null
          severity?: Database["public"]["Enums"]["triage_severity"] | null
          transcript?: Json
          updated_at?: string
        }
        Update: {
          ai_summary?: string | null
          closed_at?: string | null
          created_at?: string
          escalated_to_appointment_id?: string | null
          home_care?: string[] | null
          id?: string
          owner_id?: string
          pet_id?: string | null
          recommend_vet?: boolean | null
          severity?: Database["public"]["Enums"]["triage_severity"] | null
          transcript?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vet_triage_sessions_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pet_health_status"
            referencedColumns: ["pet_id"]
          },
          {
            foreignKeyName: "vet_triage_sessions_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      vital_logs: {
        Row: {
          body_condition: number | null
          created_at: string
          gum_colour: string | null
          heart_rate_bpm: number | null
          hydration: string | null
          id: string
          notes: string | null
          pet_id: string
          recorded_at: string
          respiratory_rate_rpm: number | null
          temperature_c: number | null
          weight_kg: number | null
        }
        Insert: {
          body_condition?: number | null
          created_at?: string
          gum_colour?: string | null
          heart_rate_bpm?: number | null
          hydration?: string | null
          id?: string
          notes?: string | null
          pet_id: string
          recorded_at?: string
          respiratory_rate_rpm?: number | null
          temperature_c?: number | null
          weight_kg?: number | null
        }
        Update: {
          body_condition?: number | null
          created_at?: string
          gum_colour?: string | null
          heart_rate_bpm?: number | null
          hydration?: string | null
          id?: string
          notes?: string | null
          pet_id?: string
          recorded_at?: string
          respiratory_rate_rpm?: number | null
          temperature_c?: number | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      walk_tracks: {
        Row: {
          booking_id: string
          id: string
          lat: number
          lng: number
          recorded_at: string
        }
        Insert: {
          booking_id: string
          id?: string
          lat: number
          lng: number
          recorded_at?: string
        }
        Update: {
          booking_id?: string
          id?: string
          lat?: number
          lng?: number
          recorded_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      pet_health_status: {
        Row: {
          last_activity_on: string | null
          name: string | null
          next_parasite_due: string | null
          owner_id: string | null
          pet_id: string | null
          vaccination_verified: boolean | null
          weight_kg: number | null
        }
        Insert: {
          last_activity_on?: never
          name?: string | null
          next_parasite_due?: never
          owner_id?: string | null
          pet_id?: string | null
          vaccination_verified?: boolean | null
          weight_kg?: number | null
        }
        Update: {
          last_activity_on?: never
          name?: string | null
          next_parasite_due?: never
          owner_id?: string | null
          pet_id?: string | null
          vaccination_verified?: boolean | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      pets_public: {
        Row: {
          avatar_url: string | null
          bio: string | null
          breed: string | null
          city: string | null
          dam_pet_id: string | null
          date_of_birth: string | null
          discoverable_for_mating: boolean | null
          gender: Database["public"]["Enums"]["pet_gender"] | null
          id: string | null
          name: string | null
          owner_id: string | null
          public_id: string | null
          sire_pet_id: string | null
          species: Database["public"]["Enums"]["pet_species"] | null
          status_chip: string | null
          vaccination_verified: boolean | null
        }
        Relationships: []
      }
      profiles_public: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"] | null
          avatar_url: string | null
          bio: string | null
          city: string | null
          cover_url: string | null
          full_name: string | null
          handle: string | null
          id: string | null
        }
        Relationships: []
      }
      repeat_sellers: {
        Row: {
          active_listings: number | null
          owner_id: string | null
        }
        Relationships: []
      }
      subject_ratings: {
        Row: {
          avg_rating: number | null
          review_count: number | null
          subject_id: string | null
          subject_type: Database["public"]["Enums"]["review_subject"] | null
        }
        Relationships: []
      }
      trending_hashtags: {
        Row: {
          last_used: string | null
          post_count: number | null
          tag: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_kpis: { Args: never; Returns: Json }
      apply_redemption: {
        Args: {
          _id: string
          _notes?: string
          _status: Database["public"]["Enums"]["redemption_status"]
        }
        Returns: undefined
      }
      award_reward: {
        Args: {
          _reason?: string
          _reference_id?: string
          _reference_type?: string
          _rule_kind: string
          _user_id: string
        }
        Returns: string
      }
      check_daily_limit: {
        Args: { _limit: number; _table: string; _user: string }
        Returns: undefined
      }
      current_tier: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["sub_tier"]
      }
      earth: { Args: never; Returns: number }
      expire_mating_listings: { Args: never; Returns: undefined }
      generate_pet_public_id: { Args: never; Returns: string }
      get_or_create_dm: { Args: { _other_user: string }; Returns: string }
      get_pets_public: {
        Args: never
        Returns: {
          avatar_url: string
          bio: string
          breed: string
          city: string
          dam_pet_id: string
          date_of_birth: string
          discoverable_for_mating: boolean
          gender: Database["public"]["Enums"]["pet_gender"]
          id: string
          name: string
          owner_id: string
          public_id: string
          sire_pet_id: string
          species: Database["public"]["Enums"]["pet_species"]
          status_chip: string
          vaccination_verified: boolean
        }[]
      }
      get_profiles_public: {
        Args: never
        Returns: {
          account_type: Database["public"]["Enums"]["account_type"]
          avatar_url: string
          bio: string
          city: string
          cover_url: string
          full_name: string
          handle: string
          id: string
        }[]
      }
      get_public_walk: {
        Args: { _token: string }
        Returns: {
          booking_id: string
          pet_name: string
          provider_name: string
          scheduled_at: string
          status: string
          tracks: Json
        }[]
      }
      get_user_id_by_email: {
        Args: { _email: string }
        Returns: {
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_usage: {
        Args: { _kind: string; _limit: number; _window_days: number }
        Returns: Json
      }
      is_blocked: {
        Args: { _blocked: string; _blocker: string }
        Returns: boolean
      }
      is_conversation_member: {
        Args: { _conv: string; _user: string }
        Returns: boolean
      }
      mark_conversation_read: { Args: { _conv: string }; Returns: undefined }
      nearby_meetups: {
        Args: { _lat: number; _lng: number; _radius_km?: number }
        Returns: {
          attending_count: number
          city: string
          distance_km: number
          id: string
          lat: number
          lng: number
          starts_at: string
          title: string
        }[]
      }
      nearby_missing: {
        Args: { _lat: number; _lng: number; _radius_km?: number }
        Returns: {
          city: string
          distance_km: number
          id: string
          last_seen_at: string
          lat: number
          lng: number
          pet_id: string
          photo_url: string
        }[]
      }
      nearby_providers: {
        Args: {
          _category?: string
          _lat: number
          _lng: number
          _radius_km?: number
        }
        Returns: {
          category: string
          city: string
          cover_url: string
          distance_km: number
          hourly_rate_inr: number
          id: string
          lat: number
          lng: number
          name: string
          verified: boolean
        }[]
      }
      nearby_vets: {
        Args: { _lat: number; _lng: number; _radius_km?: number }
        Returns: {
          city: string
          clinic_name: string
          display_name: string
          distance_km: number
          lat: number
          lng: number
          photo_url: string
          price_video_inr: number
          rating_avg: number
          user_id: string
        }[]
      }
      notify_user: {
        Args: {
          _body: string
          _link: string
          _title: string
          _type: string
          _user_id: string
        }
        Returns: undefined
      }
      provider_social_proof: {
        Args: { _city?: string; _provider_id: string }
        Returns: Json
      }
      purge_old_signup_attempts: { Args: never; Returns: undefined }
      redeem_reward: {
        Args: {
          _applied_to_reference_id?: string
          _applied_to_reference_type?: string
          _kind: Database["public"]["Enums"]["redemption_kind"]
          _notes?: string
          _points: number
        }
        Returns: string
      }
      release_due_rewards: { Args: never; Returns: number }
      review_summaries_bulk: {
        Args: {
          _ids: string[]
          _subject_type: Database["public"]["Enums"]["review_subject"]
        }
        Returns: {
          avg: number
          count: number
          subject_id: string
          verified_count: number
        }[]
      }
      review_summary: {
        Args: {
          _subject_id: string
          _subject_type: Database["public"]["Enums"]["review_subject"]
        }
        Returns: Json
      }
      send_broadcast: {
        Args: {
          _body: string
          _link: string
          _target_city?: string
          _target_role?: string
          _title: string
        }
        Returns: string
      }
      set_provider_trust_status: {
        Args: { _notes?: string; _provider_id: string; _status: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      vet_can_read_pet: { Args: { _pet_id: string }; Returns: boolean }
    }
    Enums: {
      access_request_status: "pending" | "approved" | "rejected" | "expired"
      account_type:
        | "pet_parent"
        | "breeder"
        | "kennel"
        | "shelter"
        | "sanctuary"
        | "zoo"
        | "rescuer"
        | "buyer"
      activity_level: "low" | "medium" | "high"
      adoption_application_status:
        | "pending"
        | "approved"
        | "rejected"
        | "withdrawn"
      app_role:
        | "user"
        | "pet_pal"
        | "boarding_provider"
        | "vet"
        | "ngo"
        | "moderator"
        | "finance"
        | "super_admin"
      application_status: "pending" | "approved" | "rejected"
      appointment_mode: "chat" | "video" | "in_clinic"
      appointment_status:
        | "requested"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "no_show"
      booking_status:
        | "pending"
        | "confirmed"
        | "declined"
        | "completed"
        | "cancelled"
      collab_status: "pending" | "accepted" | "declined"
      consult_severity: "mild" | "moderate" | "severe"
      consult_status:
        | "awaiting_vet"
        | "assigned"
        | "in_progress"
        | "completed"
        | "cancelled"
      diet_type: "kibble" | "raw" | "home" | "mixed" | "prescription"
      group_kind: "breed" | "city" | "interest"
      group_member_role: "member" | "mod" | "owner"
      health_record_type:
        | "visit"
        | "diagnostic"
        | "prescription"
        | "surgery"
        | "allergy"
        | "other"
      insurance_lead_status:
        | "new"
        | "contacted"
        | "quoted"
        | "purchased"
        | "lost"
      mating_intent: "stud" | "dam" | "either"
      meetup_status: "upcoming" | "cancelled" | "done"
      missing_status: "active" | "resolved" | "cancelled"
      mod_verdict: "allow" | "flag" | "block"
      order_status: "pending" | "paid" | "shipped" | "delivered" | "cancelled"
      parasite_type:
        | "flea"
        | "tick"
        | "heartworm"
        | "dewormer"
        | "combination"
        | "other"
      payment_intent_status:
        | "beta_free"
        | "pending"
        | "paid"
        | "failed"
        | "refunded"
      payment_kind:
        | "vet_consult"
        | "mating_listing"
        | "agreement"
        | "missing_listing"
      pet_gender: "male" | "female"
      pet_listing_status:
        | "active"
        | "pending_review"
        | "taken_down"
        | "completed"
        | "sold"
      pet_listing_type: "adoption" | "rehoming" | "breeder_sale"
      pet_species: "dog" | "cat" | "bird" | "rabbit" | "other"
      product_category:
        | "food"
        | "toys"
        | "accessories"
        | "health"
        | "grooming"
        | "other"
      redemption_kind:
        | "booking_discount"
        | "listing_boost"
        | "plus_credit"
        | "cash_out"
      redemption_status:
        | "requested"
        | "approved"
        | "applied"
        | "rejected"
        | "cancelled"
      report_status: "open" | "reviewing" | "resolved" | "dismissed"
      report_subject:
        | "post"
        | "comment"
        | "product"
        | "provider"
        | "user"
        | "listing"
      request_status:
        | "pending"
        | "accepted"
        | "declined"
        | "withdrawn"
        | "agreed"
      review_subject: "provider" | "product" | "vet" | "pet_partner"
      reward_kind: "earn" | "release" | "redeem" | "expire" | "adjust"
      reward_status: "pending" | "available" | "redeemed" | "expired" | "void"
      rsvp_status: "going" | "maybe" | "declined"
      service_category:
        | "grooming"
        | "training"
        | "walking"
        | "sitting"
        | "boarding"
        | "vet_clinic"
        | "caretaker"
        | "daycare"
        | "pet_taxi"
      social_level: "solo" | "pairs" | "crowds"
      sub_status: "active" | "past_due" | "canceled" | "trialing"
      sub_tier: "free" | "plus"
      transfer_status: "pending" | "accepted" | "declined" | "cancelled"
      triage_severity: "mild" | "moderate" | "severe"
      verification_status: "pending" | "approved" | "rejected"
      vet_q_category:
        | "behavior"
        | "nutrition"
        | "medical"
        | "training"
        | "other"
      vet_q_status: "open" | "answered" | "closed"
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
      access_request_status: ["pending", "approved", "rejected", "expired"],
      account_type: [
        "pet_parent",
        "breeder",
        "kennel",
        "shelter",
        "sanctuary",
        "zoo",
        "rescuer",
        "buyer",
      ],
      activity_level: ["low", "medium", "high"],
      adoption_application_status: [
        "pending",
        "approved",
        "rejected",
        "withdrawn",
      ],
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
      application_status: ["pending", "approved", "rejected"],
      appointment_mode: ["chat", "video", "in_clinic"],
      appointment_status: [
        "requested",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
        "no_show",
      ],
      booking_status: [
        "pending",
        "confirmed",
        "declined",
        "completed",
        "cancelled",
      ],
      collab_status: ["pending", "accepted", "declined"],
      consult_severity: ["mild", "moderate", "severe"],
      consult_status: [
        "awaiting_vet",
        "assigned",
        "in_progress",
        "completed",
        "cancelled",
      ],
      diet_type: ["kibble", "raw", "home", "mixed", "prescription"],
      group_kind: ["breed", "city", "interest"],
      group_member_role: ["member", "mod", "owner"],
      health_record_type: [
        "visit",
        "diagnostic",
        "prescription",
        "surgery",
        "allergy",
        "other",
      ],
      insurance_lead_status: [
        "new",
        "contacted",
        "quoted",
        "purchased",
        "lost",
      ],
      mating_intent: ["stud", "dam", "either"],
      meetup_status: ["upcoming", "cancelled", "done"],
      missing_status: ["active", "resolved", "cancelled"],
      mod_verdict: ["allow", "flag", "block"],
      order_status: ["pending", "paid", "shipped", "delivered", "cancelled"],
      parasite_type: [
        "flea",
        "tick",
        "heartworm",
        "dewormer",
        "combination",
        "other",
      ],
      payment_intent_status: [
        "beta_free",
        "pending",
        "paid",
        "failed",
        "refunded",
      ],
      payment_kind: [
        "vet_consult",
        "mating_listing",
        "agreement",
        "missing_listing",
      ],
      pet_gender: ["male", "female"],
      pet_listing_status: [
        "active",
        "pending_review",
        "taken_down",
        "completed",
        "sold",
      ],
      pet_listing_type: ["adoption", "rehoming", "breeder_sale"],
      pet_species: ["dog", "cat", "bird", "rabbit", "other"],
      product_category: [
        "food",
        "toys",
        "accessories",
        "health",
        "grooming",
        "other",
      ],
      redemption_kind: [
        "booking_discount",
        "listing_boost",
        "plus_credit",
        "cash_out",
      ],
      redemption_status: [
        "requested",
        "approved",
        "applied",
        "rejected",
        "cancelled",
      ],
      report_status: ["open", "reviewing", "resolved", "dismissed"],
      report_subject: [
        "post",
        "comment",
        "product",
        "provider",
        "user",
        "listing",
      ],
      request_status: [
        "pending",
        "accepted",
        "declined",
        "withdrawn",
        "agreed",
      ],
      review_subject: ["provider", "product", "vet", "pet_partner"],
      reward_kind: ["earn", "release", "redeem", "expire", "adjust"],
      reward_status: ["pending", "available", "redeemed", "expired", "void"],
      rsvp_status: ["going", "maybe", "declined"],
      service_category: [
        "grooming",
        "training",
        "walking",
        "sitting",
        "boarding",
        "vet_clinic",
        "caretaker",
        "daycare",
        "pet_taxi",
      ],
      social_level: ["solo", "pairs", "crowds"],
      sub_status: ["active", "past_due", "canceled", "trialing"],
      sub_tier: ["free", "plus"],
      transfer_status: ["pending", "accepted", "declined", "cancelled"],
      triage_severity: ["mild", "moderate", "severe"],
      verification_status: ["pending", "approved", "rejected"],
      vet_q_category: ["behavior", "nutrition", "medical", "training", "other"],
      vet_q_status: ["open", "answered", "closed"],
    },
  },
} as const
