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
      agent_performance_metrics: {
        Row: {
          agent_type: string
          avg_messages_per_customer: number | null
          avg_time_to_purchase_days: number | null
          conversion_rate: number | null
          conversions: number | null
          created_at: string | null
          customers_served: number | null
          id: string
          message_open_rate: number | null
          messages_sent: number | null
          negative_sentiment_rate: number | null
          neutral_sentiment_rate: number | null
          period_end: string
          period_start: string
          positive_sentiment_rate: number | null
          reply_rate: number | null
          revenue_generated: number | null
        }
        Insert: {
          agent_type: string
          avg_messages_per_customer?: number | null
          avg_time_to_purchase_days?: number | null
          conversion_rate?: number | null
          conversions?: number | null
          created_at?: string | null
          customers_served?: number | null
          id?: string
          message_open_rate?: number | null
          messages_sent?: number | null
          negative_sentiment_rate?: number | null
          neutral_sentiment_rate?: number | null
          period_end: string
          period_start: string
          positive_sentiment_rate?: number | null
          reply_rate?: number | null
          revenue_generated?: number | null
        }
        Update: {
          agent_type?: string
          avg_messages_per_customer?: number | null
          avg_time_to_purchase_days?: number | null
          conversion_rate?: number | null
          conversions?: number | null
          created_at?: string | null
          customers_served?: number | null
          id?: string
          message_open_rate?: number | null
          messages_sent?: number | null
          negative_sentiment_rate?: number | null
          neutral_sentiment_rate?: number | null
          period_end?: string
          period_start?: string
          positive_sentiment_rate?: number | null
          reply_rate?: number | null
          revenue_generated?: number | null
        }
        Relationships: []
      }
      agent_test_results: {
        Row: {
          accuracy_score: number | null
          agent_type: string
          created_at: string | null
          id: string
          knowledge_chunks_used: Json | null
          messages: Json
          test_scenario: Json
          tester_notes: string | null
        }
        Insert: {
          accuracy_score?: number | null
          agent_type: string
          created_at?: string | null
          id?: string
          knowledge_chunks_used?: Json | null
          messages: Json
          test_scenario: Json
          tester_notes?: string | null
        }
        Update: {
          accuracy_score?: number | null
          agent_type?: string
          created_at?: string | null
          id?: string
          knowledge_chunks_used?: Json | null
          messages?: Json
          test_scenario?: Json
          tester_notes?: string | null
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          ai_prompt: string | null
          channel: string
          contact_id: string | null
          converted: boolean | null
          converted_at: string | null
          customer_context: Json | null
          id: string
          message_body: string
          opened: boolean | null
          opened_at: string | null
          replied: boolean | null
          replied_at: string | null
          sent_at: string | null
          subject: string | null
          trigger_id: string | null
        }
        Insert: {
          ai_prompt?: string | null
          channel: string
          contact_id?: string | null
          converted?: boolean | null
          converted_at?: string | null
          customer_context?: Json | null
          id?: string
          message_body: string
          opened?: boolean | null
          opened_at?: string | null
          replied?: boolean | null
          replied_at?: string | null
          sent_at?: string | null
          subject?: string | null
          trigger_id?: string | null
        }
        Update: {
          ai_prompt?: string | null
          channel?: string
          contact_id?: string | null
          converted?: boolean | null
          converted_at?: string | null
          customer_context?: Json | null
          id?: string
          message_body?: string
          opened?: boolean | null
          opened_at?: string | null
          replied?: boolean | null
          replied_at?: string | null
          sent_at?: string | null
          subject?: string | null
          trigger_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_messages_trigger_id_fkey"
            columns: ["trigger_id"]
            isOneToOne: false
            referencedRelation: "automation_triggers"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_video_clips: {
        Row: {
          clip_url: string | null
          created_at: string | null
          duration_seconds: number | null
          error_message: string | null
          id: string
          job_id: string
          prompt_text: string
          scene_number: number
          status: string
          updated_at: string | null
          veo_task_id: string | null
        }
        Insert: {
          clip_url?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          id?: string
          job_id: string
          prompt_text: string
          scene_number: number
          status?: string
          updated_at?: string | null
          veo_task_id?: string | null
        }
        Update: {
          clip_url?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          id?: string
          job_id?: string
          prompt_text?: string
          scene_number?: number
          status?: string
          updated_at?: string | null
          veo_task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_video_clips_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ai_video_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_video_jobs: {
        Row: {
          clip_urls: Json | null
          created_at: string | null
          error_message: string | null
          final_video_url: string | null
          id: string
          metadata: Json | null
          scene_descriptions: Json | null
          script_id: string | null
          script_text: string
          status: string
          updated_at: string | null
          user_id: string
          video_prompts: Json | null
        }
        Insert: {
          clip_urls?: Json | null
          created_at?: string | null
          error_message?: string | null
          final_video_url?: string | null
          id?: string
          metadata?: Json | null
          scene_descriptions?: Json | null
          script_id?: string | null
          script_text: string
          status?: string
          updated_at?: string | null
          user_id: string
          video_prompts?: Json | null
        }
        Update: {
          clip_urls?: Json | null
          created_at?: string | null
          error_message?: string | null
          final_video_url?: string | null
          id?: string
          metadata?: Json | null
          scene_descriptions?: Json | null
          script_id?: string | null
          script_text?: string
          status?: string
          updated_at?: string | null
          user_id?: string
          video_prompts?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_video_jobs_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "content_scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_triggers: {
        Row: {
          action_config: Json
          action_type: string
          condition_config: Json | null
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          last_fired_at: string | null
          name: string
          priority: number | null
          stats: Json | null
          trigger_config: Json
          trigger_type: string
          updated_at: string | null
        }
        Insert: {
          action_config: Json
          action_type: string
          condition_config?: Json | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          last_fired_at?: string | null
          name: string
          priority?: number | null
          stats?: Json | null
          trigger_config: Json
          trigger_type: string
          updated_at?: string | null
        }
        Update: {
          action_config?: Json
          action_type?: string
          condition_config?: Json | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          last_fired_at?: string | null
          name?: string
          priority?: number | null
          stats?: Json | null
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
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
          activity_metadata: Json | null
          activity_type: string
          contact_id: string
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          score_impact: number | null
        }
        Insert: {
          activity_metadata?: Json | null
          activity_type: string
          contact_id: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          score_impact?: number | null
        }
        Update: {
          activity_metadata?: Json | null
          activity_type?: string
          contact_id?: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          score_impact?: number | null
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
      contact_assignments: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          assigned_to: string | null
          contact_id: string | null
          id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_to?: string | null
          contact_id?: string | null
          id?: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_to?: string | null
          contact_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_assignments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          account_size: string | null
          address_line1: string | null
          address_line2: string | null
          ai_profile: Json | null
          assets_traded: string[] | null
          avg_response_time: number | null
          behavioral_tags: string[] | null
          city: string | null
          country: string | null
          created_at: string
          customer_profile: Json | null
          customer_tier: string | null
          disputed_amount: number | null
          email: string | null
          engagement_level: string | null
          engagement_score: number | null
          engagement_velocity: number | null
          first_name: string | null
          form_responses: Json | null
          form_submissions: Json | null
          full_name: string
          goals: string[] | null
          has_disputed: boolean | null
          id: string
          last_contact_date: string | null
          last_engagement_action: string | null
          last_engagement_date: string | null
          last_name: string | null
          last_score_update: string | null
          lead_score: number | null
          lead_source: string | null
          lead_status: string | null
          likelihood_category: string | null
          likelihood_to_buy_score: number | null
          metadata: Json | null
          monday_board_id: string | null
          monday_board_name: string | null
          monday_item_id: string | null
          notes: string | null
          objections: string | null
          personality_type: string | null
          phone_number: string | null
          postal_code: string | null
          preferred_contact_method: string | null
          products_interested: string[] | null
          products_owned: string[] | null
          quiz_responses: Json | null
          referrer: string | null
          risk_tolerance: string | null
          score_trend: string | null
          sentiment: string | null
          state: string | null
          status: string | null
          subscription_status: string | null
          synced_at: string | null
          tags: string[] | null
          tier_badge_color: string | null
          time_availability: string | null
          total_spent: number | null
          trading_experience: string | null
          trading_style: string | null
          updated_at: string
          utm_campaign: string | null
          webinar_attendance: Json | null
        }
        Insert: {
          account_size?: string | null
          address_line1?: string | null
          address_line2?: string | null
          ai_profile?: Json | null
          assets_traded?: string[] | null
          avg_response_time?: number | null
          behavioral_tags?: string[] | null
          city?: string | null
          country?: string | null
          created_at?: string
          customer_profile?: Json | null
          customer_tier?: string | null
          disputed_amount?: number | null
          email?: string | null
          engagement_level?: string | null
          engagement_score?: number | null
          engagement_velocity?: number | null
          first_name?: string | null
          form_responses?: Json | null
          form_submissions?: Json | null
          full_name: string
          goals?: string[] | null
          has_disputed?: boolean | null
          id?: string
          last_contact_date?: string | null
          last_engagement_action?: string | null
          last_engagement_date?: string | null
          last_name?: string | null
          last_score_update?: string | null
          lead_score?: number | null
          lead_source?: string | null
          lead_status?: string | null
          likelihood_category?: string | null
          likelihood_to_buy_score?: number | null
          metadata?: Json | null
          monday_board_id?: string | null
          monday_board_name?: string | null
          monday_item_id?: string | null
          notes?: string | null
          objections?: string | null
          personality_type?: string | null
          phone_number?: string | null
          postal_code?: string | null
          preferred_contact_method?: string | null
          products_interested?: string[] | null
          products_owned?: string[] | null
          quiz_responses?: Json | null
          referrer?: string | null
          risk_tolerance?: string | null
          score_trend?: string | null
          sentiment?: string | null
          state?: string | null
          status?: string | null
          subscription_status?: string | null
          synced_at?: string | null
          tags?: string[] | null
          tier_badge_color?: string | null
          time_availability?: string | null
          total_spent?: number | null
          trading_experience?: string | null
          trading_style?: string | null
          updated_at?: string
          utm_campaign?: string | null
          webinar_attendance?: Json | null
        }
        Update: {
          account_size?: string | null
          address_line1?: string | null
          address_line2?: string | null
          ai_profile?: Json | null
          assets_traded?: string[] | null
          avg_response_time?: number | null
          behavioral_tags?: string[] | null
          city?: string | null
          country?: string | null
          created_at?: string
          customer_profile?: Json | null
          customer_tier?: string | null
          disputed_amount?: number | null
          email?: string | null
          engagement_level?: string | null
          engagement_score?: number | null
          engagement_velocity?: number | null
          first_name?: string | null
          form_responses?: Json | null
          form_submissions?: Json | null
          full_name?: string
          goals?: string[] | null
          has_disputed?: boolean | null
          id?: string
          last_contact_date?: string | null
          last_engagement_action?: string | null
          last_engagement_date?: string | null
          last_name?: string | null
          last_score_update?: string | null
          lead_score?: number | null
          lead_source?: string | null
          lead_status?: string | null
          likelihood_category?: string | null
          likelihood_to_buy_score?: number | null
          metadata?: Json | null
          monday_board_id?: string | null
          monday_board_name?: string | null
          monday_item_id?: string | null
          notes?: string | null
          objections?: string | null
          personality_type?: string | null
          phone_number?: string | null
          postal_code?: string | null
          preferred_contact_method?: string | null
          products_interested?: string[] | null
          products_owned?: string[] | null
          quiz_responses?: Json | null
          referrer?: string | null
          risk_tolerance?: string | null
          score_trend?: string | null
          sentiment?: string | null
          state?: string | null
          status?: string | null
          subscription_status?: string | null
          synced_at?: string | null
          tags?: string[] | null
          tier_badge_color?: string | null
          time_availability?: string | null
          total_spent?: number | null
          trading_experience?: string | null
          trading_style?: string | null
          updated_at?: string
          utm_campaign?: string | null
          webinar_attendance?: Json | null
        }
        Relationships: []
      }
      content_folders: {
        Row: {
          created_at: string | null
          id: string
          name: string
          parent_folder_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          parent_folder_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          parent_folder_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_folders_parent_folder_id_fkey"
            columns: ["parent_folder_id"]
            isOneToOne: false
            referencedRelation: "content_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      content_scripts: {
        Row: {
          created_at: string | null
          format: string
          hook_style: string | null
          id: string
          length_seconds: number | null
          metadata: Json | null
          script_text: string
          status: string | null
          story_id: string | null
          title: string
          tone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          format: string
          hook_style?: string | null
          id?: string
          length_seconds?: number | null
          metadata?: Json | null
          script_text: string
          status?: string | null
          story_id?: string | null
          title: string
          tone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          format?: string
          hook_style?: string | null
          id?: string
          length_seconds?: number | null
          metadata?: Json | null
          script_text?: string
          status?: string | null
          story_id?: string | null
          title?: string
          tone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_scripts_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "news_stories"
            referencedColumns: ["id"]
          },
        ]
      }
      content_videos: {
        Row: {
          composition_data: Json | null
          created_at: string | null
          duration_seconds: number | null
          file_size_bytes: number | null
          id: string
          is_final: boolean | null
          script_id: string | null
          source: string | null
          take_number: number | null
          thumbnail_url: string | null
          title: string | null
          user_id: string
          video_url: string
        }
        Insert: {
          composition_data?: Json | null
          created_at?: string | null
          duration_seconds?: number | null
          file_size_bytes?: number | null
          id?: string
          is_final?: boolean | null
          script_id?: string | null
          source?: string | null
          take_number?: number | null
          thumbnail_url?: string | null
          title?: string | null
          user_id: string
          video_url: string
        }
        Update: {
          composition_data?: Json | null
          created_at?: string | null
          duration_seconds?: number | null
          file_size_bytes?: number | null
          id?: string
          is_final?: boolean | null
          script_id?: string | null
          source?: string | null
          take_number?: number | null
          thumbnail_url?: string | null
          title?: string | null
          user_id?: string
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_videos_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "content_scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_state: {
        Row: {
          active_agent_id: string | null
          agent_priority: number | null
          agent_queue: Json | null
          contact_id: string
          created_at: string | null
          current_conversation_phase: string | null
          id: string
          last_engagement_at: string | null
          last_message_sent_at: string | null
          last_topic: string | null
          messages_sent_this_week: number | null
          messages_sent_today: number | null
          updated_at: string | null
          waiting_for_reply: boolean | null
          waiting_until: string | null
        }
        Insert: {
          active_agent_id?: string | null
          agent_priority?: number | null
          agent_queue?: Json | null
          contact_id: string
          created_at?: string | null
          current_conversation_phase?: string | null
          id?: string
          last_engagement_at?: string | null
          last_message_sent_at?: string | null
          last_topic?: string | null
          messages_sent_this_week?: number | null
          messages_sent_today?: number | null
          updated_at?: string | null
          waiting_for_reply?: boolean | null
          waiting_until?: string | null
        }
        Update: {
          active_agent_id?: string | null
          agent_priority?: number | null
          agent_queue?: Json | null
          contact_id?: string
          created_at?: string | null
          current_conversation_phase?: string | null
          id?: string
          last_engagement_at?: string | null
          last_message_sent_at?: string | null
          last_topic?: string | null
          messages_sent_this_week?: number | null
          messages_sent_today?: number | null
          updated_at?: string | null
          waiting_for_reply?: boolean | null
          waiting_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_state_active_agent_id_fkey"
            columns: ["active_agent_id"]
            isOneToOne: false
            referencedRelation: "product_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_state_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
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
      funnel_conversions: {
        Row: {
          contact_id: string
          conversion_type: string
          converted_at: string | null
          funnel_id: string
          id: string
          order_value: number
          product_id: string | null
          visit_id: string
        }
        Insert: {
          contact_id: string
          conversion_type: string
          converted_at?: string | null
          funnel_id: string
          id?: string
          order_value: number
          product_id?: string | null
          visit_id: string
        }
        Update: {
          contact_id?: string
          conversion_type?: string
          converted_at?: string | null
          funnel_id?: string
          id?: string
          order_value?: number
          product_id?: string | null
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "funnel_conversions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_conversions_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_conversions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_conversions_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "funnel_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_step_events: {
        Row: {
          contact_id: string | null
          created_at: string | null
          duration_seconds: number | null
          event_type: string
          id: string
          metadata: Json | null
          step_id: string
          visit_id: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          event_type: string
          id?: string
          metadata?: Json | null
          step_id: string
          visit_id: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          event_type?: string
          id?: string
          metadata?: Json | null
          step_id?: string
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "funnel_step_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_step_events_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "funnel_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_step_events_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "funnel_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_steps: {
        Row: {
          conversion_goal: string | null
          created_at: string | null
          funnel_id: string
          id: string
          page_url: string
          step_name: string
          step_number: number
          step_type: string
        }
        Insert: {
          conversion_goal?: string | null
          created_at?: string | null
          funnel_id: string
          id?: string
          page_url: string
          step_name: string
          step_number: number
          step_type: string
        }
        Update: {
          conversion_goal?: string | null
          created_at?: string | null
          funnel_id?: string
          id?: string
          page_url?: string
          step_name?: string
          step_number?: number
          step_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "funnel_steps_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_visits: {
        Row: {
          browser: string | null
          completed: boolean | null
          contact_id: string | null
          current_step_id: string | null
          device_type: string | null
          entry_step_id: string | null
          funnel_id: string
          id: string
          ip_address: string | null
          last_activity_at: string | null
          referrer: string | null
          session_id: string
          started_at: string | null
          total_value: number | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          browser?: string | null
          completed?: boolean | null
          contact_id?: string | null
          current_step_id?: string | null
          device_type?: string | null
          entry_step_id?: string | null
          funnel_id: string
          id?: string
          ip_address?: string | null
          last_activity_at?: string | null
          referrer?: string | null
          session_id: string
          started_at?: string | null
          total_value?: number | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          browser?: string | null
          completed?: boolean | null
          contact_id?: string | null
          current_step_id?: string | null
          device_type?: string | null
          entry_step_id?: string | null
          funnel_id?: string
          id?: string
          ip_address?: string | null
          last_activity_at?: string | null
          referrer?: string | null
          session_id?: string
          started_at?: string | null
          total_value?: number | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funnel_visits_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_visits_current_step_id_fkey"
            columns: ["current_step_id"]
            isOneToOne: false
            referencedRelation: "funnel_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_visits_entry_step_id_fkey"
            columns: ["entry_step_id"]
            isOneToOne: false
            referencedRelation: "funnel_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_visits_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
        ]
      }
      funnels: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      knowledge_base: {
        Row: {
          category: string
          chunk_index: number | null
          chunk_metadata: Json | null
          content: string | null
          created_at: string
          embedding: string | null
          file_path: string | null
          file_type: string | null
          id: string
          parent_document_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          chunk_index?: number | null
          chunk_metadata?: Json | null
          content?: string | null
          created_at?: string
          embedding?: string | null
          file_path?: string | null
          file_type?: string | null
          id?: string
          parent_document_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          chunk_index?: number | null
          chunk_metadata?: Json | null
          content?: string | null
          created_at?: string
          embedding?: string | null
          file_path?: string | null
          file_type?: string | null
          id?: string
          parent_document_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_base_parent_document_id_fkey"
            columns: ["parent_document_id"]
            isOneToOne: false
            referencedRelation: "knowledge_base"
            referencedColumns: ["id"]
          },
        ]
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
      news_stories: {
        Row: {
          ai_analysis: Json | null
          category: string | null
          content: string
          created_at: string | null
          id: string
          source: string
          tags: string[] | null
          title: string
          updated_at: string | null
          url: string | null
          user_id: string
          viral_score: number | null
        }
        Insert: {
          ai_analysis?: Json | null
          category?: string | null
          content: string
          created_at?: string | null
          id?: string
          source: string
          tags?: string[] | null
          title: string
          updated_at?: string | null
          url?: string | null
          user_id: string
          viral_score?: number | null
        }
        Update: {
          ai_analysis?: Json | null
          category?: string | null
          content?: string
          created_at?: string | null
          id?: string
          source?: string
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          url?: string | null
          user_id?: string
          viral_score?: number | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          contact_id: string | null
          created_at: string | null
          description: string | null
          id: string
          is_read: boolean | null
          snoozed_until: string | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_read?: boolean | null
          snoozed_until?: string | null
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_read?: boolean | null
          snoozed_until?: string | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      product_agents: {
        Row: {
          agent_context: Json
          assigned_date: string
          contact_id: string
          conversion_achieved: boolean | null
          conversion_date: string | null
          created_at: string | null
          direction: string | null
          expiration_date: string
          id: string
          last_engagement_at: string | null
          messages_sent: number | null
          product_id: string | null
          product_type: string
          replies_received: number | null
          status: string
          updated_at: string | null
        }
        Insert: {
          agent_context?: Json
          assigned_date?: string
          contact_id: string
          conversion_achieved?: boolean | null
          conversion_date?: string | null
          created_at?: string | null
          direction?: string | null
          expiration_date: string
          id?: string
          last_engagement_at?: string | null
          messages_sent?: number | null
          product_id?: string | null
          product_type: string
          replies_received?: number | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          agent_context?: Json
          assigned_date?: string
          contact_id?: string
          conversion_achieved?: boolean | null
          conversion_date?: string | null
          created_at?: string | null
          direction?: string | null
          expiration_date?: string
          id?: string
          last_engagement_at?: string | null
          messages_sent?: number | null
          product_id?: string | null
          product_type?: string
          replies_received?: number | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_agents_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          price: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          price?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          price?: number | null
        }
        Relationships: []
      }
      purchases: {
        Row: {
          amount: number
          contact_id: string | null
          id: string
          metadata: Json | null
          product_id: string | null
          purchase_date: string | null
          status: string | null
          stripe_charge_id: string | null
        }
        Insert: {
          amount: number
          contact_id?: string | null
          id?: string
          metadata?: Json | null
          product_id?: string | null
          purchase_date?: string | null
          status?: string | null
          stripe_charge_id?: string | null
        }
        Update: {
          amount?: number
          contact_id?: string | null
          id?: string
          metadata?: Json | null
          product_id?: string | null
          purchase_date?: string | null
          status?: string | null
          stripe_charge_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchases_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_messages: {
        Row: {
          agent_id: string | null
          channel: string
          contact_id: string
          created_at: string | null
          error_message: string | null
          id: string
          message_body: string
          message_type: string
          personalization_data: Json | null
          retry_count: number | null
          scheduled_for: string
          sent_at: string | null
          status: string
          subject: string | null
          updated_at: string | null
        }
        Insert: {
          agent_id?: string | null
          channel: string
          contact_id: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          message_body: string
          message_type: string
          personalization_data?: Json | null
          retry_count?: number | null
          scheduled_for: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          updated_at?: string | null
        }
        Update: {
          agent_id?: string | null
          channel?: string
          contact_id?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          message_body?: string
          message_type?: string
          personalization_data?: Json | null
          retry_count?: number | null
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_messages_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "product_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      segments: {
        Row: {
          created_at: string | null
          created_by: string | null
          customer_count: number | null
          description: string | null
          filter_config: Json
          folder: string | null
          id: string
          is_dynamic: boolean | null
          name: string
          updated_at: string | null
          visibility: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          customer_count?: number | null
          description?: string | null
          filter_config: Json
          folder?: string | null
          id?: string
          is_dynamic?: boolean | null
          name: string
          updated_at?: string | null
          visibility?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          customer_count?: number | null
          description?: string | null
          filter_config?: Json
          folder?: string | null
          id?: string
          is_dynamic?: boolean | null
          name?: string
          updated_at?: string | null
          visibility?: string | null
        }
        Relationships: []
      }
      style_guides: {
        Row: {
          created_at: string | null
          file_name: string | null
          format: string
          id: string
          instructions: string | null
          is_active: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          file_name?: string | null
          format: string
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          file_name?: string | null
          format?: string
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
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
      video_projects: {
        Row: {
          created_at: string | null
          duration_seconds: number | null
          id: string
          project_name: string
          source_video_id: string | null
          status: string | null
          timeline_data: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          project_name: string
          source_video_id?: string | null
          status?: string | null
          timeline_data?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          project_name?: string
          source_video_id?: string | null
          status?: string | null
          timeline_data?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_projects_source_video_id_fkey"
            columns: ["source_video_id"]
            isOneToOne: false
            referencedRelation: "content_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_render_jobs: {
        Row: {
          composition_data: Json
          created_at: string | null
          error_message: string | null
          id: string
          progress: number | null
          settings: Json
          status: string
          updated_at: string | null
          user_id: string
          video_url: string | null
        }
        Insert: {
          composition_data: Json
          created_at?: string | null
          error_message?: string | null
          id?: string
          progress?: number | null
          settings: Json
          status?: string
          updated_at?: string | null
          user_id: string
          video_url?: string | null
        }
        Update: {
          composition_data?: Json
          created_at?: string | null
          error_message?: string | null
          id?: string
          progress?: number | null
          settings?: Json
          status?: string
          updated_at?: string | null
          user_id?: string
          video_url?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      archive_inactive_agents: { Args: never; Returns: undefined }
      calculate_lead_score: { Args: { p_contact_id: string }; Returns: number }
      expire_old_agents: { Args: never; Returns: undefined }
      get_customer_context: { Args: { p_contact_id: string }; Returns: Json }
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
      reset_daily_message_counters: { Args: never; Returns: undefined }
      reset_weekly_message_counters: { Args: never; Returns: undefined }
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
