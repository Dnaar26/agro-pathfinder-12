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
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          notes: string | null
          owner_id: string
          soil_type_id: number | null
          updated_at: string
        }
        Insert: {
          area_m2: number
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          notes?: string | null
          owner_id: string
          soil_type_id?: number | null
          updated_at?: string
        }
        Update: {
          area_m2?: number
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          notes?: string | null
          owner_id?: string
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
          created_at: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_automatic_alerts: { Args: never; Returns: undefined }
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
      alert_kind: "RIEGO" | "FERTILIZACION" | "COSECHA" | "CLIMA" | "VENCIDA"
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
