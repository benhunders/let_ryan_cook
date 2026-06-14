// Hand-written database types mirroring the Supabase schema.
// These can be regenerated with the Supabase MCP `generate_typescript_types`
// (or `supabase gen types typescript`) once the project is provisioned.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          avatar_url: string | null;
          is_admin: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          is_admin?: boolean;
          created_at?: string;
        };
        Update: {
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
        };
        Relationships: [];
      };
      menus: {
        Row: {
          id: string;
          title: string;
          week_start: string | null;
          published: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          week_start?: string | null;
          published?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          title?: string;
          week_start?: string | null;
          published?: boolean;
        };
        Relationships: [];
      };
      dishes: {
        Row: {
          id: string;
          menu_id: string;
          name: string;
          description: string | null;
          price: number | null;
          image_url: string | null;
          position: number;
          available: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          menu_id: string;
          name: string;
          description?: string | null;
          price?: number | null;
          image_url?: string | null;
          position?: number;
          available?: boolean;
          created_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          price?: number | null;
          image_url?: string | null;
          position?: number;
          available?: boolean;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          user_id: string;
          menu_id: string;
          notes: string | null;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          menu_id: string;
          notes?: string | null;
          status?: string;
          created_at?: string;
        };
        Update: {
          notes?: string | null;
          status?: string;
        };
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          dish_id: string;
          quantity: number;
          note: string | null;
        };
        Insert: {
          id?: string;
          order_id: string;
          dish_id: string;
          quantity?: number;
          note?: string | null;
        };
        Update: {
          quantity?: number;
          note?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

// Convenience row aliases used across the app.
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Menu = Database["public"]["Tables"]["menus"]["Row"];
export type Dish = Database["public"]["Tables"]["dishes"]["Row"];
export type Order = Database["public"]["Tables"]["orders"]["Row"];
export type OrderItem = Database["public"]["Tables"]["order_items"]["Row"];
