export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      app_settings: {
        Row: {
          created_at: string
          description: string | null
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          description?: string | null
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      content_book: {
        Row: {
          authors: string
          body: string | null
          date_created: string
          date_published: string | null
          description: string
          free: boolean
          id: number
          image_path: string | null
          link: string
          publisher: string
          status: string
          summary: string | null
          title: string
        }
        Insert: {
          authors: string
          body?: string | null
          date_created: string
          date_published?: string | null
          description: string
          free?: boolean
          id?: number
          image_path?: string | null
          link: string
          publisher: string
          status?: string
          summary?: string | null
          title: string
        }
        Update: {
          authors?: string
          body?: string | null
          date_created?: string
          date_published?: string | null
          description?: string
          free?: boolean
          id?: number
          image_path?: string | null
          link?: string
          publisher?: string
          status?: string
          summary?: string | null
          title?: string
        }
        Relationships: []
      }
      content_book_topics: {
        Row: {
          book_id: number
          id: number
          topic_id: number
        }
        Insert: {
          book_id: number
          id?: number
          topic_id: number
        }
        Update: {
          book_id?: number
          id?: number
          topic_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "content_book_topics_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "content_book"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_book_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "content_topic"
            referencedColumns: ["id"]
          },
        ]
      }
      content_post: {
        Row: {
          content: string | null
          date_created: string
          date_published: string | null
          description: string
          id: number
          image_path: string | null
          indexed: boolean
          link: string
          site_id: number | null
          slug: string | null
          status: string
          summary: string
          tags_list: string | null
          title: string
          user_id: number | null
        }
        Insert: {
          content?: string | null
          date_created: string
          date_published?: string | null
          description: string
          id?: number
          image_path?: string | null
          indexed: boolean
          link: string
          site_id?: number | null
          slug?: string | null
          status: string
          summary: string
          tags_list?: string | null
          title: string
          user_id?: number | null
        }
        Update: {
          content?: string | null
          date_created?: string
          date_published?: string | null
          description?: string
          id?: number
          image_path?: string | null
          indexed?: boolean
          link?: string
          site_id?: number | null
          slug?: string | null
          status?: string
          summary?: string
          tags_list?: string | null
          title?: string
          user_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "content_post_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "content_site"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_post_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_post_topics: {
        Row: {
          id: number
          post_id: number
          topic_id: number
        }
        Insert: {
          id?: number
          post_id: number
          topic_id: number
        }
        Update: {
          id?: number
          post_id?: number
          topic_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "content_post_topics_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "content_post"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_post_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "content_topic"
            referencedColumns: ["id"]
          },
        ]
      }
      content_resource: {
        Row: {
          body: string | null
          date_created: string
          date_published: string | null
          description: string
          id: number
          image_path: string | null
          link: string
          resource_category_id: number | null
          slug: string
          status: string
          summary: string
          title: string
          user_id: number | null
        }
        Insert: {
          body?: string | null
          date_created?: string
          date_published?: string | null
          description?: string
          id?: number
          image_path?: string | null
          link: string
          resource_category_id?: number | null
          slug?: string
          status?: string
          summary?: string
          title: string
          user_id?: number | null
        }
        Update: {
          body?: string | null
          date_created?: string
          date_published?: string | null
          description?: string
          id?: number
          image_path?: string | null
          link?: string
          resource_category_id?: number | null
          slug?: string
          status?: string
          summary?: string
          title?: string
          user_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "content_resource_resource_category_id_fkey"
            columns: ["resource_category_id"]
            isOneToOne: false
            referencedRelation: "content_resource_category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_resource_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_resource_category: {
        Row: {
          created_at: string
          description: string | null
          id: number
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: number
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: number
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      content_resource_topics: {
        Row: {
          id: number
          resource_id: number
          topic_id: number
        }
        Insert: {
          id?: number
          resource_id: number
          topic_id: number
        }
        Update: {
          id?: number
          resource_id?: number
          topic_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "content_resource_topics_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "content_resource"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_resource_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "content_topic"
            referencedColumns: ["id"]
          },
        ]
      }
      content_site: {
        Row: {
          content: string | null
          description: string | null
          feed_url: string | null
          id: number
          include_in_newsfeed: boolean
          site_icon: string | null
          slug: string
          status: string
          title: string
          url: string
          user_id: number | null
        }
        Insert: {
          content?: string | null
          description?: string | null
          feed_url?: string | null
          id: number
          include_in_newsfeed: boolean
          site_icon?: string | null
          slug: string
          status: string
          title: string
          url: string
          user_id?: number | null
        }
        Update: {
          content?: string | null
          description?: string | null
          feed_url?: string | null
          id?: number
          include_in_newsfeed?: boolean
          site_icon?: string | null
          slug?: string
          status?: string
          title?: string
          url?: string
          user_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "content_site_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_site_site_type: {
        Row: {
          id: number
          site_id: number
          sitetype_id: number
        }
        Insert: {
          id: number
          site_id: number
          sitetype_id: number
        }
        Update: {
          id?: number
          site_id?: number
          sitetype_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "content_site_site_type_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "content_site"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_site_site_type_sitetype_id_fkey"
            columns: ["sitetype_id"]
            isOneToOne: false
            referencedRelation: "content_sitetype"
            referencedColumns: ["id"]
          },
        ]
      }
      content_sitetype: {
        Row: {
          id: number
          name: string
          slug: string
        }
        Insert: {
          id: number
          name: string
          slug: string
        }
        Update: {
          id?: number
          name?: string
          slug?: string
        }
        Relationships: []
      }
      content_tool: {
        Row: {
          body: string | null
          date: string
          description: string
          id: number
          image: string
          link: string
          slug: string
          status: string
          title: string
          user_id: number | null
        }
        Insert: {
          body?: string | null
          date: string
          description: string
          id: number
          image: string
          link: string
          slug: string
          status: string
          title: string
          user_id?: number | null
        }
        Update: {
          body?: string | null
          date?: string
          description?: string
          id?: number
          image?: string
          link?: string
          slug?: string
          status?: string
          title?: string
          user_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "content_tool_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_tool_topics: {
        Row: {
          id: number
          tool_id: number
          topic_id: number
        }
        Insert: {
          id: number
          tool_id: number
          topic_id: number
        }
        Update: {
          id?: number
          tool_id?: number
          topic_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "content_tool_topics_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "content_tool"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_tool_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "content_topic"
            referencedColumns: ["id"]
          },
        ]
      }
      content_topic: {
        Row: {
          description: string | null
          id: number
          name: string
          slug: string
        }
        Insert: {
          description?: string | null
          id: number
          name: string
          slug: string
        }
        Update: {
          description?: string | null
          id?: number
          name?: string
          slug?: string
        }
        Relationships: []
      }
      content_user_topics: {
        Row: {
          created_at: string
          id: number
          topic_id: number
          user_profile_id: number
        }
        Insert: {
          created_at?: string
          id?: number
          topic_id: number
          user_profile_id: number
        }
        Update: {
          created_at?: string
          id?: number
          topic_id?: number
          user_profile_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "content_user_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "content_topic"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_user_topics_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      detailed_logs: {
        Row: {
          error: Json | null
          execution_id: string
          function_name: string
          id: number
          job_id: number | null
          level: string
          message: string
          metadata: Json | null
          step: string | null
          timestamp: string
        }
        Insert: {
          error?: Json | null
          execution_id: string
          function_name: string
          id?: number
          job_id?: number | null
          level: string
          message: string
          metadata?: Json | null
          step?: string | null
          timestamp?: string
        }
        Update: {
          error?: Json | null
          execution_id?: string
          function_name?: string
          id?: number
          job_id?: number | null
          level?: string
          message?: string
          metadata?: Json | null
          step?: string | null
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "detailed_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "feed_processing_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      edge_function_logs: {
        Row: {
          completed_at: string | null
          context: Json | null
          duration_ms: number | null
          error: string | null
          execution_id: string
          function_name: string
          id: number
          items_failed: number | null
          items_processed: number | null
          job_id: number | null
          memory_used_mb: number | null
          started_at: string
          status: string
          success: boolean | null
        }
        Insert: {
          completed_at?: string | null
          context?: Json | null
          duration_ms?: number | null
          error?: string | null
          execution_id?: string
          function_name: string
          id?: number
          items_failed?: number | null
          items_processed?: number | null
          job_id?: number | null
          memory_used_mb?: number | null
          started_at?: string
          status: string
          success?: boolean | null
        }
        Update: {
          completed_at?: string | null
          context?: Json | null
          duration_ms?: number | null
          error?: string | null
          execution_id?: string
          function_name?: string
          id?: number
          items_failed?: number | null
          items_processed?: number | null
          job_id?: number | null
          memory_used_mb?: number | null
          started_at?: string
          status?: string
          success?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "edge_function_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "feed_processing_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      edge_function_steps: {
        Row: {
          completed_at: string | null
          data: Json | null
          duration_ms: number | null
          id: number
          log_id: number | null
          message: string | null
          started_at: string
          step_name: string
          success: boolean | null
        }
        Insert: {
          completed_at?: string | null
          data?: Json | null
          duration_ms?: number | null
          id?: number
          log_id?: number | null
          message?: string | null
          started_at?: string
          step_name: string
          success?: boolean | null
        }
        Update: {
          completed_at?: string | null
          data?: Json | null
          duration_ms?: number | null
          id?: number
          log_id?: number | null
          message?: string | null
          started_at?: string
          step_name?: string
          success?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "edge_function_steps_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: false
            referencedRelation: "admin_activity_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edge_function_steps_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: false
            referencedRelation: "edge_function_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_processing_batches: {
        Row: {
          batch_number: number
          completed_at: string | null
          continuation: boolean
          created_at: string
          current_site: string | null
          error: string | null
          error_count: number
          id: number
          items_processed: number
          job_id: number | null
          last_updated: string | null
          previous_batch_id: number | null
          started_at: string | null
          state: Json | null
          status: string
        }
        Insert: {
          batch_number: number
          completed_at?: string | null
          continuation?: boolean
          created_at?: string
          current_site?: string | null
          error?: string | null
          error_count?: number
          id?: number
          items_processed?: number
          job_id?: number | null
          last_updated?: string | null
          previous_batch_id?: number | null
          started_at?: string | null
          state?: Json | null
          status?: string
        }
        Update: {
          batch_number?: number
          completed_at?: string | null
          continuation?: boolean
          created_at?: string
          current_site?: string | null
          error?: string | null
          error_count?: number
          id?: number
          items_processed?: number
          job_id?: number | null
          last_updated?: string | null
          previous_batch_id?: number | null
          started_at?: string | null
          state?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_processing_batches_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "feed_processing_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_processing_batches_previous_batch_id_fkey"
            columns: ["previous_batch_id"]
            isOneToOne: false
            referencedRelation: "feed_processing_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_processing_events: {
        Row: {
          batch_id: number | null
          created_at: string
          event_type: string
          id: number
          job_id: number | null
          payload: Json | null
          processed: boolean | null
          processed_at: string | null
        }
        Insert: {
          batch_id?: number | null
          created_at?: string
          event_type: string
          id?: number
          job_id?: number | null
          payload?: Json | null
          processed?: boolean | null
          processed_at?: string | null
        }
        Update: {
          batch_id?: number | null
          created_at?: string
          event_type?: string
          id?: number
          job_id?: number | null
          payload?: Json | null
          processed?: boolean | null
          processed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feed_processing_events_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "feed_processing_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_processing_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "feed_processing_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_processing_jobs: {
        Row: {
          batch_size: number | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          current_batch: number | null
          current_site: string | null
          duration: number | null
          error: string | null
          error_count: number
          id: number
          is_cron: boolean | null
          job_type: string
          last_processed_item_id: number | null
          last_processed_site_id: number | null
          last_updated: string | null
          metadata: Json | null
          processed_items: number
          processed_sites: number
          started_at: string | null
          status: string
          total_batches: number | null
          total_sites: number
        }
        Insert: {
          batch_size?: number | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          current_batch?: number | null
          current_site?: string | null
          duration?: number | null
          error?: string | null
          error_count?: number
          id?: number
          is_cron?: boolean | null
          job_type?: string
          last_processed_item_id?: number | null
          last_processed_site_id?: number | null
          last_updated?: string | null
          metadata?: Json | null
          processed_items?: number
          processed_sites?: number
          started_at?: string | null
          status?: string
          total_batches?: number | null
          total_sites?: number
        }
        Update: {
          batch_size?: number | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          current_batch?: number | null
          current_site?: string | null
          duration?: number | null
          error?: string | null
          error_count?: number
          id?: number
          is_cron?: boolean | null
          job_type?: string
          last_processed_item_id?: number | null
          last_processed_site_id?: number | null
          last_updated?: string | null
          metadata?: Json | null
          processed_items?: number
          processed_sites?: number
          started_at?: string | null
          status?: string
          total_batches?: number | null
          total_sites?: number
        }
        Relationships: []
      }
      newsletter_posts: {
        Row: {
          audience: string
          authors: string[]
          beehiiv_id: string
          content: Json
          created_at: string
          displayed_date: string
          id: string
          meta_default_description: string | null
          meta_default_title: string | null
          preview_text: string | null
          publish_date: string
          slug: string
          stats: Json | null
          status: string
          subtitle: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          web_url: string
        }
        Insert: {
          audience: string
          authors?: string[]
          beehiiv_id: string
          content?: Json
          created_at?: string
          displayed_date: string
          id?: string
          meta_default_description?: string | null
          meta_default_title?: string | null
          preview_text?: string | null
          publish_date: string
          slug: string
          stats?: Json | null
          status: string
          subtitle?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          web_url: string
        }
        Update: {
          audience?: string
          authors?: string[]
          beehiiv_id?: string
          content?: Json
          created_at?: string
          displayed_date?: string
          id?: string
          meta_default_description?: string | null
          meta_default_title?: string | null
          preview_text?: string | null
          publish_date?: string
          slug?: string
          stats?: Json | null
          status?: string
          subtitle?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          web_url?: string
        }
        Relationships: []
      }
      search_history: {
        Row: {
          created_at: string
          id: number
          query: string
          summary: string | null
          total_results: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: never
          query: string
          summary?: string | null
          total_results?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: never
          query?: string
          summary?: string | null
          total_results?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          biography: string | null
          bluesky: string | null
          created_at: string
          id: number
          image_url: string | null
          is_admin: boolean
          linkedin: string | null
          name: string | null
          newsletter_pending: boolean | null
          newsletter_subscriber: boolean | null
          role: string | null
          user_id: string | null
          username: string
          website: string | null
        }
        Insert: {
          biography?: string | null
          bluesky?: string | null
          created_at?: string
          id?: number
          image_url?: string | null
          is_admin?: boolean
          linkedin?: string | null
          name?: string | null
          newsletter_pending?: boolean | null
          newsletter_subscriber?: boolean | null
          role?: string | null
          user_id?: string | null
          username: string
          website?: string | null
        }
        Update: {
          biography?: string | null
          bluesky?: string | null
          created_at?: string
          id?: number
          image_url?: string | null
          is_admin?: boolean
          linkedin?: string | null
          name?: string | null
          newsletter_pending?: boolean | null
          newsletter_subscriber?: boolean | null
          role?: string | null
          user_id?: string | null
          username?: string
          website?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      admin_activity_logs: {
        Row: {
          batch_size: number | null
          completed_at: string | null
          current_batch: number | null
          current_site: string | null
          duration_ms: number | null
          error: string | null
          execution_id: string | null
          function_name: string | null
          id: number | null
          items_failed: number | null
          items_processed: number | null
          job_id: number | null
          processed_sites: number | null
          started_at: string | null
          status: string | null
          success: boolean | null
          successful_steps: number | null
          total_batches: number | null
          total_sites: number | null
          total_steps: number | null
        }
        Relationships: [
          {
            foreignKeyName: "edge_function_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "feed_processing_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      binary_quantize:
        | {
            Args: {
              "": string
            }
            Returns: unknown
          }
        | {
            Args: {
              "": unknown
            }
            Returns: unknown
          }
      check_job_completion: {
        Args: {
          job_id_param: number
        }
        Returns: boolean
      }
      cleanup_stalled_batches: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      generate_unique_slug: {
        Args: {
          title: string
        }
        Returns: string
      }
      halfvec_avg: {
        Args: {
          "": number[]
        }
        Returns: unknown
      }
      halfvec_out: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      halfvec_send: {
        Args: {
          "": unknown
        }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: {
          "": unknown[]
        }
        Returns: number
      }
      hnsw_bit_support: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      hnswhandler: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      ivfflat_bit_support: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      ivfflathandler: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      l2_norm:
        | {
            Args: {
              "": unknown
            }
            Returns: number
          }
        | {
            Args: {
              "": unknown
            }
            Returns: number
          }
      l2_normalize:
        | {
            Args: {
              "": string
            }
            Returns: string
          }
        | {
            Args: {
              "": unknown
            }
            Returns: unknown
          }
        | {
            Args: {
              "": unknown
            }
            Returns: unknown
          }
      match_documents:
        | {
            Args: {
              query_embedding: string
              match_count?: number
              filter?: Json
            }
            Returns: {
              id: number
              content: string
              metadata: Json
              embedding: Json
              similarity: number
            }[]
          }
        | {
            Args: {
              query_embedding: string
              match_threshold?: number
              match_count?: number
            }
            Returns: {
              id: number
              content: string
              metadata: Json
              similarity: number
            }[]
          }
      match_documents_optimized: {
        Args: {
          query_embedding: string
          similarity_threshold?: number
          match_count?: number
        }
        Returns: {
          id: number
          content: string
          metadata: Json
          similarity: number
        }[]
      }
      set_statement_timeout: {
        Args: {
          milliseconds: number
        }
        Returns: undefined
      }
      sparsevec_out: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      sparsevec_send: {
        Args: {
          "": unknown
        }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: {
          "": unknown[]
        }
        Returns: number
      }
      unaccent: {
        Args: {
          "": string
        }
        Returns: string
      }
      unaccent_init: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      vector_avg: {
        Args: {
          "": number[]
        }
        Returns: string
      }
      vector_dims:
        | {
            Args: {
              "": string
            }
            Returns: number
          }
        | {
            Args: {
              "": unknown
            }
            Returns: number
          }
      vector_norm: {
        Args: {
          "": string
        }
        Returns: number
      }
      vector_out: {
        Args: {
          "": string
        }
        Returns: unknown
      }
      vector_send: {
        Args: {
          "": string
        }
        Returns: string
      }
      vector_typmod_in: {
        Args: {
          "": unknown[]
        }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
