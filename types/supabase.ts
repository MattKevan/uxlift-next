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
      accounts_customuser: {
        Row: {
          date_joined: string
          email: string
          first_name: string
          id: number
          is_active: boolean
          is_staff: boolean
          is_superuser: boolean
          last_login: string | null
          last_name: string
          password: string
          username: string
        }
        Insert: {
          date_joined: string
          email: string
          first_name: string
          id: number
          is_active: boolean
          is_staff: boolean
          is_superuser: boolean
          last_login?: string | null
          last_name: string
          password: string
          username: string
        }
        Update: {
          date_joined?: string
          email?: string
          first_name?: string
          id?: number
          is_active?: boolean
          is_staff?: boolean
          is_superuser?: boolean
          last_login?: string | null
          last_name?: string
          password?: string
          username?: string
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
            referencedRelation: "accounts_customuser"
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
            referencedRelation: "accounts_customuser"
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
        }
        Relationships: []
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
      user_profiles: {
        Row: {
          created_at: string
          id: number
          image_url: string | null
          is_admin: boolean
          name: string | null
          user_id: string | null
          username: string
        }
        Insert: {
          created_at?: string
          id?: number
          image_url?: string | null
          is_admin?: boolean
          name?: string | null
          user_id?: string | null
          username: string
        }
        Update: {
          created_at?: string
          id?: number
          image_url?: string | null
          is_admin?: boolean
          name?: string | null
          user_id?: string | null
          username?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_unique_slug: {
        Args: {
          title: string
        }
        Returns: string
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
