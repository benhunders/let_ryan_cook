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
      admin_allowlist: {
        Row: {
          added_by: string | null
          created_at: string
          email: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          email: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          email?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_allowlist_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dishes: {
        Row: {
          allergens: string[]
          available: boolean
          created_at: string
          description: string | null
          dietary_tags: string[]
          id: string
          image_url: string | null
          menu_id: string
          name: string
          position: number
          price: number | null
        }
        Insert: {
          allergens?: string[]
          available?: boolean
          created_at?: string
          description?: string | null
          dietary_tags?: string[]
          id?: string
          image_url?: string | null
          menu_id: string
          name: string
          position?: number
          price?: number | null
        }
        Update: {
          allergens?: string[]
          available?: boolean
          created_at?: string
          description?: string | null
          dietary_tags?: string[]
          id?: string
          image_url?: string | null
          menu_id?: string
          name?: string
          position?: number
          price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dishes_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          body: string
          category: string
          created_at: string
          dish_id: string | null
          id: string
          menu_id: string | null
          user_id: string
        }
        Insert: {
          body: string
          category?: string
          created_at?: string
          dish_id?: string | null
          id?: string
          menu_id?: string | null
          user_id: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          dish_id?: string | null
          id?: string
          menu_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      menus: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          published: boolean
          title: string
          week_start: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          published?: boolean
          title: string
          week_start?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          published?: boolean
          title?: string
          week_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menus_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          dish_id: string
          id: string
          note: string | null
          order_id: string
          quantity: number
        }
        Insert: {
          dish_id: string
          id?: string
          note?: string | null
          order_id: string
          quantity?: number
        }
        Update: {
          dish_id?: string
          id?: string
          note?: string | null
          order_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          id: string
          menu_id: string
          notes: string | null
          status: string
          status_updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          menu_id: string
          notes?: string | null
          status?: string
          status_updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          menu_id?: string
          notes?: string | null
          status?: string
          status_updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ratings: {
        Row: {
          comment: string | null
          created_at: string
          dish_id: string
          id: string
          rating: number
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          dish_id: string
          id?: string
          rating: number
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          dish_id?: string
          id?: string
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ratings_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_admin: boolean
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_admin?: boolean
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_admin?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_admin: { Args: { target_email: string }; Returns: undefined }
      delete_my_account: { Args: Record<PropertyKey, never>; Returns: undefined }
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean }
      remove_admin: { Args: { target_email: string }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Convenience row aliases used across the app.
export type Profile = Database["public"]["Tables"]["profiles"]["Row"]
export type Menu = Database["public"]["Tables"]["menus"]["Row"]
export type Dish = Database["public"]["Tables"]["dishes"]["Row"]
export type Order = Database["public"]["Tables"]["orders"]["Row"]
export type OrderItem = Database["public"]["Tables"]["order_items"]["Row"]
export type Feedback = Database["public"]["Tables"]["feedback"]["Row"]
export type Rating = Database["public"]["Tables"]["ratings"]["Row"]
