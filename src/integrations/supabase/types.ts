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
      activities: {
        Row: {
          created_at: string
          crop_id: string
          id: string
          kind: Database["public"]["Enums"]["activity_kind"]
          notes: string | null
          performed_at: string
          photo_urls: string[]
          responsible_id: string
        }
        Insert: {
          created_at?: string
          crop_id: string
          id?: string
          kind: Database["public"]["Enums"]["activity_kind"]
          notes?: string | null
          performed_at?: string
          photo_urls?: string[]
          responsible_id: string
        }
        Update: {
          created_at?: string
          crop_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["activity_kind"]
          notes?: string | null
          performed_at?: string
          photo_urls?: string[]
          responsible_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_crop_id_fkey"
            columns: ["crop_id"]
            isOneToOne: false
            referencedRelation: "crops"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          body: string | null
          created_at: string
          crop_id: string | null
          id: string
          kind: Database["public"]["Enums"]["alert_kind"]
          scheduled_at: string
          status: Database["public"]["Enums"]["alert_status"]
          title: string
          user_id: string
          sender_id: string | null
          origin: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          crop_id?: string | null
          id?: string
          kind: Database["public"]["Enums"]["alert_kind"]
          scheduled_at?: string
          status?: Database["public"]["Enums"]["alert_status"]
          title: string
          user_id: string
          sender_id?: string | null
          origin?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          crop_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["alert_kind"]
          scheduled_at?: string
          status?: Database["public"]["Enums"]["alert_status"]
          title?: string
          user_id?: string
          sender_id?: string | null
          origin?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_crop_id_fkey"
            columns: ["crop_id"]
            isOneToOne: false
            referencedRelation: "crops"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          created_at: string
          crop_id: string | null
          description: string | null
          done: boolean
          ends_at: string | null
          id: string
          kind: Database["public"]["Enums"]["activity_kind"] | null
          starts_at: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          crop_id?: string | null
          description?: string | null
          done?: boolean
          ends_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["activity_kind"] | null
          starts_at: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          crop_id?: string | null
          description?: string | null
          done?: boolean
          ends_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["activity_kind"] | null
          starts_at?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_crop_id_fkey"
            columns: ["crop_id"]
            isOneToOne: false
            referencedRelation: "crops"
            referencedColumns: ["id"]
          },
        ]
      }
      crop_catalog: {
        Row: {
          code: string
          cycle_days: number
          id: number
          name: string
        }
        Insert: {
          code: string
          cycle_days: number
          id?: number
          name: string
        }
        Update: {
          code?: string
          cycle_days?: number
          id?: number
          name?: string
        }
        Relationships: []
      }
      crops: {
        Row: {
          catalog_id: number
          created_at: string
          estimated_harvest_date: string
          id: string
          notes: string | null
          parcel_id: string
          planting_date: string
          planting_confirmed_at: string | null
          status: Database["public"]["Enums"]["crop_status"]
          updated_at: string
        }
        Insert: {
          catalog_id: number
          created_at?: string
          estimated_harvest_date: string
          id?: string
          notes?: string | null
          parcel_id: string
          planting_date: string
          planting_confirmed_at?: string | null
          status?: Database["public"]["Enums"]["crop_status"]
          updated_at?: string
        }
        Update: {
          catalog_id?: number
          created_at?: string
          estimated_harvest_date?: string
          id?: string
          notes?: string | null
          parcel_id?: string
          planting_date?: string
          planting_confirmed_at?: string | null
          status?: Database["public"]["Enums"]["crop_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crops_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "crop_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crops_parcel_id_fkey"
            columns: ["parcel_id"]
            isOneToOne: false
            referencedRelation: "parcels"
            referencedColumns: ["id"]
          },
        ]
      }
      parcels: {
        Row: {
          area_m2: number
          created_at: string
          geometry: Json | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          notes: string | null
          owner_id: string
          polygon_area_m2: number | null
          soil_type_id: number | null
          updated_at: string
        }
        Insert: {
          area_m2: number
          created_at?: string
          geometry?: Json | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          notes?: string | null
          owner_id: string
          polygon_area_m2?: number | null
          soil_type_id?: number | null
          updated_at?: string
        }
        Update: {
          area_m2?: number
          created_at?: string
          geometry?: Json | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          notes?: string | null
          owner_id?: string
          polygon_area_m2?: number | null
          soil_type_id?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parcels_soil_type_id_fkey"
            columns: ["soil_type_id"]
            isOneToOne: false
            referencedRelation: "soil_types"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      soil_types: {
        Row: {
          code: string
          id: number
          name: string
        }
        Insert: {
          code: string
          id?: number
          name: string
        }
        Update: {
          code?: string
          id?: number
          name?: string
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
      alert_settings: {
        Row: {
          id: boolean
          planting_reminder_days: number
          stock_alerts_enabled: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: boolean
          planting_reminder_days?: number
          stock_alerts_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: boolean
          planting_reminder_days?: number
          stock_alerts_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      batches: {
        Row: {
          batch_code: string
          created_at: string
          crop_id: string
          globalgap_cert: boolean | null
          harvest_date: string | null
          id: string
          notes: string | null
          qr_code: string | null
          qty: number | null
          quantity: number | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          batch_code: string
          created_at?: string
          crop_id: string
          globalgap_cert?: boolean | null
          harvest_date?: string | null
          id?: string
          notes?: string | null
          qr_code?: string | null
          qty?: number | null
          quantity?: number | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          batch_code?: string
          created_at?: string
          crop_id?: string
          globalgap_cert?: boolean | null
          harvest_date?: string | null
          id?: string
          notes?: string | null
          qr_code?: string | null
          qty?: number | null
          quantity?: number | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "batches_crop_id_fkey"
            columns: ["crop_id"]
            isOneToOne: false
            referencedRelation: "crops"
            referencedColumns: ["id"]
          },
        ]
      }
      crop_costs: {
        Row: {
          created_at: string
          crop_id: string
          description: string | null
          id: string
          kind: string | null
          notes: string | null
          qty: number | null
          total: number
          unit: string | null
          unit_cost: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          crop_id: string
          description?: string | null
          id?: string
          kind?: string | null
          notes?: string | null
          qty?: number | null
          total: number
          unit?: string | null
          unit_cost?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          crop_id?: string
          description?: string | null
          id?: string
          kind?: string | null
          notes?: string | null
          qty?: number | null
          total?: number
          unit?: string | null
          unit_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crop_costs_crop_id_fkey"
            columns: ["crop_id"]
            isOneToOne: false
            referencedRelation: "crops"
            referencedColumns: ["id"]
          },
        ]
      }
      crop_harvests: {
        Row: {
          created_at: string
          crop_id: string
          harvested_qty: number
          id: string
          notes: string | null
          performed_at: string
          sale_price: number | null
          total_revenue: number | null
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          crop_id: string
          harvested_qty: number
          id?: string
          notes?: string | null
          performed_at?: string
          sale_price?: number | null
          total_revenue?: number | null
          unit?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          crop_id?: string
          harvested_qty?: number
          id?: string
          notes?: string | null
          performed_at?: string
          sale_price?: number | null
          total_revenue?: number | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crop_harvests_crop_id_fkey"
            columns: ["crop_id"]
            isOneToOne: false
            referencedRelation: "crops"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          alerts_sent_today: number | null
          category: string | null
          created_at: string
          id: string
          min_stock: number
          name: string
          owner_id: string
          stock_qty: number
          unit: string
          unit_cost: number
          updated_at: string
        }
        Insert: {
          alerts_sent_today?: number | null
          category?: string | null
          created_at?: string
          id?: string
          min_stock?: number
          name: string
          owner_id: string
          stock_qty?: number
          unit?: string
          unit_cost?: number
          updated_at?: string
        }
        Update: {
          alerts_sent_today?: number | null
          category?: string | null
          created_at?: string
          id?: string
          min_stock?: number
          name?: string
          owner_id?: string
          stock_qty?: number
          unit?: string
          unit_cost?: number
          updated_at?: string
        }
        Relationships: []
      }
      inventory_movements: {
        Row: {
          calendar_event_id: string | null
          created_at: string
          id: string
          item_id: string
          kind: string
          notes: string | null
          qty: number
        }
        Insert: {
          calendar_event_id?: string | null
          created_at?: string
          id?: string
          item_id: string
          kind: string
          notes?: string | null
          qty: number
        }
        Update: {
          calendar_event_id?: string | null
          created_at?: string
          id?: string
          item_id?: string
          kind?: string
          notes?: string | null
          qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_calendar_event_id_fkey"
            columns: ["calendar_event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
        ]
      }
      pest_incidents: {
        Row: {
          created_at: string
          crop_id: string
          date: string
          id: string
          notes: string | null
          pest_name: string
          severity: string
          treatment: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          crop_id: string
          date?: string
          id?: string
          notes?: string | null
          pest_name: string
          severity: string
          treatment?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          crop_id?: string
          date?: string
          id?: string
          notes?: string | null
          pest_name?: string
          severity?: string
          treatment?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pest_incidents_crop_id_fkey"
            columns: ["crop_id"]
            isOneToOne: false
            referencedRelation: "crops"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_reports: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          recipients: string[]
          schedule: string
          template: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          recipients: string[]
          schedule: string
          template: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          recipients?: string[]
          schedule?: string
          template?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      technician_farmer_assignments: {
        Row: {
          created_at: string
          created_by: string | null
          farmer_id: string
          technician_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          farmer_id: string
          technician_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          farmer_id?: string
          technician_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          created_at: string
          id: string
          subscription: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          subscription: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          subscription?: Json
          user_id?: string
        }
        Relationships: []
      }
      ndvi_cache: {
        Row: {
          created_at: string
          date: string
          id: string
          ndvi: number
          parcel_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          ndvi: number
          parcel_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          ndvi?: number
          parcel_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ndvi_cache_parcel_id_fkey"
            columns: ["parcel_id"]
            isOneToOne: false
            referencedRelation: "parcels"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_inventory_movement: {
        Args: {
          p_delta?: number
          p_item_id: string
          p_kind: string
          p_notes?: string | null
          p_qty: number
        }
        Returns: undefined
      }
      create_calendar_event_with_inventory: {
        Args: {
          p_crop_id?: string | null
          p_description?: string | null
          p_item_id?: string | null
          p_qty?: number | null
          p_starts_at: string
          p_title: string
        }
        Returns: string
      }
      update_calendar_event_with_inventory: {
        Args: {
          p_crop_id?: string | null
          p_description?: string | null
          p_event_id: string
          p_item_id?: string | null
          p_qty?: number | null
          p_starts_at: string
          p_title: string
        }
        Returns: undefined
      }
      delete_calendar_event_with_inventory: {
        Args: { p_event_id: string }
        Returns: undefined
      }
      set_calendar_event_done: {
        Args: { p_event_id: string }
        Returns: undefined
      }
      confirm_crop_planting: {
        Args: { p_crop_id: string }
        Returns: undefined
      }
      transition_crop_status: {
        Args: {
          p_crop_id: string
          p_status: Database["public"]["Enums"]["crop_status"]
        }
        Returns: undefined
      }
      transition_crop_statuses: {
        Args: {
          p_crop_ids: string[]
          p_status: Database["public"]["Enums"]["crop_status"]
        }
        Returns: number
      }
      generate_automatic_alerts: { Args: never; Returns: undefined }
      create_manual_alert: { Args: { p_recipient_id: string; p_kind: Database["public"]["Enums"]["alert_kind"]; p_title: string; p_body?: string | null }; Returns: string }
      list_manual_alert_recipients: { Args: never; Returns: { id: string; full_name: string; role: Database["public"]["Enums"]["app_role"] }[] }
      delete_parcel_cascade: { Args: { p_parcel_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      activity_kind:
        | "RIEGO"
        | "FERTILIZACION"
        | "CONTROL_PLAGAS"
        | "PODA"
        | "INSUMOS"
        | "COSECHA"
        | "MONITOREO"
      alert_kind: "RIEGO" | "FERTILIZACION" | "COSECHA" | "CLIMA" | "VENCIDA" | "STOCK"
      alert_status: "PENDIENTE" | "ATENDIDA" | "DESCARTADA"
      app_role: "agricultor" | "tecnico" | "admin"
      crop_status:
        | "PLANEADO"
        | "SEMBRADO"
        | "CRECIMIENTO"
        | "MANTENIMIENTO"
        | "COSECHA"
        | "POSTCOSECHA"
        | "FINALIZADO"
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
      activity_kind: [
        "RIEGO",
        "FERTILIZACION",
        "CONTROL_PLAGAS",
        "PODA",
        "INSUMOS",
        "COSECHA",
        "MONITOREO",
      ],
      alert_kind: ["RIEGO", "FERTILIZACION", "COSECHA", "CLIMA", "VENCIDA"],
      alert_status: ["PENDIENTE", "ATENDIDA", "DESCARTADA"],
      app_role: ["agricultor", "tecnico", "admin"],
      crop_status: [
        "PLANEADO",
        "SEMBRADO",
        "CRECIMIENTO",
        "MANTENIMIENTO",
        "COSECHA",
        "POSTCOSECHA",
        "FINALIZADO",
      ],
    },
  },
} as const
