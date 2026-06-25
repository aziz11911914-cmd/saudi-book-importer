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
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          details: Json
          id: string
          ip: string | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          ip?: string | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          ip?: string | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      auth_otp_challenges: {
        Row: {
          attempt_count: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          revoked_at: string | null
          token_hash: string
          user_id: string | null
          verification_type: string
        }
        Insert: {
          attempt_count?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          revoked_at?: string | null
          token_hash: string
          user_id?: string | null
          verification_type: string
        }
        Update: {
          attempt_count?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          revoked_at?: string | null
          token_hash?: string
          user_id?: string | null
          verification_type?: string
        }
        Relationships: []
      }
      barber_availability: {
        Row: {
          barber_id: string
          day_of_week: number
          ends_at: string
          id: string
          starts_at: string
        }
        Insert: {
          barber_id: string
          day_of_week: number
          ends_at: string
          id?: string
          starts_at: string
        }
        Update: {
          barber_id?: string
          day_of_week?: number
          ends_at?: string
          id?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "barber_availability_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
        ]
      }
      barber_services: {
        Row: {
          barber_id: string
          service_id: string
        }
        Insert: {
          barber_id: string
          service_id: string
        }
        Update: {
          barber_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "barber_services_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barber_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      barber_specialties: {
        Row: {
          barber_id: string
          specialty_id: string
        }
        Insert: {
          barber_id: string
          specialty_id: string
        }
        Update: {
          barber_id?: string
          specialty_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "barber_specialties_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barber_specialties_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "specialties"
            referencedColumns: ["id"]
          },
        ]
      }
      barber_time_off: {
        Row: {
          barber_id: string
          ends_at: string
          id: string
          reason: string | null
          starts_at: string
        }
        Insert: {
          barber_id: string
          ends_at: string
          id?: string
          reason?: string | null
          starts_at: string
        }
        Update: {
          barber_id?: string
          ends_at?: string
          id?: string
          reason?: string | null
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "barber_time_off_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
        ]
      }
      barbers: {
        Row: {
          appointments_completed: number
          bio_ar: string | null
          bio_en: string | null
          clients_served: number
          created_at: string
          display_name_ar: string
          display_name_en: string
          featured: boolean
          id: string
          photo_url: string | null
          profile_id: string | null
          rating_avg: number
          rating_count: number
          shop_id: string
          slug: string
          status: Database["public"]["Enums"]["entity_status"]
          title_ar: string
          title_en: string
          updated_at: string
          years_experience: number
        }
        Insert: {
          appointments_completed?: number
          bio_ar?: string | null
          bio_en?: string | null
          clients_served?: number
          created_at?: string
          display_name_ar: string
          display_name_en: string
          featured?: boolean
          id?: string
          photo_url?: string | null
          profile_id?: string | null
          rating_avg?: number
          rating_count?: number
          shop_id: string
          slug: string
          status?: Database["public"]["Enums"]["entity_status"]
          title_ar?: string
          title_en?: string
          updated_at?: string
          years_experience?: number
        }
        Update: {
          appointments_completed?: number
          bio_ar?: string | null
          bio_en?: string | null
          clients_served?: number
          created_at?: string
          display_name_ar?: string
          display_name_en?: string
          featured?: boolean
          id?: string
          photo_url?: string | null
          profile_id?: string | null
          rating_avg?: number
          rating_count?: number
          shop_id?: string
          slug?: string
          status?: Database["public"]["Enums"]["entity_status"]
          title_ar?: string
          title_en?: string
          updated_at?: string
          years_experience?: number
        }
        Relationships: [
          {
            foreignKeyName: "barbers_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          barber_id: string
          booking_ref: string
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          customer_id: string
          ends_at: string
          id: string
          notes: string | null
          price_sar: number
          service_id: string
          shop_id: string
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
        }
        Insert: {
          barber_id: string
          booking_ref?: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          customer_id: string
          ends_at: string
          id?: string
          notes?: string | null
          price_sar: number
          service_id: string
          shop_id: string
          starts_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
        }
        Update: {
          barber_id?: string
          booking_ref?: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          customer_id?: string
          ends_at?: string
          id?: string
          notes?: string | null
          price_sar?: number
          service_id?: string
          shop_id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_reviews: {
        Row: {
          barber_id: string | null
          comment: string
          created_at: string
          id: string
          rating: number
          reviewer_name: string
          shop_id: string
        }
        Insert: {
          barber_id?: string | null
          comment: string
          created_at?: string
          id?: string
          rating: number
          reviewer_name: string
          shop_id: string
        }
        Update: {
          barber_id?: string | null
          comment?: string
          created_at?: string
          id?: string
          rating?: number
          reviewer_name?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_reviews_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_reviews_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          target_id: string
          target_type: Database["public"]["Enums"]["favorite_target"]
          user_id: string
        }
        Insert: {
          created_at?: string
          target_id: string
          target_type: Database["public"]["Enums"]["favorite_target"]
          user_id: string
        }
        Update: {
          created_at?: string
          target_id?: string
          target_type?: Database["public"]["Enums"]["favorite_target"]
          user_id?: string
        }
        Relationships: []
      }
      invites: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          shop_id: string | null
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by?: string | null
          role: Database["public"]["Enums"]["app_role"]
          shop_id?: string | null
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          shop_id?: string | null
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json
          id: string
          kind: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json
          id?: string
          kind: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json
          id?: string
          kind?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          authentication: Json
          booking: Json
          general: Json
          id: number
          maintenance: Json
          notifications: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          authentication?: Json
          booking?: Json
          general?: Json
          id?: number
          maintenance?: Json
          notifications?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          authentication?: Json
          booking?: Json
          general?: Json
          id?: number
          maintenance?: Json
          notifications?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      portfolio_photo_specialties: {
        Row: {
          photo_id: string
          specialty_id: string
        }
        Insert: {
          photo_id: string
          specialty_id: string
        }
        Update: {
          photo_id?: string
          specialty_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_photo_specialties_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "portfolio_photos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_photo_specialties_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "specialties"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_photos: {
        Row: {
          barber_id: string
          caption_ar: string | null
          caption_en: string | null
          created_at: string
          id: string
          service_id: string | null
          sort: number
          starting_price_sar: number | null
          url: string
        }
        Insert: {
          barber_id: string
          caption_ar?: string | null
          caption_en?: string | null
          created_at?: string
          id?: string
          service_id?: string | null
          sort?: number
          starting_price_sar?: number | null
          url: string
        }
        Update: {
          barber_id?: string
          caption_ar?: string | null
          caption_en?: string | null
          created_at?: string
          id?: string
          service_id?: string | null
          sort?: number
          starting_price_sar?: number | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_photos_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_photos_service_fk"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          first_name: string | null
          full_name: string | null
          id: string
          language: string | null
          last_login_at: string | null
          last_name: string | null
          locale: string
          nationality: string | null
          notes: string | null
          phone: string | null
          status: Database["public"]["Enums"]["profile_status"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          id: string
          language?: string | null
          last_login_at?: string | null
          last_name?: string | null
          locale?: string
          nationality?: string | null
          notes?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          language?: string | null
          last_login_at?: string | null
          last_name?: string | null
          locale?: string
          nationality?: string | null
          notes?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          barber_id: string
          booking_id: string
          comment: string | null
          created_at: string
          customer_id: string
          hidden_at: string | null
          hidden_by: string | null
          id: string
          rating: number
          shop_id: string
        }
        Insert: {
          barber_id: string
          booking_id: string
          comment?: string | null
          created_at?: string
          customer_id: string
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          rating: number
          shop_id: string
        }
        Update: {
          barber_id?: string
          booking_id?: string
          comment?: string | null
          created_at?: string
          customer_id?: string
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          rating?: number
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          category: string
          created_at: string
          description_ar: string | null
          description_en: string | null
          duration_min: number
          id: string
          name_ar: string
          name_en: string
          price_sar: number
          shop_id: string
        }
        Insert: {
          active?: boolean
          category?: string
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          duration_min?: number
          id?: string
          name_ar: string
          name_en: string
          price_sar?: number
          shop_id: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          duration_min?: number
          id?: string
          name_ar?: string
          name_en?: string
          price_sar?: number
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_hours: {
        Row: {
          closes_at: string
          day_of_week: number
          id: string
          opens_at: string
          shop_id: string
        }
        Insert: {
          closes_at: string
          day_of_week: number
          id?: string
          opens_at: string
          shop_id: string
        }
        Update: {
          closes_at?: string
          day_of_week?: number
          id?: string
          opens_at?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_hours_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_photos: {
        Row: {
          created_at: string
          id: string
          shop_id: string
          sort: number
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          shop_id: string
          sort?: number
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          shop_id?: string
          sort?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_photos_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shops: {
        Row: {
          accept_reviews: boolean
          address: string | null
          booking_enabled: boolean
          booking_interval_minutes: number
          city: string | null
          cover_url: string | null
          created_at: string
          description_ar: string | null
          description_en: string | null
          district: string | null
          email: string | null
          featured: boolean
          id: string
          lat: number | null
          lng: number | null
          logo_url: string | null
          manager_id: string | null
          max_booking_window_days: number
          name_ar: string
          name_en: string
          phone: string | null
          rating_avg: number
          rating_count: number
          slug: string
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
          walkin_enabled: boolean
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          accept_reviews?: boolean
          address?: string | null
          booking_enabled?: boolean
          booking_interval_minutes?: number
          city?: string | null
          cover_url?: string | null
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          district?: string | null
          email?: string | null
          featured?: boolean
          id?: string
          lat?: number | null
          lng?: number | null
          logo_url?: string | null
          manager_id?: string | null
          max_booking_window_days?: number
          name_ar: string
          name_en: string
          phone?: string | null
          rating_avg?: number
          rating_count?: number
          slug: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          walkin_enabled?: boolean
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          accept_reviews?: boolean
          address?: string | null
          booking_enabled?: boolean
          booking_interval_minutes?: number
          city?: string | null
          cover_url?: string | null
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          district?: string | null
          email?: string | null
          featured?: boolean
          id?: string
          lat?: number | null
          lng?: number | null
          logo_url?: string | null
          manager_id?: string | null
          max_booking_window_days?: number
          name_ar?: string
          name_en?: string
          phone?: string | null
          rating_avg?: number
          rating_count?: number
          slug?: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          walkin_enabled?: boolean
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      specialties: {
        Row: {
          created_at: string
          id: string
          label_ar: string
          label_en: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          label_ar: string
          label_en: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          label_ar?: string
          label_en?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consume_invites_for_current_user: { Args: never; Returns: number }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      ensure_protected_super_admin: {
        Args: { _user_id: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: never; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role:
        | "customer"
        | "barber"
        | "manager"
        | "admin"
        | "super_admin"
        | "owner"
      booking_status:
        | "pending"
        | "confirmed"
        | "completed"
        | "cancelled"
        | "no_show"
      entity_status: "active" | "inactive" | "pending"
      favorite_target: "barber" | "shop"
      profile_status: "active" | "suspended"
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
        "customer",
        "barber",
        "manager",
        "admin",
        "super_admin",
        "owner",
      ],
      booking_status: [
        "pending",
        "confirmed",
        "completed",
        "cancelled",
        "no_show",
      ],
      entity_status: ["active", "inactive", "pending"],
      favorite_target: ["barber", "shop"],
      profile_status: ["active", "suspended"],
    },
  },
} as const
