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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      campaign_messages: {
        Row: {
          campaign_id: string
          created_at: string
          error_message: string | null
          html_body: string | null
          id: string
          monday_contact_id: string | null
          personalized_message: string
          phone_number: string
          plain_text_body: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["campaign_message_status"]
          subject: string | null
          to_email: string | null
          twilio_message_sid: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          error_message?: string | null
          html_body?: string | null
          id?: string
          monday_contact_id?: string | null
          personalized_message: string
          phone_number: string
          plain_text_body?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["campaign_message_status"]
          subject?: string | null
          to_email?: string | null
          twilio_message_sid?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          error_message?: string | null
          html_body?: string | null
          id?: string
          monday_contact_id?: string | null
          personalized_message?: string
          phone_number?: string
          plain_text_body?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["campaign_message_status"]
          subject?: string | null
          to_email?: string | null
          twilio_message_sid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          audience_filter: Json | null
          channel: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          delivered_count: number | null
          failed_count: number | null
          from_email: string | null
          from_name: string | null
          html_template: string | null
          id: string
          message_template: string
          name: string
          opt_out_count: number | null
          plain_text_template: string | null
          reply_count: number | null
          reply_to: string | null
          scheduled_time: string | null
          sent_count: number | null
          status: Database["public"]["Enums"]["campaign_status"]
          subject: string | null
          total_contacts: number | null
          updated_at: string
        }
        Insert: {
          audience_filter?: Json | null
          channel?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          delivered_count?: number | null
          failed_count?: number | null
          from_email?: string | null
          from_name?: string | null
          html_template?: string | null
          id?: string
          message_template: string
          name: string
          opt_out_count?: number | null
          plain_text_template?: string | null
          reply_count?: number | null
          reply_to?: string | null
          scheduled_time?: string | null
          sent_count?: number | null
          status?: Database["public"]["Enums"]["campaign_status"]
          subject?: string | null
          total_contacts?: number | null
          updated_at?: string
        }
        Update: {
          audience_filter?: Json | null
          channel?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          delivered_count?: number | null
          failed_count?: number | null
          from_email?: string | null
          from_name?: string | null
          html_template?: string | null
          id?: string
          message_template?: string
          name?: string
          opt_out_count?: number | null
          plain_text_template?: string | null
          reply_count?: number | null
          reply_to?: string | null
          scheduled_time?: string | null
          sent_count?: number | null
          status?: Database["public"]["Enums"]["campaign_status"]
          subject?: string | null
          total_contacts?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      contact_activities: {
        Row: {
          activity_type: string
          contact_id: string
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
        }
        Insert: {
          activity_type: string
          contact_id: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
        }
        Update: {
          activity_type?: string
          contact_id?: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          ai_profile: Json | null
          created_at: string
          customer_profile: Json | null
          email: string | null
          engagement_score: number | null
          first_name: string | null
          full_name: string
          id: string
          last_contact_date: string | null
          last_name: string | null
          lead_score: number | null
          metadata: Json | null
          monday_board_id: string | null
          monday_board_name: string | null
          monday_item_id: string | null
          notes: string | null
          phone_number: string | null
          products_interested: string[] | null
          products_owned: string[] | null
          status: string | null
          synced_at: string | null
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          ai_profile?: Json | null
          created_at?: string
          customer_profile?: Json | null
          email?: string | null
          engagement_score?: number | null
          first_name?: string | null
          full_name: string
          id?: string
          last_contact_date?: string | null
          last_name?: string | null
          lead_score?: number | null
          metadata?: Json | null
          monday_board_id?: string | null
          monday_board_name?: string | null
          monday_item_id?: string | null
          notes?: string | null
          phone_number?: string | null
          products_interested?: string[] | null
          products_owned?: string[] | null
          status?: string | null
          synced_at?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          ai_profile?: Json | null
          created_at?: string
          customer_profile?: Json | null
          email?: string | null
          engagement_score?: number | null
          first_name?: string | null
          full_name?: string
          id?: string
          last_contact_date?: string | null
          last_name?: string | null
          lead_score?: number | null
          metadata?: Json | null
          monday_board_id?: string | null
          monday_board_name?: string | null
          monday_item_id?: string | null
          notes?: string | null
          phone_number?: string | null
          products_interested?: string[] | null
          products_owned?: string[] | null
          status?: string | null
          synced_at?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          assigned_agent: Database["public"]["Enums"]["agent_type"]
          contact_id: string | null
          contact_name: string | null
          created_at: string
          id: string
          last_message_at: string | null
          monday_contact_id: string | null
          phone_number: string
          status: Database["public"]["Enums"]["conversation_status"]
          updated_at: string
        }
        Insert: {
          assigned_agent?: Database["public"]["Enums"]["agent_type"]
          contact_id?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          monday_contact_id?: string | null
          phone_number: string
          status?: Database["public"]["Enums"]["conversation_status"]
          updated_at?: string
        }
        Update: {
          assigned_agent?: Database["public"]["Enums"]["agent_type"]
          contact_id?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          monday_contact_id?: string | null
          phone_number?: string
          status?: Database["public"]["Enums"]["conversation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base: {
        Row: {
          category: string
          content: string | null
          created_at: string
          embedding: string | null
          file_path: string | null
          file_type: string | null
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          content?: string | null
          created_at?: string
          embedding?: string | null
          file_path?: string | null
          file_type?: string | null
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          content?: string | null
          created_at?: string
          embedding?: string | null
          file_path?: string | null
          file_type?: string | null
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          direction: Database["public"]["Enums"]["message_direction"]
          id: string
          sender: Database["public"]["Enums"]["message_sender"]
          status: Database["public"]["Enums"]["message_status"]
          twilio_message_sid: string | null
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          direction: Database["public"]["Enums"]["message_direction"]
          id?: string
          sender: Database["public"]["Enums"]["message_sender"]
          status?: Database["public"]["Enums"]["message_status"]
          twilio_message_sid?: string | null
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          direction?: Database["public"]["Enums"]["message_direction"]
          id?: string
          sender?: Database["public"]["Enums"]["message_sender"]
          status?: Database["public"]["Enums"]["message_status"]
          twilio_message_sid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: unknown
      }
      match_documents: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          category: string
          content: string
          file_path: string
          id: string
          similarity: number
          title: string
        }[]
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
    }
    Enums: {
      agent_type: "sales_ai" | "cs_ai" | "human_team"
      campaign_message_status: "pending" | "sent" | "delivered" | "failed"
      campaign_status:
        | "draft"
        | "scheduled"
        | "running"
        | "completed"
        | "paused"
      conversation_status: "active" | "closed" | "needs_human" | "opted_out"
      message_direction: "inbound" | "outbound"
      message_sender: "customer" | "ai_sales" | "ai_cs" | "human_team"
      message_status: "sent" | "delivered" | "failed" | "read"
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
      agent_type: ["sales_ai", "cs_ai", "human_team"],
      campaign_message_status: ["pending", "sent", "delivered", "failed"],
      campaign_status: ["draft", "scheduled", "running", "completed", "paused"],
      conversation_status: ["active", "closed", "needs_human", "opted_out"],
      message_direction: ["inbound", "outbound"],
      message_sender: ["customer", "ai_sales", "ai_cs", "human_team"],
      message_status: ["sent", "delivered", "failed", "read"],
    },
  },
} as const
